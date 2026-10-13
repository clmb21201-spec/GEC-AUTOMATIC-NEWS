'use strict';
// Lab.40 · Vista previa de Noticias con movimiento en la ventana del panel (output-news-motion-preview.html).
// Corre la salida clásica real (output.js + versionados + Lab.37/39) con un ECAPI de mentira alimentado por postMessage
// desde renderer-news-motion-lab37.js: el diseño guardado del perfil con la configuración que se está editando y tres
// noticias de ejemplo (newsMotion:preview). La voz es un WAV mudo con la duración de la nota; las fotos son ilustraciones.
(function(){
  const listeners=new Map();
  const emit=(c,p)=>{for(const cb of listeners.get(c)||[])try{cb(p);}catch{}};
  let design={},stories=[],index=0,serial=0,started=false;
  const noop=async()=>({ok:true});
  window.ECAPI=new Proxy({
    on:(c,cb)=>{if(typeof cb!=='function')return()=>{};if(!listeners.has(c))listeners.set(c,new Set());listeners.get(c).add(cb);return()=>listeners.get(c)?.delete(cb);},
    getSettings:async()=>({visual:{output:design}}),
    outputPlayback:e=>{if(e&&e.type==='ended'){const s=++serial;setTimeout(()=>{if(s===serial)play((index+1)%Math.max(1,stories.length));},500);}},
    presenterHostPlayback:()=>{}
  },{get:(t,k)=>k in t?t[k]:(k==='then'?undefined:noop)});

  // ---- ilustraciones de ejemplo (SVG)
  function rnd(seed){let s=seed;return()=>{s=(s*9301+49297)%233280;return s/233280;};}
  function photoStadium(){const r=rnd(7);let dots='';for(let i=0;i<260;i++){const x=r()*1600,y=250+r()*210-x*.025;dots+=`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(2+r()*3).toFixed(1)}" fill="${['#c8102e','#fff','#ffd54a','#9fb3d9'][i%4]}" opacity=".75"/>`;}
   let stripes='';for(let i=0;i<9;i++){const x0=i*200-100;stripes+=`<polygon points="${x0},900 ${x0+120},900 ${x0+160+i*4},${485-i*3} ${x0+100+i*4},${487-i*3}" fill="#2a8a45" opacity=".55"/>`;}
   let pl='';[[520,640,'#c8102e'],[600,700,'#c8102e'],[760,610,'#2d6b2f'],[880,690,'#c8102e'],[980,630,'#2d6b2f'],[1120,720,'#c8102e']].forEach(([x,y,c])=>{pl+=`<g transform="translate(${x},${y})"><circle cy="-46" r="11" fill="#f2c9a0"/><rect x="-12" y="-34" width="24" height="34" rx="6" fill="${c}"/><rect x="-10" y="0" width="8" height="26" fill="#111"/><rect x="2" y="0" width="8" height="26" fill="#111"/></g>`;});
   return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="skA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070d1e"/><stop offset="1" stop-color="#253a66"/></linearGradient><radialGradient id="glA"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="1600" height="900" fill="url(#skA)"/><polygon points="0,240 1600,200 1600,470 0,505" fill="#161d33"/>${dots}<rect x="190" y="40" width="10" height="200" fill="#333"/><rect x="1390" y="30" width="10" height="190" fill="#333"/><circle cx="195" cy="60" r="150" fill="url(#glA)" opacity=".7"/><circle cx="1395" cy="50" r="150" fill="url(#glA)" opacity=".7"/><polygon points="0,505 1600,470 1600,900 0,900" fill="#1e7a3a"/>${stripes}<g stroke="#fff" stroke-width="5" fill="none" opacity=".85"><line x1="790" y1="473" x2="820" y2="900"/><ellipse cx="805" cy="660" rx="190" ry="70"/><polyline points="0,600 260,595 300,900"/></g><circle cx="700" cy="760" r="14" fill="#fff"/>${pl}</svg>`;}
  function photoMarket(){const r=rnd(11);let c='',line='',y=300;for(let i=0;i<34;i++){const x=60+i*45,o=y,cl=y+(r()*70-25),h=Math.max(o,cl)+r()*30,l=Math.min(o,cl)-r()*30,up=cl<o;c+=`<line x1="${x}" y1="${l.toFixed(0)}" x2="${x}" y2="${h.toFixed(0)}" stroke="${up?'#2ecc71':'#ff4757'}" stroke-width="3"/><rect x="${x-13}" y="${Math.min(o,cl).toFixed(0)}" width="26" height="${Math.max(6,Math.abs(cl-o)).toFixed(0)}" fill="${up?'#2ecc71':'#ff4757'}"/>`;line+=`${x},${(cl+40).toFixed(0)} `;y=cl;}
   let grid='';for(let i=1;i<9;i++)grid+=`<line x1="0" y1="${i*100}" x2="1600" y2="${i*100}" stroke="#c3cfdf"/>`;for(let i=1;i<16;i++)grid+=`<line x1="${i*100}" y1="0" x2="${i*100}" y2="900" stroke="#cfd9e7"/>`;
   return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="mkB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fb"/><stop offset="1" stop-color="#c9d7ea"/></linearGradient></defs><rect width="1600" height="900" fill="url(#mkB)"/>${grid}<text x="1180" y="760" font-size="620" font-weight="900" fill="#d6e1f0" font-family="Arial">$</text>${c}<polyline points="${line}" fill="none" stroke="#c99700" stroke-width="5" opacity=".9"/><rect x="0" y="820" width="1600" height="80" fill="#ffffff"/><g font-family="Arial" font-weight="700" font-size="34" fill="#4a5d7a"><text x="40" y="872">USD/PEN</text><text x="300" y="872" fill="#ff4757">▼ 0,42 %</text><text x="560" y="872">COBRE</text><text x="760" y="872" fill="#2ecc71">▲ 1,8 %</text><text x="1000" y="872">BVL</text><text x="1140" y="872" fill="#2ecc71">▲ 0,6 %</text></g></svg>`;}
  function photoCongress(){let cols='';for(let i=0;i<8;i++)cols+=`<rect x="${470+i*85}" y="400" width="40" height="260" fill="#e9e2d0"/><rect x="${462+i*85}" y="390" width="56" height="16" fill="#d8cfb8"/>`;
   const r=rnd(3);let ppl='';for(let i=0;i<90;i++){const x=r()*1600,y=760+r()*120;ppl+=`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(7+r()*5).toFixed(1)}" fill="${['#1b1b2a','#3a2f2a','#c8102e','#e8e8e8','#2c3e50'][i%5]}"/>`;}
   return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="skC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1d4a"/><stop offset=".55" stop-color="#c0566b"/><stop offset="1" stop-color="#f3a35b"/></linearGradient></defs><rect width="1600" height="900" fill="url(#skC)"/><ellipse cx="800" cy="250" rx="130" ry="120" fill="#d9d0bb"/><rect x="760" y="110" width="80" height="40" fill="#cfc6b0"/><rect x="796" y="60" width="8" height="60" fill="#444"/><path d="M804 62h60v14h-60z" fill="#d0102b"/><path d="M804 76h60v12h-60z" fill="#fff"/><path d="M804 88h60v12h-60z" fill="#d0102b"/><polygon points="430,390 800,280 1170,390" fill="#e3dbc6"/><rect x="430" y="380" width="740" height="22" fill="#cfc6b0"/>${cols}<rect x="400" y="660" width="800" height="30" fill="#cfc6b0"/><rect x="370" y="690" width="860" height="30" fill="#bfb6a0"/><rect x="0" y="720" width="1600" height="180" fill="#5d5650"/>${ppl}<rect x="0" y="380" width="380" height="340" fill="#3b3346" opacity=".8"/><rect x="1220" y="380" width="380" height="340" fill="#3b3346" opacity=".8"/></svg>`;}
  const PHOTO={deportes:photoStadium,economia:photoMarket,exclusiva:photoCongress},photoCache={};
  const photoUrl=k=>photoCache[k]||(photoCache[k]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent((PHOTO[k]||photoMarket)().replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" ')));

  // ---- voz muda: WAV de 8 kHz con la duración de la nota
  const wavCache={};
  function silentWav(sec){
    const k=Math.ceil(sec*10);if(wavCache[k])return wavCache[k];
    const rate=8000,n=Math.ceil(rate*k/10),buf=new ArrayBuffer(44+n*2),v=new DataView(buf),w=(o,str)=>{for(let i=0;i<str.length;i++)v.setUint8(o+i,str.charCodeAt(i));};
    w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
    return(wavCache[k]=URL.createObjectURL(new Blob([buf],{type:'audio/wav'})));
  }
  function play(i){
    if(!stories.length)return;index=i;serial++;const s=stories[i];
    emit('output:story',{...s,image:photoUrl(s.key),fallbackImage:'',preloadImage:'',audioUrl:silentWav(s.audioDurationSec)});
    report();
  }
  function report(){try{const st=window.__gecNewsMotionOutput?.state?.()||{};parent.postMessage({type:'gec-nm-preview-state',index,plane:st.plane||'',on:!!st.on,time:Number(document.getElementById('audio')?.currentTime)||0},'*');}catch{}}
  setInterval(report,400);
  window.addEventListener('message',e=>{
    const m=e.data;if(!m||m.type!=='gec-nm-preview')return;
    if(m.design){design={...m.design,musicEnabled:false,musicUrl:'',standbyVideo:'',standbyVideoUrl:''};emit('output:design',design);}
    if(Array.isArray(m.stories))stories=m.stories;
    if(m.play!=null||!started){started=true;play(Math.max(0,Math.min(stories.length-1,Number(m.play)||0)));}
    if(m.control)emit('output:control',m.control);
  });
  window.__gecNmPreview={play:i=>play(i),state:()=>({index,stories:stories.length})};
})();
