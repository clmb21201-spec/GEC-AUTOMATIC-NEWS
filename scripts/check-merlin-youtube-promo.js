'use strict';
// Regresión: la promo de YouTube de los contenidos vinculados también debe verse en la salida de Merlín
// (ventana y LAN /merlin). Antes solo se inyectaba en output.html y en Merlín nunca aparecía.
const fs=require('fs'),path=require('path'),vm=require('vm'),src=path.join(__dirname,'..','src');
const read=f=>fs.readFileSync(path.join(src,f),'utf8');
const PROMO_CSS=['output-youtube-promo.css','output-youtube-promo-v2-lab29.css','output-stabilization-lab28.css'];
const PROMO_JS=['output-youtube-promo.js','output-youtube-promo-v2-lab29.js'];
const lan=read('services/outputLanServer.js'),staticBlock=(lan.match(/const STATIC_FILES=new Set\(\[([\s\S]*?)\]\);/)||[])[1]||'';
const lanFiles=new Set([...staticBlock.matchAll(/'([^']+)'/g)].map(m=>m[1]));
if(!lanFiles.size)throw new Error('No se pudo leer STATIC_FILES de outputLanServer.js');

for(const page of ['output-merlin.html','output-merlin-web.html']){
  const html=read(page);
  for(const id of ['stage','cannedVideo'])if(!new RegExp(`id="${id}"`).test(html))throw new Error(`${page} sin #${id}, que usa la promo de YouTube`);
  for(const f of PROMO_CSS)if(!html.includes(`href="${f}"`))throw new Error(`${page} no carga ${f}`);
  const merlinAt=html.indexOf('src="output-merlin.js"');
  for(const f of PROMO_JS){const at=html.indexOf(`src="${f}"`);if(at<0)throw new Error(`${page} no carga ${f}`);if(at<merlinAt)throw new Error(`${page} carga ${f} antes de output-merlin.js`);}
  // Todo lo que pide la página LAN tiene que estar permitido por el servidor.
  if(page==='output-merlin-web.html')for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){const f=m[1];if(!lanFiles.has(f))throw new Error(`outputLanServer.js no sirve ${f} (lo pide ${page})`);}
  for(const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g))if(!fs.existsSync(path.join(src,m[1])))throw new Error(`Falta ${m[1]} (lo pide ${page})`);
}
// La salida clásica en LAN también pide el diseño v2 de la promo.
for(const f of ['output-youtube-promo-v2-lab29.css','output-youtube-promo-v2-lab29.js'])if(!lanFiles.has(f))throw new Error(`outputLanServer.js no sirve ${f}`);

// Prueba de comportamiento con un DOM mínimo como el de Merlín: el recuadro aparece en los últimos segundos del contenido.
function el(tag='div',id=''){
  const listeners={},classes=new Set(),attrs={};const e={tagName:tag.toUpperCase(),id,children:[],style:{setProperty(k,v){this[k]=v;}},dataset:{},textContent:'',
    classList:{add:(...c)=>c.forEach(x=>classes.add(x)),remove:(...c)=>c.forEach(x=>classes.delete(x)),toggle:(c,on)=>{(on??!classes.has(c))?classes.add(c):classes.delete(c);},contains:c=>classes.has(c)},
    set className(v){classes.clear();String(v).split(/\s+/).filter(Boolean).forEach(x=>classes.add(x));},get className(){return[...classes].join(' ');},
    set innerHTML(v){e._html=v;e._parts={};for(const c of ['ec-youtube-promo-thumb','ec-youtube-promo-kicker','ec-youtube-promo-title','ec-youtube-promo-channel'])e._parts['.'+c]=el(c==='ec-youtube-promo-thumb'?'img':'div');},
    querySelector:s=>e._parts?.[s]||null,appendChild(c){e.children.push(c);return c;},getBoundingClientRect:()=>({}),
    setAttribute(k,v){attrs[k]=String(v);},removeAttribute(k){delete attrs[k];},getAttribute:k=>attrs[k]??null,
    addEventListener(t,f){(listeners[t]=listeners[t]||[]).push(f);},fire(t){for(const f of listeners[t]||[])f({type:t});}};
  return e;
}
const stage=el('div','stage'),cannedVideo=el('video','cannedVideo'),handlers={};
const ECAPI={on:(ch,f)=>{(handlers[ch]=handlers[ch]||[]).push(f);}};
const document={createElement:t=>el(t),querySelector:s=>s==='#ecYoutubePromoOutput'?stage.children.find(c=>c.id==='ecYoutubePromoOutput')||null:null};
const win={ECAPI,stage,cannedVideo,document,addEventListener(){},requestAnimationFrame:f=>f(),setTimeout:(f)=>f(),Number,String,Math,Object,JSON};
win.window=win;
const ctx=vm.createContext(win);
vm.runInContext(read('output-youtube-promo.js'),ctx,{filename:'output-youtube-promo.js'});
const root=stage.children.find(c=>c.id==='ecYoutubePromoOutput');
if(!root)throw new Error('La promo de YouTube no se montó sobre #stage en Merlín');
const emit=(ch,p)=>(handlers[ch]||[]).forEach(f=>f(p));
const promo={enabled:true,videoId:'abc123XYZ',title:'Entrevista completa',channel:'El Comercio',thumbnailDataUrl:'data:image/jpeg;base64,AAAA',leadSeconds:5,ctaText:'Puedes ver el video aquí:'};
emit('output:story',{kind:'canned',mediaRole:'content',videoUrl:'file:///c.mp4',youtubePromo:promo});
cannedVideo.duration=60;cannedVideo.currentTime=10;cannedVideo.fire('timeupdate');
if(root.classList.contains('visible'))throw new Error('La promo apareció antes de tiempo');
cannedVideo.currentTime=56;cannedVideo.fire('timeupdate');
if(!root.classList.contains('visible'))throw new Error('La promo no aparece en los últimos segundos del contenido vinculado');
if(root.querySelector('.ec-youtube-promo-title').textContent!=='Entrevista completa')throw new Error('Título de la promo incorrecto');
cannedVideo.fire('ended');
if(root.classList.contains('visible'))throw new Error('La promo no se oculta al terminar el contenido');
emit('output:story',{kind:'canned',mediaRole:'ad',videoUrl:'file:///ad.mp4',youtubePromo:promo});
cannedVideo.currentTime=58;cannedVideo.fire('timeupdate');
if(root.classList.contains('visible'))throw new Error('La promo no debe salir en anuncios');
console.log('check-merlin-youtube-promo OK · Merlín y LAN cargan la promo · aparece al final del contenido · no sale en anuncios');
