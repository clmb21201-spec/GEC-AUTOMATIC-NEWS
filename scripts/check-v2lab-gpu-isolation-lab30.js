'use strict';
// Lab.30 · GPU limpia en la optimización: espera real entre servidores de IA local, cancelación y lectura de nvidia-smi.
const Module=require('module'),path=require('path'),assert=require('assert'),{EventEmitter}=require('events');
const handlers=new Map(),baseLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='electron')return{app:{isPackaged:false,getPath:()=>require('os').tmpdir(),on(){},whenReady:()=>new Promise(()=>{})},ipcMain:{handle:(k,fn)=>handlers.set(k,fn),on(){},removeHandler:k=>handlers.delete(k)},BrowserWindow:function(){},dialog:{},shell:{}};
  return baseLoad.call(this,request,parent,isMain);
};
const src=path.join(__dirname,'..','src','services');
const {LocalRuntime}=require(path.join(src,'localRuntime.js'));
const {TTSLabRuntime}=require(path.join(src,'ttsLabRuntime.js'));
const mod=require(path.join(src,'releaseV2GpuIsolationLab30.js'));
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  // prototipos simulados mínimos antes de instalar (benchmark y request vienen de versiones posteriores)
  const order=[],startTimes=[];
  LocalRuntime.prototype._start=async function(){order.push('start');startTimes.push(Date.now());};
  LocalRuntime.prototype.__ec0320Request=async function(){order.push('request');return{metrics:{}};};
  LocalRuntime.prototype.benchmarkLocalAI=async function(){order.push('bench');return{ok:true,results:[]};};
  const realBench=TTSLabRuntime.prototype.benchmarkQwenPerformance;
  TTSLabRuntime.prototype.benchmarkQwenPerformance=async function(){order.push('qwen-bench');return{ok:true};};
  mod.installReleaseV2GpuIsolationLab30();
  ok(handlers.has('optimization:cancel')&&handlers.has('optimization:cancelReset'),'faltan los IPC de cancelación');

  // 1) el servidor nuevo no arranca hasta que el anterior salió de verdad
  const rt=Object.create(LocalRuntime.prototype);rt.cancelIdleStop=()=>{};rt.onEvent=()=>{};
  const child=new EventEmitter();child.exitCode=null;let exitedAt=0;
  child.kill=()=>{setTimeout(()=>{child.exitCode=0;exitedAt=Date.now();child.emit('exit',0);},150);};
  rt.server=child;rt.stop('profile-change');
  ok(rt.server===null&&rt.__gecExitWait,'stop debe soltar el servidor y dejar una espera de salida');
  await rt._start();
  const startEntry=order.lastIndexOf('start');
  ok(startEntry>=0&&exitedAt>0&&startTimes[startTimes.length-1]>=exitedAt,'el nuevo servidor arrancó antes de que saliera el anterior');

  // 2) stopAndWaitExit resuelve aunque no haya servidor
  const rt2=Object.create(LocalRuntime.prototype);rt2.cancelIdleStop=()=>{};rt2.onEvent=()=>{};rt2.server=null;
  ok(await rt2.stopAndWaitExit()===true,'stopAndWaitExit sin servidor');

  // 3) benchmark de IA local: sin nvidia-smi (Linux/CI) no bloquea y agrega gpuBaseline null
  const rt3=Object.create(LocalRuntime.prototype);rt3.cancelIdleStop=()=>{};rt3.onEvent=()=>{};rt3.server=null;
  const r3=await rt3.benchmarkLocalAI({settings:{}});
  ok(r3.ok===true&&order.includes('bench'),'el benchmark de IA local debe correr si la GPU no se puede consultar');

  // 4) cancelación: el benchmark devuelve un error claro y la marca se limpia con cancelReset
  await handlers.get('optimization:cancel')();
  const r4=await rt3.benchmarkLocalAI({settings:{}});
  ok(r4.ok===false&&/cancelada/i.test(r4.error),'con la optimización cancelada el benchmark debe avisarlo');
  let threw=false;try{await rt3.__ec0320Request('x');}catch(e){threw=e.code==='OPTIMIZATION_CANCELLED';}
  ok(threw,'las pruebas en curso deben cortarse al cancelar');
  await handlers.get('optimization:cancelReset')();
  ok((await rt3.benchmarkLocalAI({settings:{}})).ok===true,'cancelReset debe volver a permitir la optimización');
  ok(mod._state.cancelled===false,'la marca de cancelado debe quedar limpia');

  // 5) lectura de la tabla de procesos de nvidia-smi
  const table=`+-----------------------------------------------------------------------------------------+
| Processes:                                                                              |
|  GPU   GI   CI        PID   Type   Process name                              GPU Memory |
|        ID   ID                                                               Usage      |
|=========================================================================================|
|    0   N/A  N/A      4120    C+G   ...ogram Files\\Adobe\\After Effects\\AfterFX.exe      N/A      |
|    0   N/A  N/A      5532      C   ...\\runtime\\python\\python.exe                    3120MiB |
|    0   N/A  N/A      7788    C+G   C:\\Windows\\explorer.exe                              N/A      |
+-----------------------------------------------------------------------------------------+`;
  const rows=mod.parseProcesses(table);
  ok(rows.length===3&&rows[0].name==='AfterFX.exe'&&rows[1].usedMb===3120,'tabla de procesos mal leída');
  const who=mod.describeForeign({processes:rows});
  ok(who.includes('AfterFX.exe')&&!who.includes('python.exe')&&!who.includes('explorer.exe'),'solo deben listarse programas ajenos a GEC');
  // 6) benchmark de Qwen a través de Lab.30: 3 repeticiones y sin la configuración de diagnóstico
  ok(typeof realBench==='function','benchmark real de Qwen no disponible');
  const wrapped=Object.getOwnPropertyDescriptor(mod,'_wrapQwenBench')?mod._wrapQwenBench(realBench):null;
  ok(wrapped,'Lab.30 debe exponer el envoltorio del benchmark de Qwen para probarlo');
  const q=Object.create(TTSLabRuntime.prototype);
  q.qwenCapabilities=async()=>({bf16:true,sdpa:true,gpu_vram_mb:12288});q.stopAndWait=async()=>true;
  let calls=0;
  q.generate=async(id,text,{params={}}={})=>{calls++;const batch=params.batchBenchmarkMode===true,b=Number(params.batchSize||1),rtf=batch?({1:2.3,2:1.5,4:1.0,8:.8})[b]:(params.predictorHiddenStates===false?2.3:2.8),dur=batch?64:12;
    return{path:'',realtimeFactor:rtf,elapsedMs:rtf*dur*1000,durationSec:dur,audioPeak:.5,audioRms:.07,gpuTelemetry:params.profileGpu?{vram_max_mb:6000}:{},stageTimings:{talker_output_frames:150,talker_steps:150,code_predictor_steps:2250}};};
  const qr=await wrapped.call(q,{params:{voiceMode:'finetuned',fineTunedModelId:'x'}},()=>{});
  ok(qr.ok===true,'el benchmark corto de Qwen debe terminar');
  ok(qr.results.every(x=>x.runCount===3&&x.sampleCount===3)&&qr.sampleCount===3,'cada configuración de voz debe medirse 3 veces');
  ok(!qr.results.some(x=>x.id==='subgreedy'),'la configuración de diagnóstico no debe medirse');
  ok(qr.results.length===4,'deben quedar 4 configuraciones de voz');

  // 7) panel: contador en vivo, tiempo restante, aviso sin novedades, cancelar y limpieza al terminar
  {
    const vm=require('vm'),fs=require('fs');
    const el=(id)=>{const e={id,dataset:{},style:{},children:[],textContent:'',disabled:false,isConnected:true,listeners:{},
      addEventListener(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f);},querySelector(sel){return all[sel.replace('#','')]||null;},
      insertAdjacentElement(_,child){child.isConnected=true;all[child.id]=child;if(child.__html)for(const m of child.__html.matchAll(/id="([^"]+)"/g))all[m[1]]=el(m[1]);return child;},
      closest(sel){return sel==='#'+this.id?this:null;}};
      Object.defineProperty(e,'innerHTML',{set(v){e.__html=v;},get(){return e.__html||'';}});return e;};
    const all={ecOptimizeResult0321:el('ecOptimizeResult0321'),optimizeEc0321:el('optimizeEc0321')};
    const docListeners={},calls=[],evs={};let now=1_000_000,intervalFn=null;
    const ctx={console,Math,Number,String,Promise,
      Date:{now:()=>now},
      setTimeout:(f)=>{f();return 1;},clearTimeout(){},setInterval:(f)=>{intervalFn=f;return 2;},clearInterval:()=>{intervalFn=null;},
      document:{querySelector:sel=>all[sel.replace('#','')]||null,createElement:()=>el('nuevo'),addEventListener:(t,f)=>{docListeners[t]=f;}},
      window:{confirm:()=>true,ECAPI:{optimizationCancel:async()=>{calls.push('cancel');},optimizationCancelReset:async()=>{calls.push('reset');},on:(ch,f)=>{evs[ch]=f;}}}};
    vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','renderer-optimization-lab30.js'),'utf8'),ctx);
    const box=all.ecOptimizeResult0321;box.dataset.live='1';
    docListeners.click({target:all.optimizeEc0321});
    ok(intervalFn&&calls.includes('reset'),'al empezar la optimización debe arrancar el contador y limpiar la marca de cancelado');
    const text=()=>all.gecOptimizeLiveText30.textContent;
    evs['tts-lab:event']({type:'tts-lab-benchmark',phase:'measure',index:1,total:4,repeatIndex:1,repeatTotal:3});
    now+=60000;evs['tts-lab:event']({type:'tts-lab-benchmark',phase:'measure',index:2,total:4,repeatIndex:1,repeatTotal:3});intervalFn();
    ok(/Transcurrido 1:00 min/.test(text())&&/voz · configuraciones: ~\d/.test(text()),'debe mostrar transcurrido y restante: '+text());
    now+=40000;intervalFn();
    ok(/sin novedades hace 40 s/.test(text()),'debe avisar cuando no hay progreso: '+text());
    for(const f of all.gecOptimizeCancel30.listeners.click)await f();
    ok(calls.includes('cancel')&&all.gecOptimizeCancel30.disabled,'el botón debe pedir la cancelación');
    calls.length=0;delete box.dataset.live;intervalFn();
    ok(!intervalFn&&calls.includes('reset')&&all.gecOptimizeLive30.style.display==='none','al terminar debe ocultarse y limpiar la marca');
  }

  // 8) instalación: la copia de PyTorch del motor se borra sin bloquear el proceso principal
  {
    const fs=require('fs'),os=require('os');const site=fs.mkdtempSync(path.join(os.tmpdir(),'gec-shadow-'));
    for(const d of ['torch','torchaudio','torch-2.6.0.dist-info','chatterbox'])fs.mkdirSync(path.join(site,d,'sub'),{recursive:true});
    for(let i=0;i<50;i++)fs.writeFileSync(path.join(site,'torch','sub',`f${i}.py`),'x');
    const rt=Object.create(TTSLabRuntime.prototype);rt.engine=()=>({label:'Prueba'});
    const pending=rt.removeTorchShadow('chatterbox',site);
    ok(pending&&typeof pending.then==='function','removeTorchShadow debe ser asíncrono');
    const removed=await pending;
    ok(removed.sort().join(',')==='torch,torch-2.6.0.dist-info,torchaudio','debe borrar solo la copia de PyTorch');
    ok(fs.existsSync(path.join(site,'chatterbox'))&&!fs.existsSync(path.join(site,'torch')),'el paquete del motor debe quedar intacto');
    fs.rmSync(site,{recursive:true,force:true});
  }

  console.log(`check-v2lab-gpu-isolation-lab30 OK · ${checks} verificaciones`);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
