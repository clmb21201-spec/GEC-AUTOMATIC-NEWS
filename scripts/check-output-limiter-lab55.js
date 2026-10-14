'use strict';
// Lab.55 · limitador final de la salida: voz, música, contenidos y efectos por una mezcla común que no pasa del máximo.
// (Medido en Chromium durante el desarrollo: voz al máximo + golpe de marca = pico 1,06 sin limitador, 0,89 con él.)
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const src=path.join(__dirname,'..','src');let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};
const read=f=>fs.readFileSync(path.join(src,f),'utf8');
// Web Audio simulado: registra las conexiones
function fakeAudio(state='running'){
  const log=[];const node=name=>({name,connect(t){log.push(`${name}->${t.name}`);return t;},threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},curve:null,oversample:''});
  class Ctx{constructor(){this.state=state==='bloqueado'?'suspended':state;this.destination=node('destino');this.sampleRate=48000;}createGain(){return node('mezcla');}createDynamicsCompressor(){return node('limitador');}createWaveShaper(){return node('recorte');}createMediaElementSource(el){return node(el.id);}resume(){if(state!=='bloqueado'){this.state='running';this.onstatechange?.();}return Promise.resolve();}}
  return{Ctx,log};
}
function run(state,search=''){
  const {Ctx,log}=fakeAudio(state),els=[{id:'audio',matches:()=>true},{id:'musica',matches:()=>true}];
  const document={querySelectorAll:()=>els,documentElement:{}},window={AudioContext:Ctx};
  vm.runInNewContext(read('output-limiter-lab55.js'),{window,document,location:{search},URLSearchParams,MutationObserver:class{observe(){}},setInterval:()=>0,Float32Array,Math});
  return{window,log};
}
const a=run('running');
ok(a.window.__gecMaster&&a.window.__gecMaster.running,'abre la mezcla al cargar la salida');
ok(a.log.includes('mezcla->limitador')&&a.log.includes('limitador->recorte')&&a.log.includes('recorte->destino'),'mezcla → limitador → recorte suave → parlantes');
ok(a.log.includes('audio->mezcla')&&a.log.includes('musica->mezcla'),'voz y música pasan por la mezcla');
const s=run('bloqueado');ok(!s.window.__gecMaster.running,'queda sin activar');
const r=run('suspended');ok(r.window.__gecMaster.running&&r.log.includes('audio->mezcla'),'si arranca después de pedirlo, conecta');
ok(!s.log.some(x=>/^(audio|musica)->/.test(x)),'si el audio no arranca, los elementos no se conectan (siguen sonando como antes)');
ok(!run('running','?ndi=1').window.__gecMaster,'la ventana de NDI usa su propia mezcla');
const lim=read('output-limiter-lab55.js');ok(/threshold\.value = -3/.test(lim)&&/ratio\.value = 20/.test(lim),'umbral -3 dB, relación 20:1');
ok(/const m = window\.__gecMaster; return m && m\.ctx && m\.input \? \{context: m\.ctx, dest: m\.input\}/.test(read('output-sfx-lab39.js')),'los efectos van a la mezcla con limitador');
ok(/mix\.connect\(lim\);lim\.connect\(processor\)/.test(read('output-ndi-audio.js')),'NDI: limitador antes de enviar');
ok(/injectAsset\('script',\{src:'output-limiter-lab55\.js'\}\)/.test(read('preload.js')),'preload lo carga en la salida');
ok(/<script src="output-limiter-lab55\.js"><\/script>/.test(read('output-web.html'))&&/'output-limiter-lab55\.js'/.test(read('services/outputLanServer.js')),'OBS (página LAN) también');
console.log(`check-output-limiter-lab55 OK (${checks} verificaciones) · limitador en salida, OBS y NDI`);
