'use strict';
// Lab.44 · meta de RTF 0,65 y optimización rápida, con el benchmarkQwenPerformance real y un motor simulado.
const fs=require('fs'),path=require('path'),assert=require('assert');
const {TTSLabRuntime}=require('../src/services/ttsLabRuntime');
const Q=require('../src/services/optimizationQuickLab44');
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);},eq=(a,b,m)=>{checks++;assert.deepStrictEqual(a,b,m);};

// meta: lógica pura
const row=(id,rtf,extra={})=>({id,label:id,eligible:true,safe:true,rtf,worstRealtimeFactor:rtf+.03,runCount:3,talkerStepsMedian:100,medianDurationSec:14,...extra});
ok(Q.targetReached([row('baseline',.62)]),'la base ya llega a 0,65: se detiene');
ok(!Q.targetReached([row('baseline',.70)]),'base en 0,70: sigue probando');
ok(Q.targetReached([row('baseline',.80),row('hidden-off',.60)]),'una variante comparable y 5 % más rápida que llega a la meta: se detiene');
ok(!Q.targetReached([row('baseline',.66),row('hidden-off',.64)]),'variante en la meta pero solo 3 % más rápida (no se elegiría): sigue');
ok(!Q.targetReached([row('baseline',.80),row('hidden-off',.60,{medianDurationSec:16})]),'variante que cambia la duración no cuenta');
ok(!Q.targetReached([row('baseline',.60,{worstRealtimeFactor:.9})]),'una corrida mala (peor > 0,75) no es estable');
ok(!Q.targetReached([row('baseline',.60,{runCount:1})]),'con una sola corrida no alcanza');
ok(!Q.targetReached([{...row('baseline',.5),safe:false}]),'base inválida: no se detiene');

