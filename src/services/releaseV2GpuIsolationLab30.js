'use strict';
// Lab.30 · GPU limpia en la optimización y cancelación.
// - La IA de texto (llama-server) espera a que el proceso anterior termine de verdad antes de cargar otra configuración:
//   en Windows la VRAM recién se libera cuando el proceso sale, y solapar dos servidores llena la tarjeta.
// - Antes de medir la IA de texto se descargan los motores de voz (y viceversa), esperando su salida real.
// - Si con los motores de GEC detenidos la GPU sigue ocupada (otro programa), se detiene la optimización y se dice cuál.
// - La optimización se puede cancelar desde el panel (IPC optimization:cancel).
const {spawn}=require('child_process');
const {ipcMain}=require('electron');
const {LocalRuntime}=require('./localRuntime');
const {TTSLabRuntime}=require('./ttsLabRuntime');
const {KokoroTTS}=require('./kokoro');

const FOREIGN_VRAM_LIMIT_MB=2560;
// optimización más corta: 3 repeticiones por configuración de voz (antes 5), sin la configuración de diagnóstico
// que nunca se elige, y la IA de texto descarta antes (2,5× el mejor tiempo en vez de 5×).
const QWEN_SAMPLE_LIMIT=3,LOCAL_CUTOFF_DIVISOR=2;
const EXIT_WAIT_MS=8000;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const state={cancelled:false,timer:null};
// la marca de cancelado se borra al terminar la optimización (el panel llama a cancelReset) o sola a los 90 s,
// para que la emisión normal nunca quede bloqueada.
function setCancelled(v){state.cancelled=!!v;clearTimeout(state.timer);state.timer=null;if(v){state.timer=setTimeout(()=>{state.cancelled=false;state.timer=null;},90000);state.timer.unref?.();}}

function cancelledError(){const e=new Error('Optimización cancelada por el usuario.');e.code='OPTIMIZATION_CANCELLED';return e;}
function throwIfCancelled(){if(state.cancelled)throw cancelledError();}
const cancelledResult=(extra={})=>({ok:false,error:cancelledError().message,code:'OPTIMIZATION_CANCELLED',...extra});

function waitExit(child,ms){
  return new Promise(resolve=>{
    if(!child||child.exitCode!=null||child.signalCode!=null)return resolve(true);
    let done=false;const finish=v=>{if(!done){done=true;clearTimeout(t);resolve(v);}};
    const t=setTimeout(()=>finish(false),ms);child.once('exit',()=>finish(true));
  });
}
async function ensureExit(child){
  if(await waitExit(child,EXIT_WAIT_MS))return true;
  try{if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});else child.kill('SIGKILL');}catch{}
  return waitExit(child,4000);
}

