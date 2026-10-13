'use strict';
// Lab.38 · Intervenciones en la salida clásica (output.html y output-web.html). presenterHost manda p.kind === 'host'
// (segment intro | titulares | pase | regreso | despedida) con la voz ya generada; aquí se dibuja la placa elegida para el
// perfil (design.classicHost) con su fondo, se reproduce la voz en #audio y al terminar se avisa con
// ECAPI.presenterHostPlayback — nunca con outputPlayback, que es para noticias, contenidos y anuncios.
// No modifica output.js: envuelve showStory y showCanned (que siguen igual para todo lo que no es una intervención).
(function installClassicHostLab38(){
  if(!window.__ecOutput0326||!window.__ec0331OutputInstalled||!window.GECClassicHostRender||typeof showStory!=='function'||typeof showCanned!=='function'||typeof setStoryContent!=='function'){setTimeout(installClassicHostLab38,60);return;}
  if(window.__gecClassicHostLab38)return;window.__gecClassicHostLab38=true;
  const stageEl=document.getElementById('stage'),audioEl=document.getElementById('audio'),musicEl=document.getElementById('music');
  if(!stageEl||!audioEl)return;
  const SEG={intro:'intro',titulares:'tit',pase:'pase',regreso:'reg',despedida:'desp'};
  const layer=document.createElement('div');layer.id='chLayer';stageEl.appendChild(layer);
  let ctl=null,cur=null,raf=0,hideTimer=null,ended=false;
  const cfg=()=>(typeof design!=='undefined'&&design&&design.classicHost)||{};
  const report=(type,message='')=>{try{window.ECAPI.presenterHostPlayback?.({type,segment:cur?.segment||'',message});}catch{}};

  function dataFor(p){
    const c=cfg(),bg=c.background||{};
    return{program:c.program||'',logoUrl:c.logoUrl||'',closing:c.closing||{},nextEmission:p.nextEmission||'',
      heads:(Array.isArray(p.headlines)&&p.headlines.length?p.headlines:p.upcoming)||[],next:p.next||null,
      bg:{mode:bg.mode,url:bg.url,video:bg.video,standbyUrl:typeof design!=='undefined'?design.standbyVideoUrl||'':''},
      text:p.hostText||'',segments:p.speechSegments||null,marks:p.headlineMarks||null,duration:Number(p.audioDurationSec)||0};
  }
  function loop(){raf=0;if(!ctl||!cur)return;ctl.update(Number(audioEl.currentTime)||0);if(!audioEl.paused&&!audioEl.ended)raf=requestAnimationFrame(loop);}
  function hide(delay=0){clearTimeout(hideTimer);hideTimer=setTimeout(()=>{layer.style.transition='opacity .5s ease';layer.style.opacity='0';setTimeout(()=>{if(cur)return;layer.classList.remove('on');layer.style.opacity='';ctl?.destroy();ctl=null;},520);},delay);}
  async function showHost(p,serial){
    clearTimeout(hideTimer);if(raf){cancelAnimationFrame(raf);raf=0;}
    const seg=SEG[p.segment]||'intro',c=cfg(),letter=String(c.versions?.[seg]||'A').toUpperCase(),v=Math.max(0,'ABC'.indexOf(letter));
    cur=p;ended=false;activeKind='host';stageEl.dataset.kind='host';
    try{audioEl.pause();}catch{}
    ctl?.destroy();ctl=window.GECClassicHostRender.mount(layer,{seg,v,fmt:design.format==='9:16'?'v':'h',tt:design.format==='9:16'&&!!design.tiktokSafe,data:dataFor(p)});
    layer.classList.remove('paused');layer.style.transition='opacity .45s ease';layer.style.opacity='0';layer.classList.add('on');layer.getBoundingClientRect();layer.style.opacity='1';
    // música: la de la emisión más baja, o en silencio, según el perfil
    try{if(c.music==='none')musicEl.pause();else{await startMusicForNews();const base=Math.max(0,Math.min(100,Number(design.musicVolume??20)))/100;musicEl.volume=Math.max(0,Math.min(1,base*.45));}}catch{}
    if(serial!==contentSerial)return;
    if(!p.audioUrl){ended=true;setTimeout(()=>report('ended'),1200);return;}
    const gain=Math.pow(10,(Number(p.audioGainDb)||0)/20),vol=Math.max(0,Math.min(100,Number(design.voiceVolume??100)))/100;
    audioEl.src=p.audioUrl;try{audioEl.currentTime=Math.max(0,Number(p.startAtSec)||0);}catch{}audioEl.volume=Math.max(0,Math.min(1,vol*gain));
    try{await audioEl.play();}catch(e){if(serial===contentSerial){ended=true;report('error',e.message||'No se pudo reproducir la voz');}return;}
    loop();
  }
  audioEl.addEventListener('ended',()=>{if(activeKind==='host'&&cur&&!ended){ended=true;ctl?.update(Number(audioEl.duration)||0);report('ended');}});
  audioEl.addEventListener('error',()=>{if(activeKind==='host'&&cur&&!ended&&audioEl.getAttribute('src')){ended=true;report('error','No se pudo cargar la voz');}});
  audioEl.addEventListener('play',()=>{if(activeKind==='host'&&!raf)loop();});
  audioEl.addEventListener('seeked',()=>{if(activeKind==='host'&&ctl)ctl.update(audioEl.currentTime);});

  // todo lo que no es intervención sigue por el camino de siempre; la placa se retira cuando lo nuevo ya está listo
  const baseShowStory=showStory;
  showStory=async function(p,serial){
    if(p&&p.kind==='host')return showHost(p,serial);
    const wasHost=!!cur;cur=null;
    const r=await baseShowStory.apply(this,arguments);
    if(wasHost)hide(0);
    return r;
  };
  const baseShowCanned=showCanned;
  showCanned=async function(p,serial){
    const wasHost=!!cur;cur=null;if(wasHost){try{audioEl.pause();}catch{}}
    const r=await baseShowCanned.apply(this,arguments);
    if(wasHost)hide(0);
    return r;
  };
  window.ECAPI.on('output:control',a=>{
    if(!cur)return;
    layer.classList.toggle('paused',a==='pause');
    if(a==='play')loop();
    // detener: el loop de espera entra por encima; la placa se retira debajo
    if(a==='stop'){cur=null;hide(1200);}
  });
  window.__gecClassicHostOutput={state:()=>({on:layer.classList.contains('on'),segment:cur?.segment||'',ended})};
})();
