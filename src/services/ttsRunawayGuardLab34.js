'use strict';
// Lab.34 · Voz que no se detiene (Qwen3-TTS a veces no marca el fin y genera ruido grave hasta su tope).
// El worker (qwen_runaway_lab34.py) ya limita los pasos según el texto y regenera o recorta el fragmento descontrolado.
// Aquí, en la aplicación:
//   1) cada caso que el worker corrigió queda en logs/tts-runaway.log (carpeta de datos);
//   2) último control antes de emitir: si el audio igual dura mucho más de lo que corresponde a su texto, se descarta
//      con un error de voz (la noticia no sale al aire con ruido). En mediciones (benchmarkSeed) solo se registra.
const fs=require('fs');
const path=require('path');
const {TTSLabRuntime}=require('./ttsLabRuntime');

const CHARS_PER_SEC=14;
// límite del audio completo: el doble de lo esperado más un margen (más holgado que el del fragmento en el worker)
function expectedSec(text){return String(text||'').replace(/\s+/g,' ').trim().length/CHARS_PER_SEC;}
function limitSec(text){return Math.max(20,expectedSec(text)*2+10);}

function logLine(rt,line){
  try{const dir=path.join(rt?.dataDir||'.','logs');fs.mkdirSync(dir,{recursive:true});fs.promises.appendFile(path.join(dir,'tts-runaway.log'),`[${new Date().toISOString()}] ${line}\n`).catch(()=>{});}catch{}
}
function describe(ev){
  const r=ev.retry?` · reintento ${ev.retry.audio_sec} s (${ev.retry.reason||'bien'})`:ev.retry_error?` · reintento falló: ${ev.retry_error}`:'';
  return `fragmento ${ev.chunk} (${ev.chars} caracteres): ${ev.audio_sec} s para ~${ev.expected_sec} s [${ev.reason}]${r} → ${ev.action}${ev.final_sec!=null?` ${ev.final_sec} s`:''}`;
}

function installTtsRunawayGuardLab34(){
  const t=TTSLabRuntime.prototype;if(t.__gecLab34Runaway)return;Object.defineProperty(t,'__gecLab34Runaway',{value:true});
  const baseCommand=t.command;
  t.command=async function(id,payload,...rest){
    const r=await baseCommand.call(this,id,payload,...rest);
    try{const evs=Array.isArray(r?.runaway)?r.runaway:[];for(const ev of evs)logLine(this,`${id} · ${describe(ev)} · ${path.basename(String(payload?.output||''))}`);}catch{}
    return r;
  };
  const baseGenerate=t.generate;
  t.generate=async function(id,text,opts={},...rest){
    const r=await baseGenerate.call(this,id,text,opts,...rest);
    const dur=Number(r?.durationSec)||0,lim=limitSec(text),exp=Math.round(expectedSec(text));
    if(dur>lim){
      const bench=Number(opts?.params?.benchmarkSeed||0)>0;
      logLine(this,`${id} · audio completo ${dur.toFixed(1)} s para un texto de ~${exp} s (límite ${lim.toFixed(0)} s) → ${bench?'medición: solo se registra':'descartado'} · ${path.basename(String(r?.path||''))}`);
      if(!bench){
        try{if(r?.path)fs.unlinkSync(r.path);}catch{}
        const err=new Error(`la voz generada dura ${Math.round(dur)} s para un texto de ~${exp} s (el motor no se detuvo); se descartó para no emitir ruido`);
        err.code='TTS_RUNAWAY';throw err;
      }
    }
    return r;
  };
}

module.exports={installTtsRunawayGuardLab34,limitSec,expectedSec};
