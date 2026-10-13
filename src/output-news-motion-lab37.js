'use strict';
// Lab.37 · Noticias con movimiento en la salida clásica (output.html y output-web.html). No reescribe la salida: se monta
// encima de setStoryContent / revealStoryFromStory y dibuja su propia capa (#nmLayer) dentro de #storyLayer.
// - Planos que cambian solo en las pausas de la voz (p.motion.sentences[].cut): foto completa, recuadro, detalle y
//   dato en grande (la cifra principal, en la oración que la nombra). Mínimo por plano según el nivel del perfil.
// - Datos clave (p.motion.facts) que entran cuando la voz los nombra; indicador de voz que sigue los tramos con voz
//   del WAV; barra de progreso; reloj; ticker (p.motion.ticker); golpe de marca entre noticias; exclusivo.
// - Colores y tipografías del Diseño del perfil; los colores del movimiento salen del Diseño o del perfil (newsMotion).
// La línea de tiempo es el audio de la voz (audio.currentTime): pausa, retoma y entra a mitad de nota (LAN) sin desfase.
(function installNewsMotionLab37(){
  if(!window.__ecOutput0326||!window.__ec0331OutputInstalled||typeof setStoryContent!=='function'||typeof revealStoryFromStory!=='function'||typeof applyDesign!=='function'){setTimeout(installNewsMotionLab37,60);return;}
  if(window.__gecNewsMotionLab37)return;window.__gecNewsMotionLab37=true;
  const stageEl=document.getElementById('stage'),storyEl=document.getElementById('storyLayer'),audioEl=document.getElementById('audio'),imgEl=document.getElementById('image');
  if(!stageEl||!storyEl||!audioEl)return;
  const MIN={sobrio:9,normal:6,dinamico:4},ICON={
    cifra:'<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h6v6" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
    marcador:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z" fill="currentColor"/></svg>',
    persona:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.2" fill="currentColor"/><path d="M3.5 21c.8-4.6 4.3-7 8.5-7s7.7 2.4 8.5 7z" fill="currentColor"/></svg>',
    lugar:'<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>',
    institucion:'<svg viewBox="0 0 24 24"><path d="M12 2 2 7v2h20V7zM4 11h3v7H4zm6.5 0h3v7h-3zM17 11h3v7h-3zM2 20h20v2H2z" fill="currentColor"/></svg>',
    fecha:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2.6"/></svg>'};
  const KICK={cifra:'EL DATO',marcador:'RESULTADO'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hex=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):null;
  const rgba=(h,a)=>{const n=parseInt(String(h||'#000000').slice(1),16);return Number.isNaN(n)?`rgba(0,0,0,${a})`:`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;};
  const same=(a,b)=>String(a||'').toLowerCase()===String(b||'').toLowerCase();

  const layer=document.createElement('div');layer.id='nmLayer';
  layer.innerHTML='<div class="nm-planes"></div><div class="nm-cards"></div><div class="nm-clock"></div><div class="nm-ticker"><div class="lb"></div><div class="vp"><div class="tr"></div></div></div><div class="nm-wipe"><i></i><i></i></div>';
  storyEl.appendChild(layer);
  const sting=document.createElement('div');sting.id='nmSting';sting.innerHTML='<div class="cv"></div><i></i><i></i><i></i><div class="nx"></div>';
  stageEl.appendChild(sting);
  const $=s=>layer.querySelector(s),planesEl=$('.nm-planes'),cardsEl=$('.nm-cards'),clockEl=$('.nm-clock'),wipeEl=$('.nm-wipe');

  let cur=null,plan=[],curPlane=-1,raf=0,lastClock='',pendingP=null,paused=false,scale=1;
  const cfg=()=>{const m=(typeof design!=='undefined'&&design)?design.newsMotion:null;return m&&typeof m==='object'?m:null;};
  const enabled=()=>{const m=cfg();return !!(m&&m.enabled!==false);};
  // nivel: mínimo por plano, barrido o fundido y planos permitidos (Personalizado los elige el operador)
  const lvl=()=>{const m=cfg()||{};if(m.level==='custom'){const c=m.custom||{};return{min:Math.max(3,Math.min(15,Number(c.minSec)||6)),wipe:c.transition!=='fade',planes:c.planes||{}};}return{min:MIN[m.level]||6,wipe:m.level!=='sobrio',planes:{}};};
  const motionFor=p=>enabled()&&p&&(p.kind||'news')==='news'&&p.motion&&Array.isArray(p.motion.sentences);
  const exclusiveOn=p=>!!p?.isExclusive&&design.exclusiveEnabled!==false&&design.exclusiveBadgeVisible!==false;
  const exText=()=>String(design.exclusiveText||'EXCLUSIVO').slice(0,32);

  // ---------------------------------------------------------------- colores
  function applyColors(){
    const m=cfg()||{},c=m.colors||{},catBg=hex(design.categoryBgColor)||'#F7C600',catTx=hex(design.categoryTextColor)||'#000000',exBg=hex(design.exclusiveBgColor)||'#F7C600',lower=hex(design.lowerBgColor)||'#000000',title=hex(design.titleColor)||'#FFFFFF';
    const auto={bar1:catBg,bar2:same(exBg,catBg)?title:exBg,bar3:lower,voiceBg:lower,voiceBars:catBg,tickerBg:catBg,tickerText:catTx};
    const pick=k=>c.mode==='custom'&&hex(c[k])?c[k]:auto[k];
    const set=(k,v)=>{layer.style.setProperty(k,v);sting.style.setProperty(k,v);};
    set('--nm-b1',pick('bar1'));set('--nm-b2',pick('bar2'));set('--nm-b3',pick('bar3'));set('--nm-vb',pick('voiceBg'));set('--nm-vbt',pick('voiceBars'));
    set('--nm-tk',pick('tickerBg'));set('--nm-tkt',pick('tickerText'));set('--nm-cov',lower);
    const op=Math.max(.55,Math.min(1,Number(design.lowerOpacity)||.88));set('--nm-lw',rgba(lower,op));set('--nm-lw2',rgba(lower,Math.min(1,op+.06)));
    layer.className=[!lvl().wipe?'sobrio':'',m.voice===false?'novoice':'',m.clock===false?'noclock':'',m.progress===false?'noprog':'',layer.classList.contains('nm-ps')?'nm-ps':''].filter(Boolean).join(' ');
    updateTickerVisibility();
  }

  // ---------------------------------------------------------------- planos
  function heroOf(p){return(p.motion.facts||[]).find(f=>f.main&&(f.type==='cifra'||f.type==='marcador'))||null;}
  function buildPlan(p){
    const m=p.motion,s=m.sentences||[],D=Number(audioEl.duration)>0?audioEl.duration:(Number(p.audioDurationSec)||s[s.length-1]?.end||30);
    scale=!(Array.isArray(m.segments)&&m.segments.length)&&s.length&&s[s.length-1].end>0?D/s[s.length-1].end:1;
    const L=lvl(),min=L.min,on=k=>L.planes[k]!==false,hasImg=!!imgSrc(),hero=on('dato')?heroOf(p):null,heroSi=hero?hero.si:-1;
    // cortes posibles: fin de cada oración y, dentro de oraciones largas, las pausas de la voz de 0,35 s o más
    const cuts=[];for(let i=1;i<s.length;i++)cuts.push({t:(Number(s[i].cut)||0)*scale,si:i});
    const segs=Array.isArray(m.segments)?m.segments:[];for(let i=0;i+1<segs.length;i++){const g=segs[i+1][0]-segs[i][1];if(g>=.35){const t=(segs[i][1]+segs[i+1][0])/2;if(!cuts.some(c=>Math.abs(c.t-t)<.6))cuts.push({t,si:-1});}}
    cuts.sort((a,b)=>a.t-b.t);
    let cyc=hasImg?['side','zoom','full'].filter(on):(on('full')?['full']:[]);if(!cyc.length)cyc=[hasImg&&on('side')?'side':hasImg&&on('zoom')?'zoom':'full'];
    const out=[{start:0,type:on('full')||!hasImg?'full':cyc[0]}];let ci=0,last=0;
    for(const c of cuts){const b=c.t,prev=out[out.length-1].type;
      if(c.si>0&&c.si===heroSi&&b-last>=2.5&&b<D-2.5){out.push({start:b,type:'dato'});last=b;continue;}
      // el dato en grande dura lo justo (desde 3 s); el resto respeta el mínimo del nivel
      if(b-last>=(prev==='dato'?3:min)&&b<D-3){let ty=cyc[ci++%cyc.length];if(ty===prev&&cyc.length>1)ty=cyc[ci++%cyc.length];if(ty===prev)continue;out.push({start:b,type:ty});last=b;}}
    out.forEach((x,i)=>x.end=i+1<out.length?out[i+1].start:Math.max(x.start+1,D));
    return out;
  }
  function imgSrc(){return imgEl&&imgEl.naturalWidth>0?(imgEl.currentSrc||imgEl.src||''):'';}
  const vb='<span class="nm-vb">'+'<i></i>'.repeat(5)+'</span>';
  function metaHTML(p,withDate){
    const cat=design.categoryVisible===false?'':`<span class="nm-cat">${esc(String(p.category||'ACTUALIDAD').toUpperCase())}</span>`;
    const ex=exclusiveOn(p)?`<span class="nm-ex">${esc(exText())}</span>`:'';
    const date=withDate&&design.dateVisible!==false&&typeof formatDate==='function'?formatDate(p.pubDate||p.date||''):'';
    return`<div class="nm-meta">${vb}${cat}${ex}${date?`<span class="nm-date">${esc(date)}</span>`:''}</div>`;
  }
  function planeHTML(p,pl,idx){
    const src=imgSrc(),im=src?`<img src="${esc(src)}" alt="">`:'',pd=`--pd:${(pl.end-pl.start+1.2).toFixed(1)}s`;
    const title=esc(p.title||''),sum=esc(p.summary||''),prog='<div class="nm-prog"><b></b></div>';
    const stamp=idx===0&&exclusiveOn(p)?`<div class="nm-stamp">${esc(exText())}</div>`:'';
    if(pl.type==='side')return`<div class="nm-pl nm-side" style="${pd}"><div class="nm-blur">${im}</div><div class="nm-col">${metaHTML(p,false)}<div class="nm-ttl">${title}</div><div class="nm-sum">${sum}</div>${design.dateVisible!==false&&typeof formatDate==='function'&&formatDate(p.pubDate||p.date||'')?`<span class="nm-date">${esc(formatDate(p.pubDate||p.date||''))}</span>`:''}${prog}</div><div class="nm-frame"><div class="nm-ph nm-kb">${im}</div></div></div>`;
    if(pl.type==='zoom')return`<div class="nm-pl nm-zoom" style="${pd}"><div class="nm-ph nm-zm">${im}</div><div class="nm-shade2"></div><div class="nm-strip">${metaHTML(p,false)}<span class="nm-t">${title}</span>${prog}</div></div>`;
    if(pl.type==='dato'){const h=heroOf(p);return`<div class="nm-pl nm-dato" style="${pd}"><div class="nm-blur">${im}</div><div class="nm-dim"></div><div class="nm-hero"><div class="k">${esc(KICK[h.type]||'EL DATO')}</div><div class="n">${esc(h.big)}</div><div class="s">${esc(h.label||'')}</div><div class="bar"></div></div><div class="nm-strip">${metaHTML(p,false)}<span class="nm-t">${title}</span>${prog}</div></div>`;}
    return`<div class="nm-pl nm-full" style="${pd}"><div class="nm-ph nm-kb">${im}</div><div class="nm-shade"></div><div class="nm-l3">${metaHTML(p,true)}<div class="nm-ttl">${title}</div>${sum?`<div class="nm-sum">${sum}</div>`:''}${prog}</div>${stamp}</div>`;
  }
  function showPlane(i,first){
    const pl=plan[i];if(!pl||!cur)return;
    const tmp=document.createElement('div');tmp.innerHTML=planeHTML(cur,pl,i);const el=tmp.firstElementChild;
    // el primer plano de cada nota aparece de una vez (sin fundido desde negro); sus textos entran con su animación
    if(first){el.style.setProperty('--dl','.3s');el.style.animation='none';}
    const old=[...planesEl.children];planesEl.appendChild(el);
    if(first)old.forEach(o=>o.remove());else setTimeout(()=>old.forEach(o=>o.remove()),lvl().wipe?620:800);
    layer.classList.toggle('nm-ps',pl.type==='side');
    if(!first&&lvl().wipe){wipeEl.classList.remove('go');void wipeEl.offsetWidth;wipeEl.classList.add('go');}
    const hn=el.querySelector('.nm-hero .n');if(hn)requestAnimationFrame(()=>{let f=parseFloat(getComputedStyle(hn).fontSize)||200,k=0;while(hn.scrollWidth>hn.clientWidth+1&&k++<40){f*=.93;hn.style.fontSize=f+'px';}});
  }

  // ---------------------------------------------------------------- datos clave y ticker
  function renderCards(p){
    const hero=plan.some(x=>x.type==='dato')?heroOf(p):null;
    cardsEl.innerHTML=(p.motion.facts||[]).filter(f=>f!==hero).map((f,i)=>`<div class="nm-card" data-at="${(+f.at||0)*scale}" data-until="${(+f.until||0)*scale}"><div class="ic">${ICON[f.type]||ICON.cifra}</div><div style="min-width:0"><div class="big">${esc(f.big)}</div>${f.label?`<div class="lb">${esc(f.label)}</div>`:''}</div></div>`).join('');
  }
  function renderTicker(p){
    const m=cfg()||{},t=m.ticker||{},items=Array.isArray(p.motion.ticker)?p.motion.ticker:[];
    layer.querySelector('.nm-ticker .lb').textContent=String(t.label||'ÚLTIMO');
    const one=items.map(x=>`<span class="${x.src==='op'?'op':''}">${x.ex?`<b class="tx">${esc(exText())}</b>`:''}${esc(x.t)}</span>`).join('');
    const tr=layer.querySelector('.nm-ticker .tr');tr.innerHTML=one+one;tr.style.animationDuration=Math.max(20,items.reduce((a,x)=>a+String(x.t).length,0)*.16)+'s';
    layer.dataset.tickerItems=String(items.length);updateTickerVisibility();
  }
  function updateTickerVisibility(){const m=cfg()||{};layer.classList.toggle('noticker',m.ticker?.enabled===false||!(+layer.dataset.tickerItems>0));}

  // ---------------------------------------------------------------- bucle (sigue al audio de la voz)
  function voiced(t){const segs=cur?.motion?.segments||cur?.speechSegments;if(!Array.isArray(segs)||!segs.length)return !audioEl.paused;for(const s of segs){if(t<s[0])return false;if(t<=s[1])return true;}return false;}
  function tick(){
    raf=0;if(!cur||!stageEl.classList.contains('nm-on')||(typeof activeKind!=='undefined'&&activeKind==='canned'))return;
    const t=Number(audioEl.currentTime)||0,D=Number(audioEl.duration)>0?audioEl.duration:(Number(cur.audioDurationSec)||1);
    let pi=plan.length-1;for(let i=0;i<plan.length;i++){if(t<plan[i].end){pi=i;break;}}
    if(pi!==curPlane){const first=curPlane===-1;curPlane=pi;showPlane(pi,first);}
    const dato=plan[pi]?.type==='dato';
    for(const c of cardsEl.children){const on=!dato&&t>=+c.dataset.at&&t<+c.dataset.until;if(c.classList.contains('on')!==on)c.classList.toggle('on',on);}
    const pr=(Math.min(1,Math.max(0,t/D))*100).toFixed(2)+'%';for(const b of planesEl.querySelectorAll('.nm-prog b'))b.style.width=pr;
    const live=!audioEl.paused&&!paused&&voiced(t),last=planesEl.lastElementChild;
    if(last)last.querySelectorAll('.nm-vb i').forEach((i,b)=>{const x=t*8.5+b*1.9,a=live?.22+.78*Math.abs(Math.sin(x)*Math.cos(x*.47+b)*Math.sin(x*.29+b*.6+1)):.15;i.style.transform=`scaleY(${a.toFixed(3)})`;});
    updateClock();
    if(audioEl.paused||audioEl.ended)return;// un último cuadro (barras en reposo) y se detiene; 'play' lo reanuda
    raf=requestAnimationFrame(tick);
  }
  function updateClock(){const d=new Date();let h=d.getHours();const mm=String(d.getMinutes()).padStart(2,'0'),ap=h>=12?'PM':'AM';h=h%12||12;const ck=`${h}<span class="c">:</span>${mm} ${ap}`;if(ck!==lastClock){lastClock=ck;clockEl.innerHTML=ck;}}
  setInterval(()=>{if(cur)updateClock();},1000);
  const loop=()=>{if(!raf)raf=requestAnimationFrame(tick);};

  // ---------------------------------------------------------------- montar / desmontar
  function mount(p){
    cur=p;curPlane=-1;planesEl.innerHTML='';applyColors();plan=buildPlan(p);renderCards(p);renderTicker(p);
    stageEl.classList.add('nm-on');loop();
  }
  function unmount(){cur=null;plan=[];curPlane=-1;stageEl.classList.remove('nm-on');planesEl.innerHTML='';cardsEl.innerHTML='';if(raf){cancelAnimationFrame(raf);raf=0;}}
  function playSting(p){
    sting.classList.toggle('exc',exclusiveOn(p));
    sting.querySelector('.nx').textContent=exclusiveOn(p)?exText():String(p?.category||'ACTUALIDAD').toUpperCase();
    clearTimeout(playSting.t);sting.classList.remove('go');void sting.offsetWidth;sting.classList.add('go','cover');
  }
  function endSting(){sting.classList.remove('cover');clearTimeout(playSting.t);playSting.t=setTimeout(()=>sting.classList.remove('go'),900);}

  window.ECAPI.on('output:story',p=>{pendingP=p;});
  window.ECAPI.on('output:control',a=>{paused=a==='pause'||a==='stop';stageEl.classList.toggle('nm-paused',paused);if(a==='play')loop();});
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  const baseSet=setStoryContent;
  setStoryContent=async function(p){
    const r=await baseSet(p);
    try{paused=false;stageEl.classList.remove('nm-paused');if(motionFor(p))mount(p);else unmount();}catch(e){unmount();}
    return r;
  };
  // entre noticia y noticia: golpe de marca (si está activo) o fundido de la capa con movimiento
  const baseReveal=revealStoryFromStory;
  revealStoryFromStory=async function(updateFn){
    await null;// el payload nuevo llega a pendingP en el mismo evento
    const p=pendingP;
    if(!stageEl.classList.contains('nm-on')||!motionFor(p))return baseReveal(updateFn);
    if((cfg()||{}).sting!==false){applyColors();playSting(p);try{await sleep(430);await updateFn();}finally{endSting();}return;}
    const snap=layer.cloneNode(true);snap.removeAttribute('id');snap.className='';snap.style.cssText+=';position:absolute;inset:0;z-index:5;display:block;transition:opacity .6s ease-in-out';
    stageEl.appendChild(snap);await updateFn();snap.getBoundingClientRect();snap.style.opacity='0';await sleep(650);snap.remove();
  };
  // al cambiar el Diseño o la configuración del perfil: colores al instante; si se activa o desactiva, se rearma
  const baseApply=applyDesign;
  applyDesign=function(next={}){
    const r=baseApply(next);
    try{if(cur&&!enabled())unmount();else if(cur){applyColors();layer.querySelector('.nm-ticker .lb').textContent=String((cfg()||{}).ticker?.label||'ÚLTIMO');}else if(enabled()&&activeKind==='news'&&motionFor(pendingP))mount(pendingP);}catch{}
    return r;
  };
  // si la imagen cambia (respaldo por error de carga), los planos siguientes usan la nueva
  if(imgEl)imgEl.addEventListener('load',()=>{if(cur&&curPlane===0&&!planesEl.querySelector('img')){curPlane=-1;plan=buildPlan(cur);renderCards(cur);loop();}});
  audioEl.addEventListener('loadedmetadata',()=>{if(cur){const keep=curPlane;plan=buildPlan(cur);renderCards(cur);if(keep>=plan.length)curPlane=-1;}});
  audioEl.addEventListener('play',loop);audioEl.addEventListener('seeked',loop);
  window.__gecNewsMotionOutput={state:()=>({on:stageEl.classList.contains('nm-on'),plane:plan[curPlane]?.type||'',planes:plan.map(x=>[x.type,+x.start.toFixed(2)]),cards:cardsEl.children.length})};
})();
