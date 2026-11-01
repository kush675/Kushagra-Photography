(() => {
  'use strict';
  const origin = 'https://kushagra-photographic-studies.aquabow1.chatgpt.site';
  const absolute = value => typeof value === 'string' && value ? new URL(value, origin + '/').href : value;
  function photo(source) {
    const hosted = {...source, src:absolute(source.src)};
    if(source.srcset) hosted.srcset=source.srcset.split(',').map(candidate=>{
      const [url,...descriptor]=candidate.trim().split(/\s+/);
      return [absolute(url),...descriptor].join(' ');
    }).join(', ');
    if(typeof source.full==='string') hosted.full=absolute(source.full);
    else if(source.full?.parts) hosted.full={...source.full,parts:source.full.parts.map(absolute)};
    if(source.quality) hosted.quality={...source.quality,base:absolute(source.quality.base),levels:source.quality.levels.map(level=>({...level,overview:absolute(level.overview)}))};
    return hosted;
  }
  window.PortfolioHosting=Object.freeze({origin,photo});
})();
