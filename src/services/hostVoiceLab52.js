'use strict';
// Lab.52 · Voz de las intervenciones (Merlín y vista clásica): presentación, pase a corte, regreso, despedida.
// Síntoma: «No te vayas, regresamos enseguida.» terminaba con el tono hacia arriba (la última sílaba subía de ~200 a
// ~370 Hz), como si no tuviera punto, y sin respiro antes del contenido. Qwen a veces entona así las frases cortas con
// coma aunque el texto termine en punto; con la semilla de producción fija, la misma frase sale siempre igual.
//   - Mejor toma: cada frase se genera hasta 3 veces (la 1.ª con la semilla de siempre, las otras con otra semilla, solo
//     para esta llamada) y se queda la que termina con el tono hacia abajo (tono de la última sílaba / tono de la frase).
//     Si la primera ya baja, no se repite. Las frases quedan en caché, así que solo tarda la primera vez.
//   - Respiro: al final de cada intervención se agregan 0,45 s de silencio antes de que entre el contenido o el anuncio.
//   - Caché: los audios de presenter-voice/ que no se usan hace 14 días (versiones anteriores de la voz) se borran.
const fs=require('fs');
const path=require('path');
const {AsyncLocalStorage}=require('async_hooks');

const VERSION='lab52-host-voice-1';
const PAD_SEC=0.45, TRIES=3, GOOD=1.03;
const seedScope=new AsyncLocalStorage();

// ── WAV ─────────────────────────────────────────────────────────────────────────────────────────────────────
function chunks(buf){
  if(buf.length<12||buf.toString('ascii',0,4)!=='RIFF'||buf.toString('ascii',8,12)!=='WAVE')throw new Error('no es WAV');
  const out=[];let o=12;
  while(o+8<=buf.length){const id=buf.toString('ascii',o,o+4),size=buf.readUInt32LE(o+4);out.push({id,start:o,data:o+8,size:Math.min(size,buf.length-o-8)});o+=8+size+(size%2);}
  return out;
}
function readWav(file){
  const buf=fs.readFileSync(file),cs=chunks(buf),fmt=cs.find(c=>c.id==='fmt '),data=cs.find(c=>c.id==='data');
  if(!fmt||!data)throw new Error('WAV sin fmt/data');
  const format=buf.readUInt16LE(fmt.data),ch=buf.readUInt16LE(fmt.data+2),sr=buf.readUInt32LE(fmt.data+4),bits=buf.readUInt16LE(fmt.data+14);
  const bps=bits/8,frames=Math.floor(data.size/(bps*ch)),x=new Float32Array(frames);
  for(let i=0;i<frames;i++){let v=0;for(let c=0;c<ch;c++){const o=data.data+(i*ch+c)*bps;v+=format===3&&bits===32?buf.readFloatLE(o):bits===16?buf.readInt16LE(o)/32768:bits===24?buf.readIntLE(o,3)/8388608:bits===32?buf.readInt32LE(o)/2147483648:0;}x[i]=v/ch;}
  return{samples:x,sr,bits,ch,format};
}
// agrega silencio al final, en el mismo formato (y conserva los demás bloques del archivo)
function padSilence(file,sec=PAD_SEC){
  const buf=fs.readFileSync(file),cs=chunks(buf),fmt=cs.find(c=>c.id==='fmt '),data=cs.find(c=>c.id==='data');
  if(!fmt||!data)return false;
  const ch=buf.readUInt16LE(fmt.data+2),sr=buf.readUInt32LE(fmt.data+4),bits=buf.readUInt16LE(fmt.data+14),add=Math.round(sr*sec)*ch*(bits/8);
  const head=buf.subarray(0,data.data+data.size),tail=buf.subarray(data.data+data.size+(data.size%2));
  const out=Buffer.concat([head,Buffer.alloc(add),data.size%2?Buffer.alloc(1):Buffer.alloc(0),tail]);
  out.writeUInt32LE(data.size+add,data.start+4);out.writeUInt32LE(out.length-8,4);
  fs.writeFileSync(file,out);return true;
}