// motor simulado: cada variante tiene su RTF; se cuentan las corridas
const ipc={handlers:{},removeHandler(k){delete this.handlers[k];},handle(k,fn){this.handlers[k]=fn;}};
const RTF={baseline:.9,'hidden-off':.6,subk20:.7,subk10:.5};
function fakeRuntime(rtfs){
  const rt=Object.create(TTSLabRuntime.prototype);rt.calls=[];
  rt.qwenCapabilities=async()=>({gpu_vram_mb:10240});
  rt.stopAndWait=async()=>true;
  rt.generate=async(_id,text,{params={}}={})=>{
    const key=params.batchBenchmarkMode?`batch-${params.batchSize}`:params.predictorHiddenStates===false?(params.subtalkerTopK===20?'subk20':params.subtalkerTopK===10?'subk10':'hidden-off'):'baseline';
    if(!params.profileGpu&&!/verifica el rendimiento/.test(text))rt.calls.push(key);
    const rtf=params.batchBenchmarkMode?.5:rtfs[key];
    return{realtimeFactor:rtf,elapsedMs:1000,durationSec:14,audioPeak:.5,audioRms:.1,stageTimings:{talker_output_frames:100},gpuTelemetry:{}};
  };
  return rt;
}
(async()=>{
  Q.installOptimizationQuickLab44({electron:{ipcMain:ipc}});Q.installOptimizationQuickLab44({electron:{ipcMain:ipc}});
  ok(typeof ipc.handlers['optimization:setMode']==='function','IPC optimization:setMode');
  const P={voiceMode:'finetuned'};

  // completa: base 0,9 → hidden-off 0,6 alcanza la meta → subk20 y subk10 se omiten
  Q.setMode('full');
  let rt=fakeRuntime(RTF),r=await rt.benchmarkQwenPerformance({params:P,skipDiagnostic:true,sampleLimit:3});
  eq(r.results.map(x=>x.id),['baseline','hidden-off','subk20','subk10'],'aparecen todas las variantes');
  eq(r.targetSkipped,['subk20','subk10'],'las que faltaban se omiten al alcanzar la meta');
  ok(r.results.find(x=>x.id==='subk20').error.includes('meta'),'el motivo dice que se alcanzó la meta');
  eq(rt.calls.filter(k=>!k.startsWith('batch')).length,6,'solo se midieron 2 variantes × 3 corridas');
  ok(r.recommendedParams.predictorHiddenStates===false&&r.bestRealtimeFactor===.6,'se elige la variante que llegó a la meta');
  eq([...new Set(rt.calls.filter(k=>k.startsWith('batch')))],['batch-1','batch-2','batch-4','batch-8'],'completa: lotes B1, B2, B4 y B8');
  eq([r.optimizationMode,r.rtfTarget],['full',.65],'informa modo y meta');

  // completa sin llegar a la meta: prueba todas
  rt=fakeRuntime({baseline:.9,'hidden-off':.85,subk20:.8,subk10:.75});r=await rt.benchmarkQwenPerformance({params:P,skipDiagnostic:true,sampleLimit:3});
  eq(r.targetSkipped,[],'sin meta alcanzada no se omite nada');
  eq(rt.calls.filter(k=>!k.startsWith('batch')).length,12,'4 variantes × 3 corridas');

  // rápida: base + subk20, 2 corridas, lotes B1 y B4
  eq((await ipc.handlers['optimization:setMode'](null,'quick')).mode,'quick','modo rápido por IPC');
  rt=fakeRuntime({baseline:.9,'hidden-off':.85,subk20:.8,subk10:.75});r=await rt.benchmarkQwenPerformance({params:P,skipDiagnostic:true,sampleLimit:3});
  eq(r.results.map(x=>x.id),['baseline','subk20'],'rápida: solo la base y top-k 20');
  eq(rt.calls.filter(k=>!k.startsWith('batch')).length,4,'rápida: 2 corridas por variante');
  eq([...new Set(rt.calls.filter(k=>k.startsWith('batch')))],['batch-1','batch-4'],'rápida: lotes B1 y B4');
  eq(r.optimizationMode,'quick','informa el modo rápido');
  Q.setMode('full');eq(Q.mode(),'full','vuelve al modo completo');

  // zero-shot: un solo lote, aunque la rápida pida B4
  Q.setMode('quick');rt=fakeRuntime(RTF);r=await rt.benchmarkQwenPerformance({params:{voiceMode:'reference'},skipDiagnostic:true});
  eq([...new Set(rt.calls.filter(k=>k.startsWith('batch')))],['batch-1'],'zero-shot: solo B1');Q.setMode('full');

  // IA de texto: la rápida usa 3 configuraciones
  const list=[{id:'current'},{id:'gpu-28'},{id:'gpu-48'},{id:'gpu-full-balanced'},{id:'gpu-full-fast'}];
  class FakeLocal{__ec0320BenchmarkCandidates(){return list;}}
  ok(Q.wrapLocalCandidates(FakeLocal.prototype)&&!Q.wrapLocalCandidates(FakeLocal.prototype),'IA de texto: se envuelve una sola vez');
  eq(new FakeLocal().__ec0320BenchmarkCandidates().length,5,'completa: 5 configuraciones de la IA de texto');
  Q.setMode('quick');eq(new FakeLocal().__ec0320BenchmarkCandidates().map(x=>x.id),['current','gpu-full-balanced','gpu-full-fast'],'rápida: 3 configuraciones');Q.setMode('full');
  const svc=fs.readFileSync(path.join(__dirname,'..','src','services','optimizationQuickLab44.js'),'utf8');
  ok(/localIds:\s*\['current', 'gpu-full-balanced', 'gpu-full-fast'\]/.test(svc),'rápida: IA de texto con 3 configuraciones');

  const lab30=fs.readFileSync(path.join(__dirname,'..','src','services','releaseV2GpuIsolationLab30.js'),'utf8');
  ok(/sampleLimit:Math\.min\(QWEN_SAMPLE_LIMIT,Number\(options\.sampleLimit\)\|\|QWEN_SAMPLE_LIMIT\)/.test(lab30),'Lab.30 respeta un límite de corridas menor');
  const lab31=fs.readFileSync(path.join(__dirname,'..','src','services','releaseV2QwenSpeedLab31.js'),'utf8');
  ok(/options\.quickOptimization\?2:GRAPH_RUNS/.test(lab31),'Lab.31: aceleración del predictor con 2 corridas en la rápida');
  const pre=fs.readFileSync(path.join(__dirname,'..','src','preload.js'),'utf8');
  ok(/optimizationSetMode:m=>invoke\('optimization:setMode',m\)/.test(pre)&&/renderer-optimization-quick-lab44\.js/.test(pre),'preload expone el modo y el botón');
  const rd=fs.readFileSync(path.join(__dirname,'..','src','renderer-optimization-quick-lab44.js'),'utf8');
  ok(/Optimización rápida/.test(rd)&&/optimizationSetMode\('full'\)/.test(rd)&&/RTF 0,65/.test(rd),'botón rápido, vuelve al modo completo y nota de la meta');
  const boot=fs.readFileSync(path.join(__dirname,'..','src','bootstrap-v2lab.js'),'utf8');
  ok(/optimizationQuickLab44'\)\.installOptimizationQuickLab44\(\)/.test(boot),'bootstrap instala Lab.44');
  console.log(`check-optimization-quick-lab44 OK (${checks} verificaciones) · meta 0,65 · rápida · lotes · IPC`);
})().catch(e=>{console.error('check-optimization-quick-lab44: '+(e.stack||e.message));process.exit(1);});
