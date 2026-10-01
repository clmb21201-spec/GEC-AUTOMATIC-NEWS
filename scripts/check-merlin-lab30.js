'use strict';
// Lab.30 · Merlín: NDI solo en vista clásica, vista previa de Merlín en Diseño y voz zero-shot de Qwen.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..'),src=path.join(root,'src'),read=f=>fs.readFileSync(path.join(src,f),'utf8');
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};

(async()=>{
  // 1) guardia de NDI: se carga el bloque de main.js con un OutputNdi simulado
  const main=read('main.js'),block=main.slice(main.indexOf('// ---- Merlín: NDI solo en la vista clásica'));
  ok(block.startsWith('// ---- Merlín: NDI')&&main.includes('presenterNdiGuard.onModeChange()'),'main.js sin guardia de NDI para Merlín');
  class FakeNdi{constructor(){this.config={enabled:true};this.running=false;this.log=[];}async start(){this.running=true;this.log.push('start');return this.status();}async stop(){this.running=false;this.log.push('stop');}emit(){this.log.push('emit');}status(){return{enabled:this.config.enabled,running:this.running,error:''};}}
  let mode='clasico',format='16:9',windows=[];
  const ctx={require:m=>m==='./services/outputNdi'?{OutputNdi:FakeNdi}:require(m),Object,console,
    readPresenter:()=>({mode}),currentDesign:()=>({format}),logEvent:()=>{},ensureNdiWindow:()=>windows.push('ensure'),destroyNdiWindow:()=>windows.push('destroy'),outputNdi:null};
  vm.createContext(ctx);vm.runInContext(block+';this.guard=presenterNdiGuard;',ctx);
  const ndi=new FakeNdi();ctx.outputNdi=ndi;
  await ndi.start();ok(ndi.running,'en modo clásico NDI debe funcionar');
  mode='merlin';await ctx.guard.onModeChange();
  ok(!ndi.running&&windows.includes('destroy'),'al pasar a Merlín NDI debe detenerse');
  const st=ndi.status();ok(st.merlinBlocked===true&&/vista clásica/.test(st.error)&&st.running===false,'el estado NDI debe avisar que solo funciona en la vista clásica');
  ndi.log.length=0;await ndi.start();ok(!ndi.running&&!ndi.log.includes('start'),'con Merlín NDI no debe iniciarse');
  mode='clasico';windows=[];await ctx.guard.onModeChange();
  ok(ndi.running&&windows.includes('ensure')&&ndi.status().merlinBlocked===false,'al volver a clásica NDI debe reanudarse si estaba activado');
  mode='merlin';format='9:16';ok(ctx.guard.blocked()===false,'en 9:16 la salida siempre es la clásica: NDI permitido');

  // 2) vista previa de Merlín: adaptador mudo dentro del iframe
  const html=read('output-merlin-preview.html');
  ok(html.indexOf('output-merlin-preview-adapter.js')>0&&html.indexOf('output-merlin-preview-adapter.js')<html.indexOf('vendor/three/three.min.js')&&html.includes('output-merlin.js')&&!html.includes('dragRegion'),'la vista previa debe cargar el adaptador antes de la escena');
  const posted=[],msgListeners=[];
  const win={addEventListener:(t,f)=>{if(t==='message')msgListeners.push(f);},__merlinOutput:{}};
  const actx={window:win,parent:{postMessage:m=>posted.push(m)},setTimeout:f=>f(),Date,console};
  vm.createContext(actx);vm.runInContext(read('output-merlin-preview-adapter.js'),actx);
  const designs=[],stories=[];win.ECAPI.on('output:design',d=>designs.push(d));win.ECAPI.on('output:story',p=>stories.push(p));
  ok(posted.some(m=>m.type==='gec-merlin-preview-ready'),'el adaptador debe avisar cuando la escena está lista');
  for(const f of msgListeners)f({data:{type:'gec-merlin-preview',design:{musicEnabled:true,musicUrl:'file:///m.mp3',standbyVideoUrl:'file:///s.mp4',voiceVolume:100,titleColor:'#fff'},story:{title:'Hola',audioUrl:'file:///x.wav'}}});
  ok(designs[0]&&designs[0].musicEnabled===false&&designs[0].standbyVideoUrl===''&&designs[0].voiceVolume===0&&designs[0].titleColor==='#fff','la vista previa debe ser muda y conservar el diseño');
  ok(stories[0]&&stories[0].kind==='news'&&stories[0].audioUrl===''&&stories[0].title==='Hola','la nota de ejemplo debe llegar sin audio');
  ok(typeof win.ECAPI.outputPlayback==='function'&&typeof win.ECAPI.getSettings==='function','el adaptador debe cubrir la API que usa output-merlin.js');

  // 3) inyección en el panel
  const pre=read('preload.js');
  for(const f of ['renderer-optimization-lab30.js','renderer-merlin-ndi-lab30.js','renderer-merlin-preview-lab30.js'])ok(pre.includes(`src:'${f}'`),`preload.js no inyecta ${f}`);
  ok(pre.includes("optimizationCancel:()=>invoke('optimization:cancel')"),'preload.js sin API de cancelación');
  const prev=read('renderer-merlin-preview-lab30.js');
  ok(prev.includes("'output-merlin-preview.html'")&&prev.includes('IntersectionObserver')&&prev.includes('format-9-16'),'la vista previa debe cargarse solo visible y en 16:9');

  // 4) Qwen zero-shot: la transcripción de referencia llega a qwen_tts
  const worker=read('tts_lab_worker.py');
  ok(worker.includes('def _qwen_prompt_items(')&&worker.includes('ref_text=ref_text')&&worker.includes('VOICE_PROMPTS[key] = items'),'el worker debe pasar VoiceClonePromptItem con ref_text');
  ok(!/VOICE_PROMPTS\[key\] = packed/.test(worker),'el worker no debe pasar el dict sin transcripción a qwen_tts');

  // 5) audio: el video se pausa al ocultarse (despedida/pase sobre un contenido) y la música no se normaliza
  const out=read('output-merlin.js');
  ok(/layer\.classList\.remove\('on'\);[\s\S]*try \{ video\.pause\(\); \} catch \{\}/.test(out.slice(out.indexOf('function hideCanned(){'),out.indexOf('function hideCanned(){')+600)),'hideCanned debe pausar el video en el acto');
  const musicLines=out.split('\n').filter(l=>/music\.volume\s*=/.test(l));
  ok(musicLines.length>0&&musicLines.every(l=>!l.includes('dbGain')),'la música de fondo no debe normalizarse');
  ok(/video\.volume = [^;]*dbGain\(p\.audioGainDb\)/.test(out)&&/audio\.volume = [^;]*dbGain\(p\.audioGainDb\)/.test(out),'voz y contenidos deben normalizarse');

  // 6) limpieza de pausas de Chatterbox: el script va fuera de app.asar y se busca ahí primero
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  ok((pkg.build.extraResources||[]).some(x=>x.from==='src/chatterbox_pause_cleanup_lab29.py'&&x.to==='runtime/tts-lab/chatterbox_pause_cleanup_lab29.py'),'el script de limpieza debe copiarse fuera de app.asar');
  const fin=read('services/releaseV2FinalCorrectionsLab29.js');
  ok(fin.includes("path.join(process.resourcesPath,'runtime','tts-lab','chatterbox_pause_cleanup_lab29.py')")&&fin.includes('.asar'),'la limpieza debe usar la copia fuera de app.asar');
  ok(read('services/releaseV2GpuIsolationLab30.js').includes('chatterbox-cleanup.log'),'la limpieza debe quedar registrada');

  console.log(`check-merlin-lab30 OK · ${checks} verificaciones`);
})().catch(e=>{console.error(e);process.exit(1);});