// ── tono al final de la frase ──────────────────────────────────────────────────────────────────────────────
// Devuelve tono de la última sílaba / tono de la frase: < 1 baja (cierre de frase), > 1 sube (suena a pregunta o a
// frase sin terminar). Sin tono medible → 1.
function endingScore({samples,sr}){
  const step=Math.max(1,Math.round(sr/8000)),fs8=sr/step,n=Math.floor(samples.length/step),x=new Float32Array(n);
  for(let i=0;i<n;i++){let t=0;for(let k=0;k<step;k++)t+=samples[i*step+k];x[i]=t/step;}
  const win=Math.round(fs8*.04),hop=Math.round(fs8*.02),lo=Math.floor(fs8/400),hi=Math.ceil(fs8/70),frames=[];
  let peak=0;for(let i=0;i+win<n;i+=hop){let e=0;for(let k=0;k<win;k++)e+=x[i+k]*x[i+k];peak=Math.max(peak,Math.sqrt(e/win));}
  for(let i=0;i+win+hi<n;i+=hop){
    let e=0;for(let k=0;k<win;k++)e+=x[i+k]*x[i+k];const rms=Math.sqrt(e/win);
    if(rms<peak*.12){frames.push({t:i/fs8,f0:0});continue;}
    let best=0,bl=0;const c0=e;
    for(let l=lo;l<=hi;l++){let c=0;for(let k=0;k<win;k++)c+=x[i+k]*x[i+k+l];if(c>best){best=c;bl=l;}}
    frames.push({t:i/fs8,f0:best>.3*c0&&bl?fs8/bl:0});
  }
  const voiced=frames.filter(f=>f.f0>0);if(voiced.length<8)return 1;
  const tEnd=voiced[voiced.length-1].t,med=a=>{const s=[...a].sort((p,q)=>p-q);return s.length?s[Math.floor(s.length/2)]:0;};
  const end=voiced.filter(f=>f.t>=tEnd-.12).map(f=>f.f0),ref=voiced.filter(f=>f.t<tEnd-.35&&f.t>=tEnd-1.6).map(f=>f.f0);
  const e=med(end),r=med(ref);return e>0&&r>0?Math.round(e/r*1000)/1000:1;
}

// ── generar con la mejor toma ─────────────────────────────────────────────────────────────────────────────
function installSeedOverride(TTSLabRuntime){
  const T=TTSLabRuntime||require('./ttsLabRuntime').TTSLabRuntime,p=T.prototype;
  if(p.__gecLab52Seed)return false;Object.defineProperty(p,'__gecLab52Seed',{value:true});
  const base=p.generate;
  p.generate=function(id,text,opts={},...rest){
    const seed=seedScope.getStore()?.seed;
    if(seed&&opts&&typeof opts==='object')opts={...opts,params:{...(opts.params||{}),productionSeed:seed}};
    return base.call(this,id,text,opts,...rest);
  };
  return true;
}
function engineOf(k){try{const s=k.status?.();return String(s?.selectedEngine||'kokoro');}catch{return'kokoro';}}
async function generate(k,text,opts={},{tries=TRIES,log=null}={}){
  // Kokoro siempre da el mismo audio: una sola toma
  const n=engineOf(k)==='kokoro'?1:Math.max(1,Math.min(TRIES,Number(tries)||1));
  let best=null;
  for(let t=0;t<n;t++){
    const seed=t?20261014+t*7919:0;
    let a=null;try{a=t?await seedScope.run({seed},()=>k.generate(text,opts)):await k.generate(text,opts);}catch(e){if(!best&&t===n-1)throw e;continue;}
    if(!a?.path||!fs.existsSync(a.path))continue;
    let score=1;try{score=endingScore(readWav(a.path));}catch{}
    if(!best||score<best.score){if(best)try{k.cleanupAudio?.(best.a.path);}catch{}best={a,score,take:t+1};}
    else try{k.cleanupAudio?.(a.path);}catch{}
    if(score<=GOOD)break;
  }
  if(!best)return null;
  try{if(padSilence(best.a.path))best.a={...best.a,durationSec:(Number(best.a.durationSec)||0)+PAD_SEC};}catch{}
  try{log?.(`toma ${best.take} de ${n} · final ${best.score<=GOOD?'baja':'sube'} (${best.score}) · «${String(text).slice(0,60)}»`);}catch{}
  return{...best.a,endingScore:best.score,take:best.take};
}

// ── caché ───────────────────────────────────────────────────────────────────────────────────────────────────
function touch(file){try{const t=new Date();fs.utimesSync(file,t,t);}catch{}}
function cleanupCache(dir,{days=14,now=Date.now()}={}){
  let removed=0;
  try{for(const f of fs.readdirSync(dir)){if(!/^[0-9a-f]{16}\.wav$/.test(f))continue;const p=path.join(dir,f);try{if(now-fs.statSync(p).mtimeMs>days*86400000){fs.rmSync(p,{force:true});removed++;}}catch{}}}catch{}
  return removed;
}

function installHostVoiceLab52(){
  if(global.__gecHostVoiceLab52)return global.__gecHostVoiceLab52;
  try{installSeedOverride();}catch{}
  let cleaned=false;
  global.__gecHostVoiceLab52={VERSION,generate,touch,cleanupOnce:dir=>{if(cleaned)return 0;cleaned=true;return cleanupCache(dir);}};
  return global.__gecHostVoiceLab52;
}

module.exports={VERSION,PAD_SEC,readWav,padSilence,endingScore,generate,installSeedOverride,cleanupCache,touch,seedScope,installHostVoiceLab52};
