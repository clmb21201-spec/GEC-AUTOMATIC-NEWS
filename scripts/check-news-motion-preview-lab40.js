'use strict';
// Lab.40 · vista previa de Noticias con movimiento en la ventana del panel (salida real con noticias de ejemplo).
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),src=f=>fs.readFileSync(path.join(root,'src',f),'utf8');
let checks=0;const ok=(c,m)=>{checks++;if(!c){console.error('check-news-motion-preview-lab40: '+m);process.exit(1);}};
const nm=require('../src/services/newsMotionLab37.js');

const st=nm.previewStories({});
ok(Array.isArray(st)&&st.length===3&&st.map(s=>s.key).join()==='deportes,economia,exclusiva','tres noticias de ejemplo');
ok(st.every(s=>s.kind==='news'&&s.audioDurationSec>10&&Array.isArray(s.speechSegments)&&s.speechSegments.length===s.motion.sentences.length),'voz simulada con un tramo por oración');
ok(st[2].isExclusive===true&&st.every(s=>s.motion&&s.motion.facts.length>=2),'exclusiva y datos clave');
ok(st[1].motion.facts.some(f=>/3,72/.test(f.big)),'la de cifras trae el dato en soles');
const noFacts=nm.previewStories({facts:false});ok(noFacts.every(s=>!s.motion.facts.length),'usa la configuración que se está editando');
const tk=nm.previewStories({},{automation:{queue:[{status:'LISTA',result:{title:'Titular en cola de prueba'}}],cachedItems:[]}});
ok(tk[0].motion.ticker.some(x=>/Titular en cola de prueba/.test(x.t)),'el ticker usa la cola real');

const svc=src('services/newsMotionLab37.js');
ok(/handle\('newsMotion:preview'/.test(svc)&&/config:normalizeConfig\(draft\|\|config\(\)\)/.test(svc),'IPC newsMotion:preview con la configuración normalizada');
ok(/newsMotionPreview:cfg=>invoke\('newsMotion:preview',cfg\)/.test(src('preload.js')),'preload expone newsMotionPreview');

const html=src('output-news-motion-preview.html');
const order=['output-news-motion-preview-adapter.js','output.js','output-0324.js','output-0325.js','output-0326.js','output-0328.js','output-0331.js','output-news-motion-lab37.js','gec-sfx-lab39.js','output-sfx-lab39.js'];
let last=-1;for(const f of order){const i=html.indexOf(`src="${f}"`);ok(i>last,'orden de scripts en la vista previa: '+f);last=i;}
ok(/id="storyLayer"/.test(html)&&/id="audio"/.test(html)&&/output-news-motion-lab37\.css/.test(html),'misma estructura que la salida');
const ad=src('output-news-motion-preview-adapter.js');
ok(/window\.ECAPI=new Proxy/.test(ad)&&/outputPlayback:e=>\{if\(e&&e\.type==='ended'\)/.test(ad),'ECAPI propio y pasa sola a la siguiente noticia');
ok(/musicEnabled:false/.test(ad)&&/silentWav/.test(ad)&&/data:image\/svg\+xml/.test(ad),'sin música, voz muda y fotos de ejemplo');
ok(/m\.type!=='gec-nm-preview'/.test(ad)&&/gec-nm-preview-state/.test(ad),'mensajes con el panel');

const r=src('renderer-news-motion-lab37.js');
ok(/id="gecNmPFrame"/.test(r)&&/'output-news-motion-preview\.html'/.test(r),'iframe de la vista previa en la ventana');
ok(/function draftFromModal\(\)/.test(r)&&/const next = draftFromModal\(\);/.test(r)&&/api\.newsMotionPreview\(draft\)/.test(r),'Guardar y la vista previa usan lo mismo que está en la ventana');
ok(/enabled: pSound && r\.config\.sfx\?\.enabled !== false/.test(r),'sonido de la vista previa apagado salvo que se encienda');
ok(/function closeModal\(\)[^\n]*removeAttribute\('src'\)/.test(r)&&!/bg\.classList\.remove\('show'\)/.test(r),'al cerrar se descarga la vista previa');
ok(/data-f="9:16"/.test(r)&&/data-i="2">Exclusiva/.test(r),'formatos y noticias de ejemplo');
ok(/function deriveColors\(d = \{\}\)/.test(r)&&/bar2: exBg === catBg \? title : exBg/.test(r)&&/if \(!custom && designColors\) i\.value = designColors/.test(r),'«Tomar del Diseño» muestra los colores que salen del Diseño (misma regla que la salida)');
ok(/auto=\{bar1:catBg,bar2:same\(exBg,catBg\)\?title:exBg,bar3:lower,voiceBg:lower,voiceBars:catBg,tickerBg:catBg,tickerText:catTx\}/.test(src('output-news-motion-lab37.js')),'la regla de la salida sigue igual a la del panel');
// otros «Guardar» del panel (Audio, Ajustes, Claude…) mandan una copia vieja del diseño: no deben pisar la nota ni la promo
const mainJs=src('main.js');
ok(/if\(!incoming\.__designV2\)\{delete incomingOutput\.noteDesign;delete incomingOutput\.youtubePromoDesign;delete incomingOutput\.youtubePromoCtaText;\}/.test(mainJs)&&/delete next\.__designV2;settingsStore\.save\(next\)/.test(mainJs),'settings:save solo acepta la nota y la promo del editor de Diseño');
ok(/fresh\.__designV2=true;/.test(src('renderer-emission-design-v2.js'))&&/saveSettings\(Object\.assign\(fresh,\{__designV2:true\}\)\)/.test(src('renderer-stabilization-lab28.js')),'el editor de Diseño y el de la promo marcan sus guardados');
console.log(`check-news-motion-preview-lab40 OK (${checks} verificaciones) · ejemplos · IPC · página · panel`);
