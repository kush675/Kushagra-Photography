(() => {
  'use strict';
  const math = window.PortfolioZoomMath;
  window.PortfolioViewer = {
    init(photos) {
      const dialog = document.getElementById('photo-viewer');
      if (!math || !window.PortfolioOriginalLoader || !dialog || !Array.isArray(photos) || !photos.length || dialog.dataset.ready) return;
      dialog.dataset.ready = 'true';
      const element = name => document.getElementById(`viewer-${name}`);
      const stage = element('stage'), canvas = element('canvas'), image = element('image');
      const title = element('title'), meta = element('meta'), counter = element('counter'), status = element('status');
      const closeButton = element('close'), previousButton = element('prev'), nextButton = element('next');
      const quality = element('quality'), retryButton = element('retry'), minus = element('minus'), plus = element('plus'), range = element('range');
      const actual = element('actual'), fitButton = element('fit'), percentage = element('percentage');
      const originals = window.PortfolioOriginalLoader.create();
      const pointers = new Map();
      const indexes = new Map(photos.map((photo, index) => [String(photo.id), index]));
      let current = 0, generation = 0, zoomRequest = 0, controller = null, opener = null;
      let fullLoaded = false, fullLoading = false, fullFailed = false, fullDimensions = null, fullPromise = null;
      let detailView = null, detailLevel = null, detailFrame = 0;
      let scale = 1, fit = 1, fitMode = true, box = null, drag = null, pinch = null, swipe = null, previousOverflow = '';
      const MAX_SCALE = 2;
      const dimensions = () => fullDimensions || { width: photos[current].width, height: photos[current].height };
      const center = () => ({ x: stage.clientWidth / 2, y: stage.clientHeight / 2 });
      const enlarged = () => !fitMode;
      const localPoint = event => { const rect = stage.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
      const announce = message => { if(status.textContent!==message)status.textContent = message; };
      const tiled = () => !!(photos[current].quality && window.PortfolioQuality);
      image.draggable = false; image.decoding = 'async';
      window.PortfolioViewer.addPhotos = additions => {
        additions.forEach(photo => { if (photo && !indexes.has(String(photo.id))) { indexes.set(String(photo.id), photos.length); photos.push(photo); } });
        previousButton.hidden = nextButton.hidden = photos.length < 2;
      };
      previousButton.hidden = nextButton.hidden = photos.length < 2;
      element('help').textContent = window.matchMedia('(pointer: coarse)').matches
        ? 'Drag to move · Pinch to zoom · Use 100% to inspect sharpness'
        : 'Drag or scroll to move · Pinch or Ctrl/⌘ + scroll to zoom · Double-click for 100% or Fit';

      function updateControls() {
        quality.setAttribute('aria-busy', String(fullLoading));
        quality.classList.toggle('is-ready', fullLoaded);
        const label = fullLoading ? (tiled()?'Loading detail…':'Loading original…') : fullLoaded ? (tiled()&&detailLevel!==0?'Photo ready':'Full resolution') : 'Preview';
        if(quality.textContent!==label)quality.textContent = label;
        retryButton.hidden = !fullFailed || fullLoading;
        minus.disabled = (!tiled()&&fullLoading) || !enlarged();
        plus.disabled = (!tiled()&&fullLoading) || !photos[current].full || scale >= MAX_SCALE - 0.00001;
        actual.disabled = (!tiled()&&fullLoading) || !photos[current].full;
        actual.setAttribute('aria-pressed', String(fullLoaded && Math.abs(scale - 1) < 0.00001));
        fitButton.setAttribute('aria-pressed', String(!enlarged()));
        range.disabled = !tiled()&&(fullLoading || !fullLoaded);
        range.min = String(Math.floor(fit * 1000) / 10);
        range.max = String(MAX_SCALE * 100);
        range.value = String(scale * 100);
        range.setAttribute('aria-valuetext', `${Math.round(scale * 100)} percent${!enlarged() ? ', fit to screen' : ''}`);
        percentage.textContent = `${Math.round(scale * 100)}%`;
        stage.classList.toggle('is-zoomed', enlarged());
      }
      function setScale(value, anchor = center(), point = null, preserveFit = false) {
        if (!stage.clientWidth || !stage.clientHeight) return;
        const size = dimensions();
        const old = box || math.layout(stage.clientWidth, stage.clientHeight, size.width, size.height, scale);
        const imageAnchor = point || math.imagePoint(old, stage.scrollLeft, stage.scrollTop, anchor);
        fit = math.fitScale(stage.clientWidth, stage.clientHeight, size.width, size.height);
        if (preserveFit && fitMode) value = fit;
        scale = math.clamp(value, fit, MAX_SCALE);
        fitMode = scale <= fit + 0.00001;
        box = math.layout(stage.clientWidth, stage.clientHeight, size.width, size.height, scale);
        canvas.style.width = `${box.width}px`; canvas.style.height = `${box.height}px`;
        image.style.width = `${box.imageWidth}px`; image.style.height = `${box.imageHeight}px`;
        image.style.left = `${box.x}px`; image.style.top = `${box.y}px`;
        const scroll = math.scrollPosition(box, anchor, imageAnchor);
        stage.scrollLeft = scroll.left; stage.scrollTop = scroll.top;
        updateControls();
        updateDetail();
      }
      function updateDetail(){
        if(!detailView||!box)return;
        detailView.update(box,{left:stage.scrollLeft,top:stage.scrollTop,width:stage.clientWidth,height:stage.clientHeight});
      }
      function clearPointers() {
        const ids = [...pointers.keys()]; pointers.clear(); drag = pinch = swipe = null;
        for (const id of ids) if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
        stage.classList.remove('is-dragging');
      }
      function fitToScreen() { zoomRequest += 1; clearPointers(); setScale(0); }
      async function requestZoom(value, anchor = center(), original = false) {
        const token = generation, intent = ++zoomRequest;
        if (value <= fit + 0.00001 && !original) { setScale(0); return true; }
        if(tiled()){setScale(value,anchor);return true;}
        if (!(await loadFull()) || token !== generation || intent !== zoomRequest || !dialog.open) return false;
        setScale(value, anchor); return true;
      }
      function loadImage(url, signal) {
        return new Promise((resolve, reject) => {
          const candidate = new Image(); candidate.decoding = 'async'; candidate.fetchPriority = 'high';
          const clean = () => { signal.removeEventListener('abort', abort); candidate.onload = candidate.onerror = null; };
          const abort = () => { clean(); candidate.src = ''; reject(new DOMException('Cancelled', 'AbortError')); };
          candidate.onload = () => { clean(); resolve(candidate); };
          candidate.onerror = () => { clean(); reject(new Error('Your browser could not display this image. Please try again.')); };
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) return abort();
          candidate.src = url;
        });
      }
      function render(index) {
        detailView?.destroy();detailView=null;detailLevel=null;
        if(detailFrame)cancelAnimationFrame(detailFrame);detailFrame=0;
        controller?.abort(); controller = new AbortController();
        const active = controller, token = ++generation; zoomRequest += 1;
        current = (index + photos.length) % photos.length;
        fullLoaded = fullLoading = fullFailed = false; fullDimensions = fullPromise = null; clearPointers();
        const photo = photos[current];
        fit = math.fitScale(stage.clientWidth, stage.clientHeight, photo.width, photo.height); scale = fit; fitMode = true; box = null;
        image.removeAttribute('src'); image.alt = photo.alt || photo.title;
        title.textContent = photo.title;
        meta.textContent = [photo.category, `${photo.width.toLocaleString()} × ${photo.height.toLocaleString()}`].filter(Boolean).join(' · ');
        counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`;
        setScale(0); stage.classList.add('is-loading'); announce('Loading photograph…');
        loadImage(photo.src, active.signal).then(() => {
          if (generation !== token || !dialog.open || (fullLoaded&&!tiled())) return;
          image.src = photo.src; stage.classList.remove('is-loading');
          if (!fullLoading && !fullFailed) announce('');
        }).catch(error => {
          if (error.name === 'AbortError' || generation !== token || fullLoaded || fullLoading) return;
          stage.classList.remove('is-loading'); announce('This photograph could not load. Please try again.');
        });
        if(tiled()){
          window.PortfolioQuality.foreground(photo.quality.base);
          detailView=window.PortfolioQuality.create(photo.quality,canvas,{priority:0,onState(state){
            if(generation!==token||!dialog.open)return;
            fullLoaded=state.ready;fullLoading=!state.ready&&!state.error;fullFailed=!!state.error;detailLevel=state.level;
            if(state.ready){stage.classList.remove('is-loading');announce(state.level===0?'Full-resolution detail ready.':'Photograph ready.');}
            else announce(state.error?'Photo detail could not load. Please retry.':'Loading original detail…');
            updateControls();
          }});
          updateDetail();
        }else void loadFull();
      }
      function loadFull() {
        if (fullLoaded) return Promise.resolve(true);
        if (fullPromise) return fullPromise;
        if (!photos[current].full || !controller) return Promise.resolve(false);
        const token = generation, signal = controller.signal, photo = photos[current];
        fullLoading = true; fullFailed = false; updateControls(); announce('Loading full resolution…');
        fullPromise = (async () => {
          try {
            const url = await originals.resolve(photo.full, signal, (part, total) => { if (generation === token) { const percent = Math.round(part / total * 100); quality.textContent = `Loading ${percent}%`; announce(`Loading full resolution: ${percent}%.`); } });
            const loaded = await loadImage(url, signal);
            if (token !== generation || !dialog.open) return false;
            image.src = url; fullDimensions = { width: loaded.naturalWidth, height: loaded.naturalHeight }; fullLoaded = true;
            stage.classList.remove('is-loading'); setScale(scale,center(),null,true); announce('Full resolution ready.'); if (pointers.size) startGesture(); return true;
          } catch (error) {
            if (error.name !== 'AbortError' && generation === token) { fullFailed = true; announce(error.message || 'Unable to load the original. Please try again.'); }
            return false;
          } finally {
            if (generation === token) { fullLoading = false; fullPromise = null; updateControls(); }
          }
        })();
        return fullPromise;
      }
      document.addEventListener('click', event => {
        const trigger = event.target.closest('button[data-photo]');
        if (!trigger || !indexes.has(trigger.dataset.photo)) return;
        opener = trigger; previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
        dialog.showModal(); render(indexes.get(trigger.dataset.photo)); closeButton.focus({ preventScroll: true });
      });
      closeButton.addEventListener('click', () => dialog.close());
      previousButton.addEventListener('click', () => render(current - 1));
      nextButton.addEventListener('click', () => render(current + 1));
      retryButton.addEventListener('click', () => { if(detailView)detailView.refresh();else void loadFull(); });
      actual.addEventListener('click', () => requestZoom(1, center(), true));
      fitButton.addEventListener('click', fitToScreen);
      plus.addEventListener('click', () => requestZoom(scale * 1.4));
      minus.addEventListener('click', () => requestZoom(scale / 1.4));
      range.addEventListener('input', () => { zoomRequest += 1; if (fullLoaded||tiled()) setScale(Number(range.value) / 100); });
      stage.addEventListener('dblclick', event => { event.preventDefault(); if (enlarged()) fitToScreen(); else void requestZoom(1, localPoint(event), true); });
      stage.addEventListener('wheel', event => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (fullLoading&&!tiled()) return;
          const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
          void requestZoom(scale * Math.exp(-math.clamp(delta, -200, 200) * 0.003), localPoint(event));
        } else if (event.shiftKey && enlarged() && !event.deltaX) {
          event.preventDefault(); stage.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : 1);
        }
      }, { passive: false });
      function startGesture() {
        const points = [...pointers.values()];
        pinch = null;
        if (points.length >= 2) {
          swipe = null;
          const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
          pinch = { distance: Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)), scale, image: math.imagePoint(box, stage.scrollLeft, stage.scrollTop, midpoint) };
        } else if (points.length === 1) drag = { x: points[0].x, y: points[0].y, left: stage.scrollLeft, top: stage.scrollTop };
        else drag = null;
      }
      stage.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const point = localPoint(event);
        if (point.x > stage.clientWidth || point.y > stage.clientHeight) return; // Preserve native scrollbar interaction.
        pointers.set(event.pointerId, point); stage.setPointerCapture(event.pointerId);
        if (pointers.size === 1 && event.pointerType === 'touch' && !enlarged()) swipe = point;
        startGesture(); if (enlarged()) stage.classList.add('is-dragging');
      });
      stage.addEventListener('pointermove', event => {
        if (!pointers.has(event.pointerId)) return;
        const point = localPoint(event); pointers.set(event.pointerId, point);
        if (pointers.size >= 2 && pinch) {
          event.preventDefault(); const points = [...pointers.values()];
          const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
          if (!fullLoaded&&!tiled()) {
            if (!fullLoading) void requestZoom(Math.max(fit * 1.4, scale), midpoint).then(applied => { if (applied && pointers.size) startGesture(); });
            return;
          }
          zoomRequest += 1;
          setScale(pinch.scale * Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) / pinch.distance, midpoint, pinch.image);
        } else if (drag && enlarged()) {
          event.preventDefault(); stage.classList.add('is-dragging');
          stage.scrollLeft = drag.left - (point.x - drag.x); stage.scrollTop = drag.top - (point.y - drag.y);
        }
      });
      function endPointer(event, cancelled = false) {
        if (!pointers.has(event.pointerId)) return;
        const point = pointers.get(event.pointerId), swipeStart = swipe;
        pointers.delete(event.pointerId);
        if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
        swipe = null; stage.classList.remove('is-dragging'); startGesture();
        if (!cancelled && !pointers.size && swipeStart && !enlarged()) {
          const dx = point.x - swipeStart.x, dy = point.y - swipeStart.y;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) render(current + (dx < 0 ? 1 : -1));
        }
      }
      stage.addEventListener('pointerup', event => endPointer(event));
      stage.addEventListener('pointercancel', event => endPointer(event, true));
      stage.addEventListener('lostpointercapture', event => endPointer(event, true));
      stage.addEventListener('scroll',()=>{if(detailView&&!detailFrame)detailFrame=requestAnimationFrame(()=>{detailFrame=0;updateDetail();});},{passive:true});
      dialog.addEventListener('keydown', event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (['+', '='].includes(event.key)) { event.preventDefault(); void requestZoom(scale * 1.4); }
        else if (['-', '_'].includes(event.key)) { event.preventDefault(); void requestZoom(scale / 1.4); }
        else if (event.key === '0' || event.key.toLowerCase() === 'f') { event.preventDefault(); fitToScreen(); }
        else if (event.key === '1') { event.preventDefault(); void requestZoom(1, center(), true); }
        else if (event.key.startsWith('Arrow')) {
          if (enlarged()) {
            event.preventDefault(); const step = event.shiftKey ? 320 : 80;
            stage.scrollBy({ left: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, top: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0, behavior: 'instant' });
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); render(current + (event.key === 'ArrowLeft' ? -1 : 1)); }
        }
      });
      function resize() {
        if (!dialog.open || !stage.clientWidth || !stage.clientHeight || !box) return;
        const wasFit = !enlarged(), size = dimensions();
        const point = math.imagePoint(box, stage.scrollLeft, stage.scrollTop, { x: box.viewWidth / 2, y: box.viewHeight / 2 });
        fit = math.fitScale(stage.clientWidth, stage.clientHeight, size.width, size.height);
        setScale(wasFit ? 0 : scale, center(), point);
      }
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
      else window.addEventListener('resize', resize);
      dialog.addEventListener('close', () => {
        detailView?.destroy();detailView=null;window.PortfolioQuality?.foreground(null);
        if(detailFrame)cancelAnimationFrame(detailFrame);detailFrame=0;
        controller?.abort(); generation += 1; zoomRequest += 1; clearPointers();
        document.body.style.overflow = previousOverflow; stage.classList.remove('is-loading'); image.removeAttribute('src'); announce('');
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      });
      window.addEventListener('pagehide', () => {
        controller?.abort(); clearPointers(); originals.clear();
      });
    }
  };
})();
