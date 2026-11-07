(() => {
  'use strict';
  const gallery = document.getElementById('gallery');
  const categories = [
    { name:'Portrait', label:'Portrait photography', id:'portraits', description:'People, presence, and the moments in between.' },
    { name:'Product', label:'Product photography', id:'product', description:'Form, texture, and the art of looking closer.' },
    { name:'Wildlife', label:'Wildlife photography', id:'wildlife', description:'A little closer to the natural world.' },
    { name:'Macro', label:'Macro photography', id:'macro', description:'Small details. A different perspective.' },
    { name:'Architecture', label:'Architectural photography', id:'architecture', description:'Form, space, and the light between.' }
  ];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const observer = 'IntersectionObserver' in window && !reducedMotion ? new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold:.04, rootMargin:'0px 0px 20px 0px' }) : null;
  if(observer) document.documentElement.classList.add('js-motion');
  function renderPhoto(photo, index, container) {
    const figure = document.createElement('figure');
    figure.className = 'photo-card reveal' + (photo.width > photo.height ? ' landscape' : '');
    const button = document.createElement('button');
    button.className = 'image-button'; button.dataset.photo = photo.id;
    button.setAttribute('aria-label', `Open ${photo.title}, photograph ${index+1}`);
    const img = document.createElement('img');
    img.src = photo.src; if(photo.srcset) img.srcset = photo.srcset;
    img.sizes = photo.width>photo.height ? '(max-width:600px) calc(100vw - 44px), (max-width:900px) 89vw, (min-width:1800px) 1060px, 60vw' : '(max-width:600px) calc(100vw - 44px), (max-width:900px) 44vw, (min-width:1800px) 525px, 29vw';
    img.width = photo.width; img.height = photo.height; img.alt = photo.alt;
    img.loading = 'lazy'; img.decoding = 'async';
    const arrow = document.createElement('span'); arrow.className='image-open'; arrow.setAttribute('aria-hidden','true'); arrow.textContent='↗';
    button.append(img,arrow);
    const caption=document.createElement('figcaption'), copy=document.createElement('div'), title=document.createElement('h3'), category=document.createElement('p'), number=document.createElement('span');
    title.textContent=photo.title; category.textContent=photo.category;
    number.className='photo-index'; number.textContent=String(index+1).padStart(2,'0');
    copy.append(title,category); caption.append(copy,number); figure.append(button,caption);
    container.append(figure); observer?.observe(figure);
  }
  async function loadCollection() {
    gallery.setAttribute('aria-busy','true');
    try {
      const response=await fetch(window.PortfolioHosting.origin+'/api/photos',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!response.ok) throw new Error();
      const data=await response.json();
      if(!Array.isArray(data.photos)) throw new Error();
      const hostedPhotos=data.photos.map(window.PortfolioHosting.photo);
      const photos=categories.flatMap(category=>hostedPhotos.filter(photo=>photo.category===category.name));
      gallery.replaceChildren();
      let index=0;
      categories.forEach((category, groupIndex)=>{
        const entries=photos.filter(photo=>photo.category===category.name);
        const section=document.createElement('section'); section.id=category.id; section.className='photo-section'; section.setAttribute('aria-labelledby',category.id+'-title');
        const heading=document.createElement('div'); heading.className='collection-heading';
        const copy=document.createElement('div'), eyebrow=document.createElement('p'), title=document.createElement('h3'), description=document.createElement('p'), count=document.createElement('span');
        eyebrow.className='eyebrow'; eyebrow.textContent='Collection '+String(groupIndex+1).padStart(2,'0');
        title.id=category.id+'-title'; title.textContent=category.label;
        description.className='collection-description'; description.textContent=category.description;
        count.className='collection-count'; count.textContent=String(entries.length).padStart(2,'0')+(entries.length===1?' frame':' frames');
        copy.append(eyebrow,title,description); heading.append(copy,count); section.append(heading);
        const grid=document.createElement('div'); grid.className='gallery';
        if(entries.length) entries.forEach(photo=>renderPhoto(photo,index++,grid));
        else { const empty=document.createElement('p'); empty.className='empty-collection'; empty.textContent='New photographs coming soon.'; grid.append(empty); }
        section.append(grid); gallery.append(section);
      });
      document.querySelector('.section-count').textContent=String(photos.length).padStart(2,'0')+` photographs · ${categories.length} collections`;
      window.PortfolioQuality?.initGallery(photos);
      window.PortfolioViewer?.init(photos);
      if(location.hash) { const target=document.getElementById(location.hash.slice(1)); if(target) requestAnimationFrame(()=>target.scrollIntoView({behavior:'instant',block:'start'})); }
    } catch {
      gallery.replaceChildren();
      const note=document.createElement('p'); note.className='collection-load-note'; note.textContent='The photographs could not load. Please try again.';
      const retry=document.createElement('button'); retry.className='collection-retry'; retry.textContent='Try again'; retry.addEventListener('click',loadCollection);
      gallery.append(note,retry);
    } finally { gallery.setAttribute('aria-busy','false'); }
  }
  document.getElementById('year').textContent=new Date().getFullYear();
  loadCollection();
  // Owner management remains on the authenticated backend; no visitor upload control.
})();