function run(cmd,args,timeoutMs=8000){
  return new Promise(resolve=>{
    let out='',done=false,child;
    const finish=v=>{if(!done){done=true;clearTimeout(t);resolve(v);}};
    try{child=spawn(cmd,args,{windowsHide:true});}catch{return resolve(null);}
    const t=setTimeout(()=>{try{child.kill();}catch{}finish(null);},timeoutMs);
    child.stdout?.on('data',d=>{out+=d.toString();});child.on('error',()=>finish(null));child.on('close',code=>finish(code===0?out:null));
  });
}
// Uso de VRAM total y procesos que la usan (en Windows/WDDM el detalle por proceso suele venir como N/A).
function parseProcesses(text){
  const rows=[];let inTable=false;
  for(const line of String(text||'').split(/\r?\n/)){
    if(/\|\s*Processes:/i.test(line)){inTable=true;continue;}
    if(!inTable)continue;
    const m=line.match(/^\|\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(C\+G|C|G)\s+(.+?)\s+(\d+MiB|N\/A)\s+\|$/);
    if(!m)continue;
    const name=m[3].split(/[\\/]/).pop().trim(),mem=/MiB$/.test(m[4])?Number(m[4].replace('MiB','')):0;
    rows.push({pid:Number(m[1]),type:m[2],name,usedMb:mem});
  }
  return rows;
}
async function gpuSnapshot(){
  const q=await run('nvidia-smi',['--query-gpu=memory.used,memory.total','--format=csv,noheader,nounits']);
  if(!q)return null;
  const [used,total]=q.trim().split(/\r?\n/)[0].split(',').map(x=>Number(String(x).trim()));
  if(!Number.isFinite(used)||!Number.isFinite(total))return null;
  const table=await run('nvidia-smi',[]);
  return{usedMb:used,totalMb:total,processes:parseProcesses(table)};
}
const OWN=/^(EC Automatic News|electron|llama-server|python)(\.exe)?$/i;
function describeForeign(snap){
  const foreign=(snap?.processes||[]).filter(p=>!OWN.test(p.name)&&!/^(dwm|explorer|csrss|ShellExperienceHost|SearchHost|StartMenuExperienceHost|TextInputHost)\.exe$/i.test(p.name));
  const names=[...new Map(foreign.map(p=>[p.name.toLowerCase(),p])).values()].sort((a,b)=>b.usedMb-a.usedMb);
  return names.slice(0,8).map(p=>p.usedMb?`${p.name} (${(p.usedMb/1024).toFixed(1)} GB)`:p.name).join(', ');
}
// Comprueba que la GPU esté libre con los motores de GEC detenidos. Devuelve el snapshot o lanza un error explicativo.
async function assertGpuFree(stage){
  await sleep(800);
  const snap=await gpuSnapshot();
  if(!snap)return null;
  if(snap.usedMb>=FOREIGN_VRAM_LIMIT_MB){
    const who=describeForeign(snap);
    const e=new Error(`Antes de medir ${stage}, la GPU ya tiene ${(snap.usedMb/1024).toFixed(1)} de ${(snap.totalMb/1024).toFixed(1)} GB ocupados por otros programas${who?`: ${who}`:''}. Con la tarjeta ocupada la medición es mucho más lenta y elige una configuración peor. Cierra esos programas (revisa también el Administrador de tareas) y vuelve a optimizar.`);
    e.code='GPU_BUSY_BEFORE_BENCHMARK';e.gpuBaseline=snap;throw e;
  }
  return snap;
}

function installLocalRuntimePatches(){
  const p=LocalRuntime.prototype;if(p.__gecLab30Gpu)return;Object.defineProperty(p,'__gecLab30Gpu',{value:true});
  const baseStop=p.stop,baseStart=p._start,baseRequest=p.__ec0320Request,baseBench=p.benchmarkLocalAI;
  p.stop=function(...args){
    global.__gecLocalRuntime=this;const child=this.server;const r=baseStop.apply(this,args);
    if(child){const w=ensureExit(child);this.__gecExitWait=w;w.finally(()=>{if(this.__gecExitWait===w)this.__gecExitWait=null;});}
    return r;
  };
  p.stopAndWaitExit=async function(reason='lab30-gpu-isolation'){this.stop(reason);if(this.__gecExitWait)await this.__gecExitWait;return true;};
  p._start=async function(...args){global.__gecLocalRuntime=this;if(this.__gecExitWait)await this.__gecExitWait;throwIfCancelled();return baseStart.apply(this,args);};
  if(typeof baseRequest==='function')p.__ec0320Request=async function(...args){throwIfCancelled();return baseRequest.apply(this,args);};
  if(typeof baseBench==='function')p.benchmarkLocalAI=async function(...args){
    global.__gecLocalRuntime=this;if(state.cancelled)return cancelledResult({results:[]});
    const lab=global.__gecLabRuntime;if(lab)try{await lab.stopAndWait();}catch{}
    await this.stopAndWaitExit('lab30-before-local-benchmark');
    let baseline=null;
    try{baseline=await assertGpuFree('la IA de texto');}catch(e){return{ok:false,error:e.message,code:e.code,gpuBaseline:e.gpuBaseline||null,results:[]};}
    this.__gecCutoffDivisor=LOCAL_CUTOFF_DIVISOR;
    try{const r=await baseBench.apply(this,args);if(state.cancelled)return cancelledResult({results:[]});if(r&&typeof r==='object')r.gpuBaseline=baseline;return r;}
    catch(e){if(state.cancelled)return cancelledResult({results:[]});throw e;}
    finally{this.__gecCutoffDivisor=1;}
  };
}

