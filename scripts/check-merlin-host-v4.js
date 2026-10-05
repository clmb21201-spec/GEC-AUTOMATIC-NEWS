'use strict';
// Merlín v4 · intervenciones (presenterHost de main.js) con stubs: orden de las piezas, Detener emisión con despedida,
// titulares periódicos y volumen normalizado de las voces.
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),assert=require('assert');
const {pathToFileURL}=require('url');
const root=path.join(__dirname,'..'),src=path.join(root,'src'),main=fs.readFileSync(path.join(src,'main.js'),'utf8');
const a=main.indexOf('// ---- Presentador Merlín: intervenciones'),b=main.indexOf('// ---- Merlín: volumen normalizado');
assert.ok(a>0&&b>a,'no se encontró el bloque presenterHost en main.js');
const block=main.slice(a,b);
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-host-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// WAV PCM 16 bits mono con un tono de amplitud dada
function wav(file,sec,amp){const rate=24000,n=Math.round(rate*sec),data=Buffer.alloc(n*2);for(let i=0;i<n;i++)data.writeInt16LE(Math.round(Math.sin(2*Math.PI*220*i/rate)*amp*32767),i*2);
  const h=Buffer.alloc(44);h.write('RIFF',0,'ascii');h.writeUInt32LE(36+data.length,4);h.write('WAVE',8,'ascii');h.write('fmt ',12,'ascii');h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36,'ascii');h.writeUInt32LE(data.length,40);
  fs.writeFileSync(file,Buffer.concat([h,data]));return file;}

function load({queue=[]}={}){
  const log=[],handlers={},on={};let n=0;
  const automation={queue,currentKind:'none',stopped:0,started:0,state(){},stopEmission(){this.stopped++;ctx.controlOutput('stop');return true;},startEmission(){this.started++;return true;}};
  const ctx={
    __dirname:src,require,console,setTimeout,clearTimeout,setInterval,clearInterval,Buffer,Date,Math,JSON,Promise,
    fs,path,dataDir:tmp,portableDataDir:()=>tmp,
    app:{whenReady:()=>new Promise(()=>{}),getPath:()=>tmp},
    ipcMain:{on:(k,fn)=>{(on[k]=on[k]||[]).push(fn);},handle:(k,fn)=>{handlers[k]=fn;}},
    logEvent:()=>{},readPresenter:()=>({mode:'merlin'}),currentDesign:()=>({format:'16:9'}),
    settingsStore:{load:()=>({tts:{voice:'ef_dora',speed:1}})},
    kokoro:{generate:async text=>({path:wav(path.join(tmp,`tts-${++n}.wav`),1+text.length/40,.3),durationSec:1+text.length/40}),cleanupAudio(){}},
    pronunciation:null,automation,currentOutputProgram:{durationSec:30,currentSec:10},
    deliverToOutput(p){log.push(p.kind==='host'?`HOST:${p.segment}`:(p.mediaRole==='ad'?'ad':p.kind));ctx.last=p;return true;},
    controlOutput(a){log.push(String(a).toUpperCase());return true;}
  };
  vm.createContext(ctx);
  vm.runInContext(block+';this.presenterHost=presenterHost;',ctx);
  const emit=(ch,ev)=>(on[ch]||[]).forEach(fn=>fn({},ev));
  return{ctx,log,automation,host:ctx.presenterHost,ended:()=>emit('presenter:hostPlayback',{type:'ended'}),outEnded:()=>emit('output:playback',{type:'ended'})};
}
const news=()=>({kind:'news',title:'Noticia',audioUrl:''}),canned=()=>({kind:'canned',videoUrl:'file:///v.mp4'}),ad=()=>({kind:'canned',mediaRole:'ad',videoUrl:'file:///a.mp4'});

