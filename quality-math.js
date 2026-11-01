(() => {
 'use strict';
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function levelFor(quality,scale,dpr=1){
  const wanted=Math.max(0,Math.floor(-Math.log2(Math.max(.00001,scale*Math.max(2,dpr)))));
  return quality.levels[Math.min(wanted,quality.levels.length-1)];
 }
 function plan(quality,box,view,dpr=1,margin=0){
  const level=levelFor(quality,box.scale,dpr),factor=2**level.level,size=quality.tileSize;
  const left=clamp((view.left-box.x)/box.scale/factor,0,level.width),top=clamp((view.top-box.y)/box.scale/factor,0,level.height);
  const right=clamp((view.left+view.width-box.x)/box.scale/factor,0,level.width),bottom=clamp((view.top+view.height-box.y)/box.scale/factor,0,level.height);
  if(right<=left||bottom<=top)return{level,tiles:[]};
  if(level.overview)return{level,tiles:[{x:0,y:0,key:`${level.level}/overview`,url:level.overview,left:0,top:0,width:box.imageWidth,height:box.imageHeight}]};
  const startX=clamp(Math.floor(left/size)-margin,0,level.columns-1),startY=clamp(Math.floor(top/size)-margin,0,level.rows-1);
  const endX=clamp(Math.floor((right-.000001)/size)+margin,0,level.columns-1),endY=clamp(Math.floor((bottom-.000001)/size)+margin,0,level.rows-1);
  const tiles=[];
  for(let y=startY;y<=endY;y++)for(let x=startX;x<=endX;x++){
   const x0=Math.max(0,x*size-quality.overlap),y0=Math.max(0,y*size-quality.overlap),x1=Math.min(level.width,(x+1)*size+quality.overlap),y1=Math.min(level.height,(y+1)*size+quality.overlap);
   tiles.push({x,y,key:`${level.level}/${x}-${y}`,url:`${quality.base}/${level.level}/${x}-${y}`,left:x0*factor*box.scale,top:y0*factor*box.scale,width:(x1-x0)*factor*box.scale,height:(y1-y0)*factor*box.scale});
  }
  return{level,tiles};
 }
 function overview(quality,width,dpr=1){
  const available=quality.levels.filter(level=>level.overview).sort((a,b)=>a.width-b.width);
  return available.find(level=>level.width>=width*Math.max(2,dpr))||available.at(-1)||null;
 }
 function galleryDensity(quality,scale,viewWidth,viewHeight,dpr=1){
  const density=Math.max(2,dpr);
  if(!viewWidth||!viewHeight||!quality.width||!quality.height||!scale)return density;
  const openedScale=Math.min(1,Math.max(1,viewWidth-(viewWidth<=760?30:160))/quality.width,Math.max(1,viewHeight-190)/quality.height);
  return density*Math.max(1,openedScale/scale);
 }
 window.PortfolioQualityMath={levelFor,plan,overview,galleryDensity};
})();
