'use strict';
// Verifica la normalización de volumen de enlatados y anuncios (Merlín, sección 6B).
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),assert=require('assert'),{pathToFileURL}=require('url');
const root=path.join(__dirname,'..'),src=path.join(root,'src');
const {MediaLoudness}=require(path.join(src,'services','mediaLoudnessMerlin.js'));
const {CannedManager}=require(path.join(src,'services','canned.js'));
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-loudness-'));
try{
  const cannedDir=path.join(tmp,'enlatados'),adsDir=path.join(tmp,'anuncios'),dataDir=path.join(tmp,'data');
  fs.mkdirSync(cannedDir);fs.mkdirSync(adsDir);
  const a=path.join(cannedDir,'a.mp4'),b=path.join(adsDir,'b.mp4');fs.writeFileSync(a,Buffer.alloc(4000,1));fs.writeFileSync(b,Buffer.alloc(3000,2));
  const m=new MediaLoudness({dataDir,canned:new CannedManager(),ads:new CannedManager()}),settings={canned:{folder:cannedDir,adsFolder:adsDir}};
  let pend=m.pending(settings,10);ok(pend.length===2,'deben quedar pendientes el enlatado y el anuncio');
  const ka=pend.find(x=>x.name==='a.mp4').key,kb=pend.find(x=>x.name==='b.mp4').key;
  ok(m.read(ka).byteLength===4000,'read debe devolver los bytes del archivo');
  m.set(ka,-30);m.set(kb,null);
  ok(m.gainForUrl(pathToFileURL(a).href)===-12,'la ganancia se limita a -12 dB');
  ok(m.gainForUrl(pathToFileURL(b).href)===undefined,'sin medición no se envía audioGainDb');
  ok(m.pending(settings,10).length===0,'lo medido (o no medible) no vuelve a quedar pendiente');
  m.set(ka,9.87);ok(m.gainForUrl(pathToFileURL(a).href)===6,'la ganancia se limita a +6 dB');
  const m2=new MediaLoudness({dataDir,canned:new CannedManager(),ads:new CannedManager()});ok(m2.gainForUrl(pathToFileURL(a).href)===6,'la medición se guarda en disco');
  fs.writeFileSync(a,Buffer.alloc(5000,1));const t=Date.now()/1000+5;fs.utimesSync(a,t,t);
  ok(m2.gainForUrl(pathToFileURL(a).href)===undefined,'si el archivo cambia, la medición anterior no se usa');
  ok(m2.pending(settings,10).length===1,'si el archivo cambia, vuelve a medirse');
  assert.throws(()=>m2.read(ka),/cambió/);checks++;
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

// cálculo del panel: se carga renderer-media-loudness.js con un ECAPI simulado y se mide un buffer sintético
const rsrc=fs.readFileSync(path.join(src,'renderer-media-loudness.js'),'utf8');
const sr=8000,tone=(amp,sec)=>Float32Array.from({length:sr*sec},(_,i)=>amp*Math.sin(2*Math.PI*440*i/sr));
function bufferOf(...parts){const n=parts.reduce((s,p)=>s+p.length,0),d=new Float32Array(n);let o=0;for(const p of parts){d.set(p,o);o+=p.length;}return{numberOfChannels:1,length:n,sampleRate:sr,getChannelData:()=>d};}
async function run(buffer){const sets=[];let served=false;
  const ctx={window:{},console,setTimeout:(f)=>setTimeout(f,0),Math,Float32Array,
    OfflineAudioContext:function(){this.decodeAudioData=async()=>buffer;}};
  ctx.window.ECAPI={mediaLoudnessPending:async()=>{if(served)return new Promise(()=>{});served=true;return[{key:'k',name:'x.mp4'}];},mediaLoudnessRead:async()=>new ArrayBuffer(8),mediaLoudnessSet:async(k,g)=>{sets.push(g);}};
  vm.createContext(ctx);vm.runInContext(rsrc,ctx);for(let i=0;i<50&&!sets.length;i++)await new Promise(r=>setTimeout(r,5));return sets[0];}
(async()=>{
  const loud=await run(bufferOf(tone(0.9,2))),soft=await run(bufferOf(tone(0.02,2))),silent=await run(bufferOf(new Float32Array(sr)));
  ok(loud<0,'una pista fuerte recibe ganancia negativa');ok(soft===6,'una pista suave recibe ganancia positiva con tope +6 dB');ok(silent===null,'una pista en silencio no se puede medir');
  const withSilence=await run(bufferOf(tone(0.1,1),new Float32Array(sr*3))),plain=await run(bufferOf(tone(0.1,1)));
  ok(Math.abs(withSilence-plain)<0.01,'los silencios (< -40 dBFS) no cambian la medición');
  const main=fs.readFileSync(path.join(src,'main.js'),'utf8'),pre=fs.readFileSync(path.join(src,'preload.js'),'utf8');
  ok(main.includes("ipcMain.handle('media:loudnessPending'")&&main.includes('mediaLoudness.gainForUrl(payload.videoUrl)'),'main.js sin normalización de enlatados');
  ok(pre.includes("mediaLoudnessPending:()=>invoke('media:loudnessPending')")&&pre.includes("src:'renderer-media-loudness.js'"),'preload.js sin API de volumen de enlatados');
  console.log(`check-media-loudness OK · ${checks} verificaciones`);
})().catch(e=>{console.error(e);process.exit(1);});
