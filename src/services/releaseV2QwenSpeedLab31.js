'use strict';
// Lab.31 · Qwen3-TTS más rápido sin perder entonación.
// - Optimización: después de la medición habitual (Lab.30) agrega dos pasos:
//   1) "Aceleración del predictor": mide con y sin CUDA graphs (qwen_speed_lab31.py) y los activa solo si son
//      más rápidos y el audio pasa el control (duración, volumen, verificación numérica del worker).
//   2) Solo fine-tuned: mide una nota típica (~900 caracteres) y una corta (~400) con el corte por oraciones y
//      guarda dos audios de la misma nota (corte actual de 360 y corte por oraciones) para la prueba de escucha.
// - Lo elegido se guarda por modelo en data/tts-lab/qwen-speed-lab31.json y se aplica a cada generación de Qwen.
// - Insignia "SIN OPTIMIZAR": el optimizador guarda optimization0321 sin la clave del modelo y el guardado lo
//   cambiaba por la optimización anterior en caché de ese modelo. Se completa la clave antes de guardar.
const fs=require('fs');
const path=require('path');
const {ipcMain}=require('electron');
const {TTSLabRuntime}=require('./ttsLabRuntime');
const {SettingsStore}=require('./settings');
const lab=require('./releaseV2Lab');
const lab30=require('./releaseV2GpuIsolationLab30');

const CONFIG_FILE='qwen-speed-lab31.json';
const GRAPH_RUNS=3,NOTE_RUNS=2;
const GRAPH_MIN_GAIN=.05,DURATION_TOLERANCE=.10;
const SENTENCE_DEFAULTS={chunkMode:'sentences',minChunkChars:200,joinPauseMs:300};
const WARM_TEXT='El Comercio verifica el rendimiento de la voz.';
// mismo texto que la medición de configuraciones de ttsLabRuntime, para comparar con su RTF
const TEST_TEXT='El Comercio informó nuevas medidas que serán evaluadas durante las próximas horas. Las autoridades señalaron que los equipos técnicos revisan la información disponible y comunicarán nuevos detalles conforme avance la jornada.';
const NOTE_TYPICAL='El Ministerio de Economía anunció este martes un paquete de medidas para reactivar la inversión privada en las regiones del sur del país. Según el titular del sector, el plan incluye incentivos tributarios y la simplificación de trámites para proyectos de infraestructura. La medida fue recibida con cautela por los gremios empresariales, que pidieron conocer los detalles antes de pronunciarse. Por su parte, los gobernadores regionales señalaron que esperan una mayor coordinación con el Ejecutivo para priorizar las obras pendientes. El paquete será publicado en las próximas semanas en el diario oficial, según informó el ministerio. Los analistas estiman que el impacto en el empleo se verá recién el próximo año, cuando se ejecuten los primeros proyectos. Mientras tanto, las autoridades regionales evaluarán qué obras pueden acogerse al nuevo régimen.';
const NOTE_SHORT='La Municipalidad de Lima informó que el tránsito en la avenida Abancay será restringido desde el lunes por trabajos de mantenimiento. Las autoridades recomendaron usar vías alternas durante las horas punta. Los trabajos se extenderán por dos semanas, según el cronograma oficial.';

const state={benchmarking:false};
const LAB31_KEYS=['predictorCudaGraphs','chunkMode','minChunkChars','joinPauseMs','lab31Explicit'];

