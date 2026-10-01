'use strict';
// Lab.31 · Qwen3-TTS más rápido: CUDA graphs del predictor, corte por oraciones, prueba de escucha e insignia.
const Module=require('module'),path=require('path'),fs=require('fs'),os=require('os'),assert=require('assert');
const handlers=new Map(),baseLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='electron')return{app:{isPackaged:false,getPath:()=>os.tmpdir(),on(){},whenReady:()=>new Promise(()=>{})},ipcMain:{handle:(k,fn)=>handlers.set(k,fn),on(){},removeHandler:k=>handlers.delete(k)},BrowserWindow:function(){},dialog:{},shell:{}};
  return baseLoad.call(this,request,parent,isMain);
};
const root=path.join(__dirname,'..'),src=path.join(root,'src'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {TTSLabRuntime}=require(path.join(src,'services','ttsLabRuntime.js'));
const {SettingsStore}=require(path.join(src,'services','settings.js'));
const lab30=require(path.join(src,'services','releaseV2GpuIsolationLab30.js'));
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};

(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-lab31-'));
  // motor simulado: RTF 1,6 normal y 0,8 con CUDA graphs; el "worker" informa el estado de los graphs
  const calls=[];let graphsActive=true,graphDurationFactor=1;
  TTSLabRuntime.prototype.command=async function(id,payload){
    const p=payload.params||{};
    return{chunk_mode:p.chunkMode==='sentences'?'sentences':'fixed',chunk_chars:p.chunkMode==='sentences'?[214,214,214,216]:[360,360,138],join:{},predictor_cuda_graphs:p.predictorCudaGraphs?{enabled:true,active:graphsActive,agreement:1,capture_ms:420,reason:graphsActive?'':'sin GPU CUDA'}:{enabled:false,active:false}};
  };
  TTSLabRuntime.prototype.generate=async function(id,text,opts={}){
    const p=opts.params||{};calls.push({id,text,params:p});
    await this.command(id,{cmd:'generate',params:p});
    const file=path.join(tmp,`a-${calls.length}.wav`);fs.writeFileSync(file,Buffer.alloc(2000));
    const graphs=p.predictorCudaGraphs&&graphsActive;
    return{path:file,realtimeFactor:graphs?.8:1.6,durationSec:15*(graphs?graphDurationFactor:1),audioPeak:.5,audioRms:.1};
  };
  TTSLabRuntime.prototype.stopAndWait=async function(){};
  let baseOptions=null;
  TTSLabRuntime.prototype.benchmarkQwenPerformance=async function(options){baseOptions=options;return{ok:true,bestRealtimeFactor:1.6,results:[{safe:true,rtf:1.6,medianDurationSec:15}],recommendedParams:{batchSize:8,chunkChars:360,predictorHiddenStates:false},recommendedLabel:'BF16 · batch B8'};};
  const saved=[];SettingsStore.prototype.save=function(s){saved.push(JSON.parse(JSON.stringify(s)));return s;};

  const mod=require(path.join(src,'services','releaseV2QwenSpeedLab31.js'));
  mod.installReleaseV2QwenSpeedLab31();
  ok(handlers.has('qwenSpeed:get')&&handlers.has('qwenSpeed:setChunkMode'),'faltan los IPC de Lab.31');
  const rt=Object.create(TTSLabRuntime.prototype);rt.root=tmp;global.__gecLabRuntime=rt;

  // 1) zero-shot: la medición base parte sin lo de Lab.31 y los CUDA graphs se activan si son más rápidos
  const zsParams={voiceMode:'reference',predictorCudaGraphs:true,chunkMode:'sentences'};
  const r=await rt.benchmarkQwenPerformance({referenceVoiceId:'v1',params:zsParams},()=>{});
  ok(baseOptions&&!('predictorCudaGraphs' in baseOptions.params)&&!('chunkMode' in baseOptions.params),'la medición base no debe heredar CUDA graphs ni el corte por oraciones');
  ok(r.lab31&&r.lab31.graphs.enabled===true&&r.lab31.graphs.graphRtf===.8&&r.lab31.graphs.baselineRtf===1.6,'debía activar los CUDA graphs (0,8 contra 1,6)');
  ok(r.bestRealtimeFactor===.8&&r.baselineRealtimeFactorWithoutGraphs===1.6&&/CUDA graphs/.test(r.recommendedLabel),'el resultado debe mostrar el RTF con aceleración');
  ok(r.lab31.chunkMode==='fixed'&&!r.lab31.notes&&!r.lab31.ab,'el zero-shot no cambia el corte ni hace prueba de escucha');
  ok(calls.filter(c=>c.params.predictorCudaGraphs).every(c=>c.params.lab31Explicit&&c.params.batchSize===1),'la prueba de graphs es explícita y sin lotes');
  ok(calls.filter(c=>c.params.predictorCudaGraphs).every(c=>c.text===mod.TEST_TEXT||/rendimiento/.test(c.text)),'la prueba de graphs usa el mismo texto que la medición base');

  // 2) producción: cada generación de Qwen recibe lo elegido para ese modelo
  calls.length=0;
  await rt.generate('qwen3tts','Nota.',{params:{voiceMode:'reference',chunkChars:360}});
  ok(calls[0].params.predictorCudaGraphs===true&&calls[0].params.chunkMode==='fixed','producción zero-shot sin los CUDA graphs elegidos');
  await rt.generate('chatterbox','Nota.',{params:{}});
  ok(!('predictorCudaGraphs' in calls[1].params),'Chatterbox no debe recibir parámetros de Qwen');
  const res=await rt.generate('qwen3tts','Nota.',{params:{voiceMode:'reference'}});
  ok(res.lab31&&res.lab31.predictorGraphs&&res.lab31.predictorGraphs.active===true,'el resultado debe traer el estado de los graphs del worker');

  // 3) fine-tuned: notas realistas, prueba de escucha y corte por oraciones
  calls.length=0;
  const ftParams={voiceMode:'finetuned',fineTunedModelId:'m1'};
  const events=[];
  const f=await rt.benchmarkQwenPerformance({params:ftParams},e=>events.push(e));
  const e31=f.lab31;
  ok(e31.chunkMode==='sentences'&&e31.minChunkChars===200&&e31.joinPauseMs===300,'fine-tuned debe quedar con el corte por oraciones');
  ok(e31.notes.typical.rtf>0&&e31.notes.short.rtf>0&&e31.notes.typical.chars===mod.NOTE_TYPICAL.length,'faltan las mediciones de notas realistas');
  ok(e31.notes.typical.chunks.length===4,'la nota típica debe informar sus fragmentos');
  ok(e31.ab&&fs.existsSync(e31.ab.sentencesPath)&&fs.existsSync(e31.ab.fixedPath),'faltan los audios de la prueba de escucha');
  ok(path.dirname(e31.ab.sentencesPath)===path.join(tmp,'ab-test'),'los audios de la prueba de escucha van en tts-lab/ab-test');
  const fixedCall=calls.find(c=>c.params.chunkMode==='fixed'&&c.text===mod.NOTE_TYPICAL);
  ok(fixedCall&&fixedCall.params.chunkChars===360,'la prueba de escucha compara con el corte de 360');
  ok(calls.filter(c=>c.params.chunkMode==='sentences').every(c=>c.params.batchSize===8&&c.params.predictorCudaGraphs===true),'las notas se miden con el lote elegido y los graphs');
  ok(['lab31-graphs','lab31-note','lab31-done'].every(ph=>events.some(e=>e.phase===ph&&e.type==='tts-lab-benchmark')),'faltan los eventos de progreso de Lab.31');

  // 4) IPC: ver y elegir el corte
  const got=await handlers.get('qwenSpeed:get')({},ftParams);
  ok(got.ok&&got.key==='finetuned:m1'&&got.entry.ab.sentencesUrl.startsWith('file:')&&got.entry.ab.fixedUrl.startsWith('file:'),'qwenSpeed:get debe devolver los audios como file://');
  const set=await handlers.get('qwenSpeed:setChunkMode')({},{params:ftParams,mode:'fixed'});
  ok(set.ok&&set.entry.chunkMode==='fixed'&&set.entry.ab.choice==='fixed','qwenSpeed:setChunkMode fixed');
  calls.length=0;await rt.generate('qwen3tts','Nota.',{params:{...ftParams,chunkMode:'sentences'}});
  ok(calls[0].params.chunkMode==='fixed','la elección de la prueba de escucha debe ganarle a la configuración guardada');
  await handlers.get('qwenSpeed:setChunkMode')({},{params:ftParams,mode:'sentences'});
  calls.length=0;await rt.generate('qwen3tts','Nota.',{params:ftParams});
  ok(calls[0].params.chunkMode==='sentences'&&calls[0].params.minChunkChars===200,'volver al corte por oraciones');
  ok((await handlers.get('qwenSpeed:setChunkMode')({},{params:{voiceMode:'finetuned',fineTunedModelId:'otro'},mode:'fixed'})).ok===false,'modelo sin optimizar');

  // 5) graphs que no se activan: no compatibles, o cambian la duración del audio
  graphsActive=false;
  const nc=await rt.benchmarkQwenPerformance({referenceVoiceId:'v1',params:{voiceMode:'reference'}},()=>{});
  ok(nc.lab31.graphs.enabled===false&&/no compatible/.test(nc.lab31.graphs.reason)&&nc.bestRealtimeFactor===1.6,'graphs no compatibles deben quedar desactivados');
  graphsActive=true;graphDurationFactor=1.3;
  const dc=await rt.benchmarkQwenPerformance({referenceVoiceId:'v1',params:{voiceMode:'reference'}},()=>{});
  ok(dc.lab31.graphs.enabled===false&&/duración/.test(dc.lab31.graphs.reason),'un cambio de duración desactiva los graphs');
  graphDurationFactor=1;
  calls.length=0;await rt.generate('qwen3tts','Nota.',{params:{voiceMode:'reference'}});
  ok(calls[0].params.predictorCudaGraphs===false,'producción respeta la última decisión');

  // 6) cancelación durante las fases nuevas
  const baseGen=TTSLabRuntime.prototype.generate;let n=0;
  rt.generate=async function(...a){if(++n===2)lab30._setCancelled(true);return baseGen.apply(this,a);};
  const cancelled=await rt.benchmarkQwenPerformance({referenceVoiceId:'v1',params:{voiceMode:'reference'}},()=>{});
  ok(cancelled.ok===false&&cancelled.code==='OPTIMIZATION_CANCELLED','cancelar durante la aceleración debe devolver cancelada');
  lab30._setCancelled(false);delete rt.generate;

  // 7) insignia: el optimizador guarda optimization0321 sin clave; se completa con la del modelo actual
  new SettingsStore(tmp).save({tts:{engine:'qwen3tts',engineParams:{qwen3tts:{voiceMode:'finetuned',fineTunedModelId:'m1'}}},optimization0321:{ttsEngine:'qwen3tts',at:'x'}});
  ok(saved[saved.length-1].optimization0321.ttsOptimizationKey==='qwen3tts:finetuned:m1','optimization0321 debe guardarse con la clave del fine-tuned');
  new SettingsStore(tmp).save({tts:{engine:'qwen3tts',engineParams:{qwen3tts:{voiceMode:'finetuned',fineTunedModelId:'m2'}}},optimization0321:{ttsEngine:'qwen3tts',ttsOptimizationKey:'qwen3tts:finetuned:m1'}});
  ok(saved[saved.length-1].optimization0321.ttsOptimizationKey==='qwen3tts:finetuned:m1','una clave existente (otro modelo) no se toca');
  new SettingsStore(tmp).save({tts:{engine:'chatterbox'},optimization0321:{ttsEngine:'qwen3tts'}});
  ok(!saved[saved.length-1].optimization0321.ttsOptimizationKey,'una optimización de otro motor no recibe clave');

  // 8) worker, empaquetado y panel
  const worker=read('src/tts_lab_worker.py'),py=read('src/qwen_speed_lab31.py'),prep=read('scripts/prepare-windows-runtime.ps1'),preload=read('src/preload.js'),boot=read('src/bootstrap-v2lab.js'),pkg=JSON.parse(read('package.json'));
  ok(/sys\.path\.insert\(0, os\.path\.dirname\(os\.path\.abspath\(__file__\)\)\)/.test(worker)&&/import qwen_speed_lab31 as LAB31/.test(worker),'el worker debe importar qwen_speed_lab31 desde su carpeta');
  ok((worker.match(/^\s+_lab31_graphs\(model, params\)$/gm)||[]).length===3,'los CUDA graphs deben aplicarse en zero-shot, fine-tuned y lotes');
  ok(/LAB31\.balanced_chunks\(/.test(worker)&&/LAB31\.join_pieces\(/.test(worker)&&/"predictor_cuda_graphs"/.test(worker),'faltan el corte por oraciones, las uniones o el diagnóstico en el worker');
  ok(/qwen_mode == "finetuned"/.test(worker.slice(worker.indexOf('LAB31.balanced_chunks')-400,worker.indexOf('LAB31.balanced_chunks'))),'el corte por oraciones es solo para el fine-tuned');
  ok(/self\.orig\(inputs_embeds=embeds, max_new_tokens=self\.steps, do_sample=False/.test(py)&&/output_logits=True/.test(py),'los graphs deben verificarse contra el generate original');
  ok(/VERIFY_FRAMES = [5-9]\b/.test(py)&&/MIN_EXACT = 0\.6/.test(py)&&/MIN_NEAR = 0\.98/.test(py)&&/near = same \| \(gap <= self\.tie\)/.test(py),'la verificación debe juntar varios frames y aceptar fichas casi empatadas (bf16), no exigir 85 % en un frame');
  ok(/if not self\.verified:\s+with torch\.inference_mode\(\):\s+self\._verify\(embeds\)\s+if self\.verified:/.test(py),'mientras verifica, cada frame lo genera el original');
  ok(/except Exception as exc:\s+self\.active = False/.test(py)&&/return self\.orig\(\*args, \*\*kwargs\)/.test(py),'ante una falla los graphs deben volver al generate original');
  ok(/qwen_speed_lab31\.py/.test(prep),'prepare-windows-runtime.ps1 debe copiar qwen_speed_lab31.py junto al worker');
  ok(/qwenSpeedGet/.test(preload)&&/qwenSpeedSetChunkMode/.test(preload)&&/renderer-qwen-speed-lab31\.js/.test(preload),'preload debe exponer la API e inyectar el panel de Lab.31');
  ok(boot.indexOf('releaseV2QwenSpeedLab31')>boot.indexOf('releaseV2GpuIsolationLab30'),'Lab.31 se instala después de Lab.30');
  ok(/check-qwen-speed-lab31\.py/.test(pkg.scripts.check)&&/py_compile src\/qwen_speed_lab31\.py/.test(pkg.scripts.check),'el script check debe correr los checks de Lab.31');

  fs.rmSync(tmp,{recursive:true,force:true});
  console.log(`check-qwen-speed-lab31.js OK (${checks} verificaciones)`);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
