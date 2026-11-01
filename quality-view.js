(() => {
 'use strict';
 const math=window.PortfolioQualityMath;
 const entries=new Map(),queue=[];let active=0,pixels=0,sequence=0;
 const MAX_PIXELS=32*1024*1024,MAX_ENTRIES=100,MAX_ACTIVE=6;
 function releaseSlot(entry){if(!entry.running||entry.slotReleased)return;entry.slotReleased=true;entry.running=false;active--;}
 function trim(){
  for(const [key,entry] of entries){
   if(entries.size<=MAX_ENTRIES&&pixels<=MAX_PIXELS)break;
   if(!entry.image||entry.pins)continue;
   entries.delete(key);pixels-=entry.pixels;entry.image.src='';
  }
 }
 function pump(){
  queue.sort((a,b)=>a.priority-b.priority||a.order-b.order);
  while(active<MAX_ACTIVE&&queue.length){
   if(active&&queue[0].priority>0)break;
   const entry=queue.shift();if(entries.get(entry.url)!==entry)continue;active++;entry.running=true;entry.slotReleased=false;
   const image=new Image();image.decoding='async';image.fetchPriority=entry.priority===0?'high':'low';
   entry.loadingImage=image;
   image.onload=async()=>{
    try{await image.decode();if(entry.cancelled||entries.get(entry.url)!==entry)return;entry.image=image;entry.pixels=image.naturalWidth*image.naturalHeight;pixels+=entry.pixels;entry.resolve(image);}
    catch(error){if(!entry.cancelled&&entries.get(entry.url)===entry){entries.delete(entry.url);entry.reject(error);}}
    finally{entry.loadingImage=null;image.onload=image.onerror=null;releaseSlot(entry);trim();pump();}
   };
   image.onerror=()=>{if(entry.cancelled)return;entry.loadingImage=null;image.onload=image.onerror=null;if(entries.get(entry.url)===entry)entries.delete(entry.url);entry.reject(new Error('Photo detail could not load.'));releaseSlot(entry);pump();};
   image.src=entry.url;
  }
 }
 function get(url,priority=1){
  let entry=entries.get(url);
  if(entry){entries.delete(url);entries.set(url,entry);entry.priority=Math.min(entry.priority,priority);if(entry.loadingImage&&priority===0)entry.loadingImage.fetchPriority='high';pump();return entry.promise;}
  if(priority===2&&queue.filter(job=>entries.get(job.url)===job).length>=24)return Promise.reject(new DOMException('Prefetch deferred','AbortError'));
  entry={url,priority,order:++sequence,image:null,pixels:0,pins:0,cancelled:false,running:false,slotReleased:true};
  entry.promise=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject;});
  entries.set(url,entry);queue.push(entry);pump();return entry.promise;
 }
 function pin(url){const entry=entries.get(url);let released=false;if(entry)entry.pins++;return()=>{if(released)return;released=true;if(entry)entry.pins=Math.max(0,entry.pins-1);trim();};}
 function cached(url){const entry=entries.get(url);return entry?.image||null;}
 function cancel(url){
  const entry=entries.get(url);if(!entry||entry.image||entry.pins)return;
  entry.cancelled=true;entries.delete(url);if(entry.loadingImage){const image=entry.loadingImage;image.onload=image.onerror=null;image.src='';entry.loadingImage=null;}releaseSlot(entry);
  entry.reject(new DOMException('No longer in view','AbortError'));pump();
 }
 function foreground(base){
  for(const entry of entries.values())if(base&&entry.url.startsWith(base+'/')){entry.priority=0;if(entry.loadingImage)entry.loadingImage.fetchPriority='high';}
  for(const entry of [...entries.values()]){
   if(!base||entry.image||entry.priority===0||entry.pins)continue;
   cancel(entry.url);
  }
  pump();
 }
 function create(quality,parent,{priority=0,onState=()=>{}}={}){
  const layer=document.createElement('div');layer.className='quality-layer';layer.setAttribute('aria-hidden','true');parent.append(layer);
  let token=0,destroyed=false,last=null,nodes=new Map(),geometry=new Map(),releases=[],signature='',warmedNative=false;
  const pendingGroups=new Set();
  function clearPending(keep=new Set()){
   for(const group of pendingGroups){group.releases.forEach(release=>release());for(const url of group.urls)if(!keep.has(url))cancel(url);}
   pendingGroups.clear();
  }
  function positions(box,tiles){
   layer.style.left=`${box.x}px`;layer.style.top=`${box.y}px`;layer.style.width=`${box.imageWidth}px`;layer.style.height=`${box.imageHeight}px`;
   for(const [key,node] of nodes){const tile=geometry.get(key);node.style.left=`${tile.left*box.scale}px`;node.style.top=`${tile.top*box.scale}px`;node.style.width=`${tile.width*box.scale}px`;node.style.height=`${tile.height*box.scale}px`;}
  }
  function update(box,view){
   if(destroyed)return;
   last={box,view};const density=priority===0?(window.devicePixelRatio||1):math.galleryDensity(quality,box.scale,window.innerWidth,window.innerHeight,window.devicePixelRatio||1),wanted=math.plan(quality,box,view,density);
   if(!wanted.tiles.length)return;
   const started=performance.now(),nextSignature=[wanted.level.level,box.scale,box.x,box.y,...wanted.tiles.map(tile=>tile.key)].join('|');
   if(signature===nextSignature)return;
   const version=++token;signature=nextSignature;
   positions(box,wanted.tiles);
   onState({ready:false,level:wanted.level.level});
   const promises=wanted.tiles.map(tile=>get(tile.url,priority));
   const waitingReleases=wanted.tiles.map(tile=>pin(tile.url));
   const waiting={urls:wanted.tiles.map(tile=>tile.url),releases:waitingReleases};clearPending(new Set(waiting.urls));pendingGroups.add(waiting);
   Promise.all(promises).then(async images=>{
    if(destroyed||version!==token)return;
    const next=new Map(),nextGeometry=new Map(),nextReleases=[];
    wanted.tiles.forEach((tile,index)=>{
     const node=nodes.get(tile.key)||images[index].cloneNode();node.alt='';node.draggable=false;next.set(tile.key,node);nextGeometry.set(tile.key,{left:tile.left/box.scale,top:tile.top/box.scale,width:tile.width/box.scale,height:tile.height/box.scale});nextReleases.push(pin(tile.url));
    });
    try{await Promise.all([...next.values()].map(node=>node.decode()));}catch(error){nextReleases.forEach(release=>release());throw error;}
    if(destroyed||version!==token){nextReleases.forEach(release=>release());return;}
    releases.forEach(release=>release());releases=nextReleases;nodes=next;geometry=nextGeometry;
    layer.replaceChildren(...nodes.values());positions(box,wanted.tiles);layer.classList.add('is-ready');layer.dataset.readyMs=String(Math.round(performance.now()-started));layer.dataset.level=String(wanted.level.level);onState({ready:true,level:wanted.level.level});
    if(priority===0&&!warmedNative&&wanted.level.level>0){
     warmedNative=true;
     const nativeBox=window.PortfolioZoomMath.layout(view.width,view.height,quality.width,quality.height,1);
     const nativeView={left:Math.max(0,(quality.width-view.width)/2),top:Math.max(0,(quality.height-view.height)/2),width:view.width,height:view.height};
     for(const tile of math.plan(quality,nativeBox,nativeView,window.devicePixelRatio||1).tiles)void get(tile.url,2).catch(()=>{});
    }
    // A single surrounding ring is warmed at low priority, so nearby pan movement reuses native pixels.
    if(priority===0)for(const tile of math.plan(quality,box,view,window.devicePixelRatio||1,1).tiles){if(!cached(tile.url))void get(tile.url,2).catch(()=>{});}
   }).catch(()=>{if(!destroyed&&version===token){signature='';onState({ready:false,error:true,level:wanted.level.level});}}).finally(()=>{waitingReleases.forEach(release=>release());pendingGroups.delete(waiting);});
  }
  return{update,refresh(){signature='';if(last)update(last.box,last.view);},destroy(){destroyed=true;token++;clearPending();releases.forEach(release=>release());nodes.clear();layer.remove();}};
 }
 function initGallery(photos){
  const map=new Map(photos.filter(photo=>photo.quality).map(photo=>[String(photo.id),photo])),views=new Map(),nearby=new Set();let frame=0;
  function refresh(){
   frame=0;
   if(document.getElementById('photo-viewer')?.open)return;
   const candidates=[];
   for(const button of nearby){const rect=button.getBoundingClientRect();if(rect.bottom<0||rect.top>window.innerHeight||rect.right<0||rect.left>window.innerWidth)continue;candidates.push({button,rect,distance:Math.abs((rect.top+rect.bottom)/2-window.innerHeight/2)});}
   candidates.sort((a,b)=>a.distance-b.distance);
   for(const {button,rect} of candidates.slice(0,6)){
    const photo=map.get(button.dataset.photo),width=button.clientWidth,height=button.clientHeight;
    const scale=Math.min(width/photo.width,height/photo.height),box=window.PortfolioZoomMath.layout(width,height,photo.width,photo.height,scale);
    let view=views.get(button);
    if(!view){view=create(photo.quality,button,{priority:1});views.set(button,view);}
    view.update(box,{left:Math.max(0,-rect.left),top:Math.max(0,-rect.top),width:Math.min(rect.right,window.innerWidth)-Math.max(rect.left,0),height:Math.min(rect.bottom,window.innerHeight)-Math.max(rect.top,0)});
   }
   for(const [button,view] of views){const rect=button.getBoundingClientRect();if(rect.bottom<-window.innerHeight||rect.top>window.innerHeight*2){view.destroy();views.delete(button);}}
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(refresh);};
  const observer=new IntersectionObserver(changes=>{
   for(const change of changes){const button=change.target,photo=map.get(button.dataset.photo),scale=Math.min(button.clientWidth/photo.width,button.clientHeight/photo.height),density=math.galleryDensity(photo.quality,scale,window.innerWidth,window.innerHeight,window.devicePixelRatio||1),overview=math.overview(photo.quality,button.clientWidth,density);if(change.isIntersecting){nearby.add(button);if(overview&&!document.getElementById('photo-viewer')?.open)void get(overview.overview,2).catch(()=>{});}else{nearby.delete(button);views.get(button)?.destroy();views.delete(button);if(overview)cancel(overview.overview);}}
   schedule();
  },{rootMargin:'600px 0px'});
  for(const button of document.querySelectorAll('button[data-photo]'))if(map.has(button.dataset.photo))observer.observe(button);
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});document.getElementById('photo-viewer')?.addEventListener('close',schedule);
 }
 window.PortfolioQuality={create,get,cached,foreground,initGallery,overview:math.overview};
})();
