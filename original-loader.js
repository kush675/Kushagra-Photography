(() => {
  'use strict';
  window.PortfolioOriginalLoader = {
    create({ concurrency = 3, maxEntries = 2, fetcher = fetch, urls = URL } = {}) {
      const originals = new Map();
      async function resolve(asset, signal, progress) {
        signal.throwIfAborted();
        if (typeof asset === 'string') return asset;
        if (!asset || !Array.isArray(asset.parts) || !asset.parts.length) throw new Error('This image is unavailable.');
        const key = JSON.stringify([asset.type, asset.parts]);
        if (originals.has(key)) {
          const url = originals.get(key); originals.delete(key); originals.set(key, url); return url;
        }
        const group = new AbortController();
        const abort = () => group.abort(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        const parts = new Array(asset.parts.length);
        let next = 0, complete = 0, failure = null;
        async function worker() {
          for (;;) {
            group.signal.throwIfAborted();
            const index = next++;
            if (index >= asset.parts.length) return;
            const response = await fetcher(asset.parts[index], { signal: group.signal, cache: 'force-cache', priority: 'high' });
            if (!response.ok) { void response.body?.cancel(); throw new Error('The original could not load. Please try again.'); }
            parts[index] = await response.blob();
            group.signal.throwIfAborted();
            progress?.(++complete, asset.parts.length);
          }
        }
        try {
          const jobs = Array.from({ length: Math.min(Math.max(1, concurrency), asset.parts.length) }, () => worker().catch(error => { failure ||= error; group.abort(error); throw error; }));
          const results = await Promise.allSettled(jobs);
          const failed = results.find(result => result.status === 'rejected');
          if (failed) throw failure || failed.reason;
          signal.throwIfAborted();
          const url = urls.createObjectURL(new Blob(parts, { type: asset.type || 'application/octet-stream' }));
          originals.set(key, url);
          while (originals.size > maxEntries) { const oldest = originals.keys().next().value; urls.revokeObjectURL(originals.get(oldest)); originals.delete(oldest); }
          return url;
        } finally { signal.removeEventListener('abort', abort); }
      }
      function clear() { originals.forEach(url => urls.revokeObjectURL(url)); originals.clear(); }
      return { resolve, clear };
    }
  };
})();