function wrapQwenBench(baseQwenBench){
  return async function(...args){
    global.__gecLabRuntime=this;if(state.cancelled)return cancelledResult();
    const local=global.__gecLocalRuntime||global.__ec0320LocalRuntime;if(local?.stopAndWaitExit)await local.stopAndWaitExit('lab30-before-voice-benchmark');
    try{await this.stopAndWait();}catch{}
    let baseline=null;
    try{baseline=await assertGpuFree('la voz');}catch(e){return{ok:false,error:e.message,code:e.code,gpuBaseline:e.gpuBaseline||null};}
    const [options={},...rest]=args;
    try{const r=await baseQwenBench.call(this,{...options,sampleLimit:QWEN_SAMPLE_LIMIT,skipDiagnostic:true},...rest);if(state.cancelled)return cancelledResult();if(r&&typeof r==='object')r.gpuBaseline=baseline;return r;}
    catch(e){if(state.cancelled)return cancelledResult();throw e;}
  };
}

// Registro de la limpieza de pausas de Chatterbox (chatterbox_pause_cleanup_lab29.py): artefactos silenciados o fallos.
// Antes del Lab.30 el script no podía ejecutarse desde app.asar y el fallo no quedaba registrado en ningún lado.
function logPauseCleanup(rt,result){
  const c=result&&result.pauseCleanup;if(!c||c.skipped&&c.ok!==false)return;
  if(c.ok!==false&&!c.pause_cleanup_applied)return;
  const line=c.ok===false?`ERROR · ${String(c.error||'sin detalle').replace(/\s+/g,' ').slice(0,300)}`:`${c.pause_cleanup_events} artefacto(s) · ${c.pause_cleanup_ms} ms silenciados · fuertes ${c.pause_cleanup_strong_events||0} · débiles ${c.pause_cleanup_weak_events||0} · umbral ${c.pause_cleanup_threshold_db} dB`;
  try{const dir=require('path').join(rt.dataDir||'.','logs');require('fs').mkdirSync(dir,{recursive:true});require('fs').promises.appendFile(require('path').join(dir,'chatterbox-cleanup.log'),`[${new Date().toISOString()}] ${line} · ${require('path').basename(String(result.path||''))}\n`).catch(()=>{});}catch{}
}

function installTtsPatches(){
  const t=TTSLabRuntime.prototype;if(t.__gecLab30Gpu)return;Object.defineProperty(t,'__gecLab30Gpu',{value:true});
  for(const name of ['ensureWorker','stopAndWait','stop']){const base=t[name];if(typeof base!=='function')continue;t[name]=function(...args){global.__gecLabRuntime=this;return base.apply(this,args);};}
  const baseGenerate=t.generate;
  t.generate=async function(...args){global.__gecLabRuntime=this;throwIfCancelled();const r=await baseGenerate.apply(this,args);if(String(args[0])==='chatterbox')logPauseCleanup(this,r);return r;};
  const baseQwenBench=t.benchmarkQwenPerformance;
  if(typeof baseQwenBench==='function')t.benchmarkQwenPerformance=wrapQwenBench(baseQwenBench);
  // Medición final de la voz (también Chatterbox): la IA de texto no debe seguir en la tarjeta.
  const k=KokoroTTS.prototype,baseBenchmark=k.benchmark;
  if(typeof baseBenchmark==='function'&&!k.__gecLab30Gpu){Object.defineProperty(k,'__gecLab30Gpu',{value:true});
    k.benchmark=async function(...args){
      if(state.cancelled)return cancelledResult();
      const local=global.__gecLocalRuntime||global.__ec0320LocalRuntime;if(local?.stopAndWaitExit)await local.stopAndWaitExit('lab30-before-voice-benchmark');
      try{const r=await baseBenchmark.apply(this,args);if(state.cancelled)return cancelledResult();return r;}
      catch(e){if(state.cancelled)return cancelledResult();throw e;}
    };
  }
}

function installCancelIpc(){
  if(global.__gecLab30CancelIpc)return;global.__gecLab30CancelIpc=true;
  ipcMain.handle('optimization:cancelReset',()=>{setCancelled(false);return{ok:true};});
  ipcMain.handle('optimization:cancel',async()=>{
    setCancelled(true);
    const lab=global.__gecLabRuntime,local=global.__gecLocalRuntime||global.__ec0320LocalRuntime;
    try{await lab?.stopAndWait?.();}catch{}
    try{await local?.stopAndWaitExit?.('lab30-cancel');}catch{}
    return{ok:true};
  });
}

function installReleaseV2GpuIsolationLab30(){installLocalRuntimePatches();installTtsPatches();installCancelIpc();}

module.exports={installReleaseV2GpuIsolationLab30,_wrapQwenBench:wrapQwenBench,parseProcesses,describeForeign,FOREIGN_VRAM_LIMIT_MB,_state:state,_setCancelled:setCancelled};
