'use strict';
// Lab.52 · voz de las intervenciones (mejor toma con el tono final hacia abajo, respiro al final, limpieza de la caché)
// e indicador de tiempo del Generador de offs.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const src=path.join(__dirname,'..','src');
const H=require(path.join(src,'services','hostVoiceLab52'));
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);},eq=(a,b,m)=>{checks++;assert.deepStrictEqual(a,b,m);};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-host-voice-'));
// WAV PCM 16 con un tono que al final sube o baja (armónicos para que se parezca a una voz)
function wav(file,f0a,f0b,sec=2,sr=24000){
  const n=Math.round(sr*sec),b=Buffer.alloc(44+n*2);let ph=0;
  b.write('RIFF',0);b.writeUInt32LE(36+n*2,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++){const t=i/n,f=t<.8?f0a:f0a+(f0b-f0a)*(t-.8)/.2;ph+=2*Math.PI*f/sr;b.writeInt16LE(Math.round(9000*(Math.sin(ph)+.5*Math.sin(2*ph))),44+i*2);}
  fs.writeFileSync(file,b);return file;
}
(async()=>{
  // tono final
  const up=H.endingScore(H.readWav(wav(path.join(tmp,'up.wav'),200,340))),down=H.endingScore(H.readWav(wav(path.join(tmp,'down.wav'),200,140)));
  ok(up>1.2,`final que sube: ${up}`);ok(down<.9,`final que baja: ${down}`);
  // respiro
  const f=wav(path.join(tmp,'pad.wav'),200,140,1);H.padSilence(f,.45);const w=H.readWav(f);
  ok(Math.abs(w.samples.length/w.sr-1.45)<.01,'0,45 s de silencio al final');ok(Math.max(...w.samples.slice(-1000).map(Math.abs))===0,'el final agregado es silencio');

  // semilla solo dentro de la toma
  class FakeLab{async generate(id,text,opts={}){return{seed:opts.params?.productionSeed||0};}}
  ok(H.installSeedOverride(FakeLab)&&!H.installSeedOverride(FakeLab),'la semilla se envuelve una sola vez');
  const lab=new FakeLab();
  eq((await lab.generate('qwen3tts','x',{params:{productionSeed:111}})).seed,111,'fuera de una toma: semilla de producción');
  eq((await H.seedScope.run({seed:999},()=>lab.generate('qwen3tts','x',{params:{productionSeed:111}}))).seed,999,'dentro de una toma: otra semilla');

  // mejor toma: la 1.ª sube, la 2.ª baja → se queda con la 2.ª y no genera la 3.ª
  let calls=0,cleaned=[];
  const k={status:()=>({selectedEngine:'qwen3tts'}),cleanupAudio:p=>cleaned.push(p),
    generate:async(text,opts)=>{calls++;const seed=H.seedScope.getStore()?.seed||0;const p=path.join(tmp,`take-${calls}.wav`);wav(p,200,seed?140:340);return{path:p,durationSec:2};}};
  const logs=[];const a=await H.generate(k,'No te vayas, regresamos enseguida.',{},{log:m=>logs.push(m)});
  eq([calls,a.take],[2,2],'se queda con la toma que baja y no sigue');ok(a.endingScore<1,'la elegida cierra hacia abajo');
  ok(cleaned.length===1&&/take-1/.test(cleaned[0]),'la toma descartada se borra');
  ok(Math.abs(a.durationSec-2.45)<.001,'la duración incluye el respiro');ok(/toma 2 de 3 · final baja/.test(logs[0]),'queda en el registro');
  // la primera ya baja: una sola toma; Kokoro: siempre una
  calls=0;k.generate=async()=>{calls++;const p=path.join(tmp,`ok-${calls}.wav`);wav(p,200,150);return{path:p,durationSec:2};};
  await H.generate(k,'Hola.');eq(calls,1,'si la primera baja no se repite');
  calls=0;k.status=()=>({selectedEngine:'kokoro'});k.generate=async()=>{calls++;const p=path.join(tmp,`k-${calls}.wav`);wav(p,200,340);return{path:p,durationSec:2};};
  await H.generate(k,'Hola.');eq(calls,1,'Kokoro: una sola toma (sale siempre igual)');
  calls=0;k.status=()=>({selectedEngine:'qwen3tts'});await H.generate(k,'Hola.',{},{tries:1});eq(calls,1,'frases con {hora}: una toma (12 s de espera)');

  // caché: se borran los audios sin usar hace 14 días; los demás y los titulares se quedan
  const dir=path.join(tmp,'presenter-voice');fs.mkdirSync(dir);
  const old=path.join(dir,'0123456789abcdef.wav'),fresh=path.join(dir,'fedcba9876543210.wav'),tit=path.join(dir,'titulares-1.wav');
  for(const p of [old,fresh,tit])fs.writeFileSync(p,'x');const past=new Date(Date.now()-20*86400000);fs.utimesSync(old,past,past);fs.utimesSync(tit,past,past);
  eq(H.cleanupCache(dir),1,'borra solo el viejo');ok(!fs.existsSync(old)&&fs.existsSync(fresh)&&fs.existsSync(tit),'quedan el reciente y los titulares');

  // conexión en main.js y bootstrap
  const main=fs.readFileSync(path.join(src,'main.js'),'utf8');
  ok(/const VOICE_CACHE_REV='lab52'/.test(main),'las frases se regeneran una vez');
  ok(/a=await hostGenerate\(text,\{voice:s\.tts\.voice,speed:s\.tts\.speed\}\);/.test(main)&&/hostGenerate\(text,\{voice:s\.tts\.voice,speed:s\.tts\.speed\},\{tries:1\}\)/.test(main),'frases fijas con mejor toma; {hora} con una');
  ok(/hostVoice\(\)\?\.touch\?\.\(f\)/.test(main)&&/hostVoice\(\)\?\.cleanupOnce\?\.\(cacheDir\(\)\)/.test(main),'caché: marca las que se usan y limpia una vez');
  ok(/hostVoiceLab52'\)\.installHostVoiceLab52\(\)/.test(fs.readFileSync(path.join(src,'bootstrap-v2lab.js'),'utf8')),'bootstrap instala Lab.52');

  // Generador de offs: avance por texto, velocidad de la voz y aviso de demora
  const svc=fs.readFileSync(path.join(src,'services','offsLab47.js'),'utf8'),rd=fs.readFileSync(path.join(src,'renderer-offs-lab47.js'),'utf8');
  ok(/progress\(\{stage:'generate',index:i\+1,total:paras\.length,doneChars,totalChars,paraChars:paras\[i\]\.length,rtf\}\)/.test(svc)&&/rtf:voiceRtf\(\)/.test(svc),'el servicio manda caracteres hechos, total y velocidad');
  ok(/transcurrido/.test(rd)&&/faltan ~/.test(rd)&&/tardando más de lo normal/.test(rd)&&/se genera en ~/.test(rd),'panel: transcurrido, restante, aviso y estimación previa');
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
  console.log(`check-host-voice-lab52 OK (${checks} verificaciones) · mejor toma · respiro · caché · indicador de offs`);
})().catch(e=>{console.error('check-host-voice-lab52: '+(e.stack||e.message));process.exit(1);});