(async()=>{
  // 1) orden: presentación, pase a corte y regreso
  {const t=load();await t.host.ensureClips();
    const send=p=>t.ctx.deliverToOutput(p,'automatic',false);
    for(const p of [news(),news(),canned(),ad(),news(),news()]){send(p);if(t.log[t.log.length-1].startsWith('HOST:'))t.ended();}
    ok(t.log.join(',')==='HOST:intro,news,news,HOST:pase,canned,ad,HOST:regreso,news,news',`orden de intervenciones: ${t.log.join(',')}`);
    ok(t.ctx.last&&t.ctx.last.kind==='news','la última pieza es la noticia');}

  // 2) Detener con noticia al aire: termina la noticia, se despide y recién ahí stop
  {const t=load();await t.host.ensureClips();const send=p=>t.ctx.deliverToOutput(p,'automatic',false);
    send(news());t.ended();t.automation.currentKind='news';t.log.length=0;
    t.automation.stopEmission();
    ok(!t.log.includes('STOP')&&!t.log.includes('HOST:despedida'),`no debe cortar la noticia al aire: ${t.log.join(',')}`);
    t.outEnded();
    ok(t.log.join(',')==='HOST:despedida','al terminar la noticia, despedida');
    t.ended();ok(t.log.join(',')==='HOST:despedida,STOP',`después de la despedida, stop: ${t.log.join(',')}`);}

  // 3) Detener con enlatado al aire: despedida inmediata y stop
  {const t=load();await t.host.ensureClips();const send=p=>t.ctx.deliverToOutput(p,'automatic',false);
    send(news());t.ended();send(canned());t.ended();t.automation.currentKind='canned';t.log.length=0;
    t.automation.stopEmission();
    ok(t.log.join(',')==='HOST:despedida',`con enlatado: despedida inmediata (${t.log.join(',')})`);
    t.ended();ok(t.log.join(',')==='HOST:despedida,STOP','y luego stop');}

  // 4) Detener y reanudar antes del final: sin despedida ni stop
  {const t=load();await t.host.ensureClips();const send=p=>t.ctx.deliverToOutput(p,'automatic',false);
    send(news());t.ended();t.automation.currentKind='news';t.log.length=0;
    t.automation.stopEmission();t.automation.startEmission();t.outEnded();await sleep(20);
    ok(!t.log.includes('HOST:despedida')&&!t.log.includes('STOP'),`reanudar cancela la despedida: ${t.log.join(',')}`);}

  // 5) titulares periódicos con los titulares reales de la cola
  {const queue=[1,2,3].map(i=>({status:'LISTA',result:{title:`Titular ${i}`,category:'POLÍTICA'},image:''}));
    const t=load({queue});await t.host.ensureClips();const send=p=>t.ctx.deliverToOutput(p,'automatic',false);
    send(news());t.ended();t.log.length=0;
    t.host.titularesNow();for(let i=0;i<100&&!t.host.state().titReady;i++)await sleep(20);
    ok(t.host.state().titReady,'los titulares deben quedar preparados');
    send(news());
    const h=t.ctx.last;
    ok(t.log.join(',')==='HOST:titulares'&&Array.isArray(h.headlines)&&h.headlines.length===3&&Array.isArray(h.headlineMarks)&&h.headlineMarks.length===3&&h.headlinesIntroSec>0,`titulares con headlines, headlineMarks y headlinesIntroSec (${t.log.join(',')})`);
    ok(h.headlines.map(x=>x.title).join('|')==='Titular 1|Titular 2|Titular 3','titulares reales de la cola');
    t.ended();ok(t.log.join(',')==='HOST:titulares,news','después de los titulares sale la noticia');}

  // 6) volumen: voz fuerte → ganancia negativa; suave → positiva con tope +6 dB
  {const t=load();await t.host.ensureClips();const send=p=>t.ctx.deliverToOutput(p,'automatic',false);
    send(news());t.ended();
    const loud=wav(path.join(tmp,'loud.wav'),2,.9),soft=wav(path.join(tmp,'soft.wav'),2,.03);
    send({kind:'news',title:'Fuerte',audioUrl:pathToFileURL(loud).href});const gl=t.ctx.last.audioGainDb;
    send({kind:'news',title:'Suave',audioUrl:pathToFileURL(soft).href});const gs=t.ctx.last.audioGainDb;
    ok(gl<0,`voz fuerte: ganancia negativa (${gl})`);ok(gs>0&&gs<=6,`voz suave: ganancia positiva con tope +6 (${gs})`);}

  fs.rmSync(tmp,{recursive:true,force:true});
  console.log(`check-merlin-host-v4 OK (${checks} verificaciones) · orden · detener · titulares · volumen`);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