function configPath(rt){return path.join(rt.root,CONFIG_FILE);}
function readConfig(rt){try{const c=JSON.parse(fs.readFileSync(configPath(rt),'utf8'));return c&&typeof c==='object'&&c.models&&typeof c.models==='object'?c:{version:1,models:{}};}catch{return{version:1,models:{}};}}
function writeConfig(rt,cfg){const file=configPath(rt);fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.tmp-${process.pid}`;fs.writeFileSync(tmp,JSON.stringify(cfg,null,2),'utf8');fs.renameSync(tmp,file);}
function modelKey(params={}){return String(params.voiceMode||'reference')==='finetuned'?`finetuned:${String(params.fineTunedModelId||'none')}`:'reference';}
// parámetros que Lab.31 agrega a cada generación de Qwen (los demás los decide la optimización habitual)
function productionParams(entry){
  if(!entry)return null;
  const out={predictorCudaGraphs:entry.predictorCudaGraphs===true};
  if(entry.chunkMode==='sentences')Object.assign(out,{chunkMode:'sentences',minChunkChars:Number(entry.minChunkChars)||200,joinPauseMs:Number(entry.joinPauseMs)||300});
  else out.chunkMode='fixed';
  return out;
}
const median=values=>{const a=values.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const round=(n,d=3)=>Number(Number(n||0).toFixed(d));
const cancelled=()=>({ok:false,error:'Optimización cancelada por el usuario.',code:'OPTIMIZATION_CANCELLED'});
const isCancel=e=>lab30._state.cancelled||String(e?.code||'')==='OPTIMIZATION_CANCELLED';

function installRuntimePatches(){
  const t=TTSLabRuntime.prototype;if(t.__gecLab31Speed)return;Object.defineProperty(t,'__gecLab31Speed',{value:true});
  // el resultado de generate no trae los diagnósticos nuevos del worker: se guardan del último comando
  const baseCommand=t.command;
  t.command=async function(id,payload,...rest){const r=await baseCommand.call(this,id,payload,...rest);if(payload&&payload.cmd==='generate'&&r&&typeof r==='object')this.__lab31LastRaw=r;return r;};
  const baseGenerate=t.generate;
  t.generate=async function(id,text,opts={},...rest){
    global.__gecLabRuntime=this;
    let options=opts||{};
    if(String(id)==='qwen3tts'&&!state.benchmarking&&options.params&&!options.params.lab31Explicit){
      const extra=productionParams(readConfig(this).models[modelKey(options.params)]);
      if(extra)options={...options,params:{...options.params,...extra}};
    }
    this.__lab31LastRaw=null;
    const r=await baseGenerate.call(this,id,text,options,...rest);
    const raw=this.__lab31LastRaw;
    if(String(id)==='qwen3tts'&&r&&typeof r==='object'&&raw)r.lab31={chunkMode:String(raw.chunk_mode||''),chunkChars:Array.isArray(raw.chunk_chars)?raw.chunk_chars:[],join:raw.join||{},predictorGraphs:raw.predictor_cuda_graphs||{}};
    return r;
  };
  const baseBench=t.benchmarkQwenPerformance;
  if(typeof baseBench==='function')t.benchmarkQwenPerformance=wrapBench(baseBench);
}

function wrapBench(baseBench){
  return async function(options={},onProgress=()=>{}){
    global.__gecLabRuntime=this;
    state.benchmarking=true;
    try{
      // la medición habitual siempre parte sin lo de Lab.31 (aunque la configuración guardada lo tenga)
      const clean={...(options.params||{})};for(const k of LAB31_KEYS)delete clean[k];
      options={...options,params:clean};
      const r=await baseBench.call(this,options,onProgress);
      if(!r||r.ok===false)return r;
      try{return await speedPhases(this,r,options,onProgress);}
      catch(e){if(isCancel(e))return cancelled();r.lab31={error:String(e?.message||e)};return r;}
    }finally{state.benchmarking=false;}
  };
}

async function speedPhases(rt,r,options,onProgress){
  const params={...(options.params||{})},finetuned=String(params.voiceMode||'reference')==='finetuned';
  const rec={...(r.recommendedParams||{})},key=modelKey(params);
  const emit=(phase,index,total,label,extra={})=>{try{onProgress({type:'tts-lab-benchmark',phase,index,total,label,...extra});}catch{}};
  const check=()=>{if(lab30._state.cancelled){const e=new Error('cancelada');e.code='OPTIMIZATION_CANCELLED';throw e;}};
  const gen=async(text,p)=>{check();return rt.generate('qwen3tts',text,{...options,params:{...p,lab31Explicit:true,profileGpu:false,profileStages:false}});};
  const drop=a=>{try{if(a?.path)fs.rmSync(a.path,{force:true});}catch{}};
  const safe=a=>Number(a?.realtimeFactor||0)>0&&Number(a?.audioPeak||0)>.005&&Number(a?.audioRms||0)>.0001;

  // ---- 1) CUDA graphs en el predictor (texto de un fragmento, sin lotes: es lo que limita al zero-shot)
  const ref=(r.results||[]).filter(x=>x&&x.safe&&Number(x.rtf)>0&&Number(x.rtf)<999).sort((a,b)=>Math.abs(Number(a.rtf)-Number(r.bestRealtimeFactor))-Math.abs(Number(b.rtf)-Number(r.bestRealtimeFactor)))[0]||null;
  const baselineRtf=Number(r.bestRealtimeFactor||ref?.rtf||0),baselineDur=Number(ref?.medianDurationSec||0);
  const graphParams={...rec,batchSize:1,chunkMode:'fixed',predictorCudaGraphs:true,benchmarkSeed:20260908,consistencyMode:'stable-v1'};
  const graphs={tested:true,enabled:false,baselineRtf:round(baselineRtf),graphRtf:0,runs:[],reason:'',agreement:null,captureMs:0};
  emit('lab31-graphs',1,GRAPH_RUNS+1,'Aceleración del predictor · preparando CUDA graphs');
  try{
    await rt.stopAndWait('qwen3tts');
    const warm=await gen(WARM_TEXT,graphParams);drop(warm);
    const runs=[];let status=warm?.lab31?.predictorGraphs||{};
    for(let i=0;i<GRAPH_RUNS;i++){
      emit('lab31-graphs',i+2,GRAPH_RUNS+1,'Aceleración del predictor · midiendo con CUDA graphs',{repeatIndex:i+1,repeatTotal:GRAPH_RUNS});
      const a=await gen(TEST_TEXT,graphParams);runs.push({rtf:round(a.realtimeFactor),durationSec:round(a.durationSec),safe:safe(a)});status=a?.lab31?.predictorGraphs||status;drop(a);
    }
    graphs.runs=runs;graphs.graphRtf=round(median(runs.filter(x=>x.safe).map(x=>x.rtf)));graphs.agreement=status.agreement??null;graphs.captureMs=Number(status.capture_ms||0);
    const dur=median(runs.map(x=>x.durationSec)),durationOk=!baselineDur||!dur||Math.abs(dur-baselineDur)/baselineDur<=DURATION_TOLERANCE;
    if(!status.active)graphs.reason=status.reason?`no compatible: ${status.reason}`:'no compatible con esta tarjeta o versión';
    else if(runs.some(x=>!x.safe))graphs.reason='el audio de prueba no pasó el control de calidad';
    else if(!durationOk)graphs.reason=`la duración cambió ${Math.round(Math.abs(dur-baselineDur)/baselineDur*100)}% respecto de la medición normal`;
    else if(!(graphs.graphRtf>0&&baselineRtf>0&&graphs.graphRtf<=baselineRtf*(1-GRAPH_MIN_GAIN)))graphs.reason='no fue más rápido que el modo normal';
    else graphs.enabled=true;
  }catch(e){if(isCancel(e))throw e;graphs.reason=`falló la prueba: ${String(e?.message||e).slice(0,200)}`;}
  finally{await rt.stopAndWait('qwen3tts').catch(()=>{});}
  graphs.gainPct=graphs.enabled?round((baselineRtf-graphs.graphRtf)/baselineRtf*100,1):0;

  // ---- 2) fine-tuned: notas realistas con el corte por oraciones + prueba de escucha
  let notes=null,ab=null,chunkMode='fixed';
  if(finetuned){
    const finalParams={...rec,predictorCudaGraphs:graphs.enabled,...SENTENCE_DEFAULTS,consistencyMode:'stable-v1'};
    const abDir=path.join(rt.root,'ab-test');fs.mkdirSync(abDir,{recursive:true});
    for(const name of fs.readdirSync(abDir))if(/\.wav$/i.test(name))try{fs.rmSync(path.join(abDir,name),{force:true});}catch{}
    const keep=(a,name)=>{if(!a?.path)return'';const dst=path.join(abDir,`${name}-${Date.now()}.wav`);try{fs.renameSync(a.path,dst);}catch{try{fs.copyFileSync(a.path,dst);drop(a);}catch{return'';}}return dst;};
    const total=NOTE_RUNS+2;let step=0;
    const row=a=>({rtf:round(a.realtimeFactor),durationSec:round(a.durationSec),chunks:a?.lab31?.chunkChars||[],safe:safe(a)});
    notes={typical:{chars:NOTE_TYPICAL.length,runs:[]},short:{chars:NOTE_SHORT.length,runs:[]}};
    try{
      await rt.stopAndWait('qwen3tts');
      const warm=await gen(WARM_TEXT,finalParams);drop(warm);
      let sentencesPath='';
      for(let i=0;i<NOTE_RUNS;i++){
        emit('lab31-note',++step,total,`Nota típica (${NOTE_TYPICAL.length} caracteres) · corte por oraciones`,{repeatIndex:i+1,repeatTotal:NOTE_RUNS});
        const a=await gen(NOTE_TYPICAL,finalParams);notes.typical.runs.push(row(a));
        if(i===NOTE_RUNS-1)sentencesPath=keep(a,'corte-oraciones');else drop(a);
      }
      emit('lab31-note',++step,total,`Nota corta (${NOTE_SHORT.length} caracteres) · corte por oraciones`);
      const s=await gen(NOTE_SHORT,finalParams);notes.short.runs.push(row(s));drop(s);
      emit('lab31-note',++step,total,'Prueba de escucha · misma nota con el corte actual de 360 caracteres');
      const f=await gen(NOTE_TYPICAL,{...finalParams,chunkMode:'fixed',chunkChars:360});notes.fixed={chars:NOTE_TYPICAL.length,runs:[row(f)]};
      const fixedPath=keep(f,'corte-360');
      for(const k of ['typical','short','fixed']){const n=notes[k];n.rtf=round(median(n.runs.filter(x=>x.safe).map(x=>x.rtf)));n.chunks=(n.runs[n.runs.length-1]||{}).chunks||[];n.ok=n.runs.length>0&&n.runs.every(x=>x.safe);}
      chunkMode=notes.typical.ok&&notes.short.ok?'sentences':'fixed';
      ab={sentencesPath,fixedPath,sentencesRtf:notes.typical.rtf,fixedRtf:notes.fixed.rtf,choice:chunkMode};
    }catch(e){if(isCancel(e))throw e;notes.error=String(e?.message||e).slice(0,200);chunkMode='fixed';}
    finally{await rt.stopAndWait('qwen3tts').catch(()=>{});}
  }

  const entry={predictorCudaGraphs:graphs.enabled,chunkMode,...(chunkMode==='sentences'?{minChunkChars:SENTENCE_DEFAULTS.minChunkChars,joinPauseMs:SENTENCE_DEFAULTS.joinPauseMs}:{}),graphs,notes,ab,mode:finetuned?'finetuned':'reference',fineTunedModelId:finetuned?String(params.fineTunedModelId||''):'',at:new Date().toISOString()};
  const cfg=readConfig(rt);cfg.models[key]=entry;cfg.lastKey=key;writeConfig(rt,cfg);
  r.lab31=entry;
  if(graphs.enabled){r.baselineRealtimeFactorWithoutGraphs=r.bestRealtimeFactor;r.bestRealtimeFactor=graphs.graphRtf;r.recommendedLabel=`${r.recommendedLabel||''} · CUDA graphs`.replace(/^ · /,'');}
  if(chunkMode==='sentences'&&notes?.typical?.rtf)r.noteRealtimeFactor=notes.typical.rtf;
  emit('lab31-done',1,1,'Aceleración lista',{lab31:entry});
  return r;
}

// La optimización arma optimization0321 de cero (sin ttsOptimizationKey). Al guardar, releaseV2Lab lo tomaba como
// de otro modelo y lo reemplazaba por la optimización anterior en caché: con el fine-tuned la insignia quedaba
// "SIN OPTIMIZAR" aunque la optimización acababa de terminar.
function installSaveKeyFix(){
  const p=SettingsStore.prototype;if(p.__gecLab31SaveKey)return;Object.defineProperty(p,'__gecLab31SaveKey',{value:true});
  const baseSave=p.save;
  p.save=function(settings,...rest){
    const s=settings&&typeof settings==='object'?settings:null,o=s?.optimization0321;
    if(o&&typeof o==='object'&&!o.ttsOptimizationKey&&String(o.ttsEngine||'')===String(s.tts?.engine||'kokoro')){
      try{o.ttsOptimizationKey=lab.optimizationKey(s.tts||{});}catch{}
    }
    return baseSave.call(this,settings,...rest);
  };
}

function runtimeForIpc(){return global.__gecLabRuntime||(typeof lab.labRuntime==='function'?lab.labRuntime():null);}
function installIpc(){
  if(global.__gecLab31Ipc)return;global.__gecLab31Ipc=true;
  const {pathToFileURL}=require('url');
  const view=entry=>{if(!entry)return null;const out=JSON.parse(JSON.stringify(entry));if(out.ab)for(const k of ['sentencesPath','fixedPath']){const f=out.ab[k];out.ab[k.replace('Path','Url')]=f&&fs.existsSync(f)?pathToFileURL(f).href:'';}return out;};
  ipcMain.handle('qwenSpeed:get',(_e,params={})=>{const rt=runtimeForIpc();if(!rt)return{ok:false,error:'Laboratorio de voz no disponible'};const cfg=readConfig(rt),key=modelKey(params||{});return{ok:true,key,entry:view(cfg.models[key]||null)};});
  ipcMain.handle('qwenSpeed:setChunkMode',(_e,{params={},mode='sentences'}={})=>{
    const rt=runtimeForIpc();if(!rt)return{ok:false,error:'Laboratorio de voz no disponible'};
    const cfg=readConfig(rt),key=modelKey(params||{}),entry=cfg.models[key];if(!entry)return{ok:false,error:'Primero optimiza este modelo'};
    if(mode==='sentences'){Object.assign(entry,{chunkMode:'sentences',minChunkChars:entry.minChunkChars||SENTENCE_DEFAULTS.minChunkChars,joinPauseMs:entry.joinPauseMs||SENTENCE_DEFAULTS.joinPauseMs});}
    else entry.chunkMode='fixed';
    if(entry.ab)entry.ab.choice=entry.chunkMode;entry.choiceAt=new Date().toISOString();
    cfg.models[key]=entry;writeConfig(rt,cfg);return{ok:true,key,entry:view(entry)};
  });
}

function installReleaseV2QwenSpeedLab31(){installRuntimePatches();installSaveKeyFix();installIpc();}

module.exports={installReleaseV2QwenSpeedLab31,_modelKey:modelKey,_productionParams:productionParams,_wrapBench:wrapBench,_speedPhases:speedPhases,_state:state,NOTE_TYPICAL,NOTE_SHORT,TEST_TEXT};
