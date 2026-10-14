'use strict';
// Lab.47 · Generador de offs. La pestaña «Generador de notas» pasa a generar locuciones (offs) para otros videos a partir
// de un TXT o Word, con la voz elegida en Audio y locución:
//   ① Texto: el documento tal cual (texto completo) o un resumen de off de 30 s / 1 min / 90 s escrito por la IA
//      (sin saludo ni despedida; si se quieren, se escriben en el editor). Se puede editar.
//   ② Cómo lo va a leer la voz: el mismo texto pasado por la pronunciación de GEC (cifras, horas, siglas, documentos…),
//      párrafo por párrafo y editable. Lo que se edita aquí se narra tal cual.
//   ③ Audio: cada párrafo se genera aparte y se une con 0,8 s de pausa; volumen parejo (voz a ~-20 dBFS RMS, pico -1 dB)
//      y WAV de 48 kHz mono. Se guarda en la carpeta elegida (por defecto Documentos/GEC Offs) con .txt y .srt opcionales.
//      El SRT lleva el texto del paso ① (como está escrito), repartido por párrafo sobre la voz real.
// No se puede usar mientras la Preparación o la Emisión están en marcha (comparten la GPU); y mientras se genera un off,
// iniciar o reanudar la Preparación o la Emisión devuelve un error (el Horario automático reintenta a los 20 s).
const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');

const VERSION='lab47-offs-1';
const CONFIG_FILE='offs.json',HISTORY_FILE='offs-history.json',TEMP_DIR='offs-temp';
const PARAGRAPH_PAUSE=0.8,TARGET_RMS_DB=-20,PEAK_DB=-1,OUT_RATE=48000;
const WORDS_PER_SEC=2.5;
const MODES={full:0,s30:30,s60:60,s90:90};

// ---------------------------------------------------------------- texto
const paragraphs=t=>String(t||'').replace(/\r\n?/g,'\n').split(/\n\s*\n+|\n(?=\s*[-•–]\s)/).map(p=>p.replace(/\s*\n\s*/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
const wordCount=t=>(String(t||'').match(/[\p{L}\p{N}]+/gu)||[]).length;
const estimateSec=t=>Math.round(wordCount(t)/WORDS_PER_SEC);
function cleanDocText(raw){
  return String(raw||'').replace(/\r\n?/g,'\n').replace(/ /g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
async function readDocument(file){
  const ext=path.extname(String(file||'')).toLowerCase();
  if(ext==='.txt'){let b=fs.readFileSync(file);let t=b.toString('utf8');if(t.includes('�'))t=b.toString('latin1');return cleanDocText(t.replace(/^﻿/,''));}
  if(ext==='.docx'){const mammoth=require('mammoth');const r=await mammoth.extractRawText({path:file});return cleanDocText(r.value||'');}
  throw new Error('Formato no admitido: usa un archivo .txt o .docx.');
}
function summaryPrompt(text,seconds,local){
  const words=Math.round(seconds*WORDS_PER_SEC),src=String(text||'').slice(0,local?8000:30000);
  return `Eres guionista de voz en off para videos periodísticos en español de Perú.
Escribe una locución de aproximadamente ${words} palabras (unos ${seconds} segundos leída en voz alta) a partir del texto de abajo.
Reglas:
- Estilo de off narrativo: frases claras y no muy largas, en tercera persona, listas para ser leídas.
- Sin saludo, sin despedida, sin presentarte, sin «en este video», sin títulos, viñetas ni comillas de diálogo inventadas.
- Conserva exactamente los datos: cifras, nombres, cargos, lugares y fechas. No inventes ni opines.
- Prioriza lo más importante del texto; deja fuera detalles secundarios.
- Puedes separar la locución en 2 o 3 párrafos con una línea en blanco.
Responde solo con este JSON: {"title":"título breve del tema","script":"la locución"}

TEXTO:
<<<
${src}
>>>`;
}

// ---------------------------------------------------------------- audio
function readWavFloat(file){
  const b=fs.readFileSync(file);if(b.length<44||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE')throw new Error('El audio de la voz no es un WAV válido.');
  let o=12,fmt=null,data=null;
  while(o+8<=b.length){const id=b.toString('ascii',o,o+4),sz=b.readUInt32LE(o+4),st=o+8;
    if(id==='fmt ')fmt={format:b.readUInt16LE(st),channels:b.readUInt16LE(st+2),rate:b.readUInt32LE(st+4),bits:b.readUInt16LE(st+14)};
    else if(id==='data'){data=b.subarray(st,Math.min(b.length,st+sz));break;}
    o=st+sz+(sz%2);}
  if(!fmt||!data)throw new Error('El audio de la voz no es un WAV válido.');
  const ch=Math.max(1,fmt.channels),float=fmt.format===3&&fmt.bits===32,bytes=float?4:fmt.bits===16?2:fmt.bits===24?3:0;
  if(!bytes)throw new Error('Formato de audio no compatible.');
  const frames=Math.floor(data.length/bytes/ch),out=new Float32Array(frames);
  for(let i=0;i<frames;i++){let s=0;for(let c=0;c<ch;c++){const k=(i*ch+c)*bytes;s+=float?data.readFloatLE(k):bytes===2?data.readInt16LE(k)/32768:(data.readIntLE(k,3))/8388608;}out[i]=s/ch;}
  return{rate:fmt.rate,samples:out};
}
// remuestreo con interpolación sinc (ventana de Hann, 16 muestras por lado)
function resample(x,from,to){
  if(from===to)return x;
  const ratio=to/from,n=Math.floor(x.length*ratio),out=new Float32Array(n),W=16,cut=Math.min(1,ratio);
  for(let i=0;i<n;i++){
    const t=i/ratio,c=Math.floor(t);let acc=0,norm=0;
    for(let k=c-W+1;k<=c+W;k++){if(k<0||k>=x.length)continue;const d=t-k,a=Math.PI*d*cut,s=d===0?1:Math.sin(a)/a,w=0.5+0.5*Math.cos(Math.PI*d/W);const g=s*w;acc+=x[k]*g;norm+=g;}
    out[i]=norm?acc/norm:0;
  }
  return out;
}
// volumen parejo: RMS de los cuadros con voz a TARGET_RMS_DB y el pico a PEAK_DB como máximo
function levelize(x,rate){
  const hop=Math.max(1,Math.round(rate*.02)),rms=[];
  for(let i=0;i<x.length;i+=hop){let s=0,c=0;for(let j=i;j<Math.min(x.length,i+hop);j++){s+=x[j]*x[j];c++;}rms.push(c?s/c:0);}
  const voiced=rms.filter(v=>10*Math.log10(v+1e-12)>-45);if(!voiced.length)return{samples:x,gainDb:0};
  const cur=10*Math.log10(voiced.reduce((a,b)=>a+b,0)/voiced.length+1e-12);
  let gain=Math.pow(10,(TARGET_RMS_DB-cur)/20);let peak=0;for(const v of x)peak=Math.max(peak,Math.abs(v));
  const maxPeak=Math.pow(10,PEAK_DB/20);if(peak*gain>maxPeak)gain=maxPeak/Math.max(peak,1e-9);
  const out=new Float32Array(x.length);for(let i=0;i<x.length;i++)out[i]=x[i]*gain;
  return{samples:out,gainDb:Math.round(20*Math.log10(gain)*10)/10};
}
function writeWav16(file,samples,rate){
  const data=Buffer.alloc(samples.length*2);for(let i=0;i<samples.length;i++){const v=Math.max(-1,Math.min(1,samples[i]));data.writeInt16LE(Math.round(v*32767),i*2);}
  const h=Buffer.alloc(44);h.write('RIFF',0);h.writeUInt32LE(36+data.length,4);h.write('WAVE',8);h.write('fmt ',12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.concat([h,data]));
}
// une los párrafos (ya leídos como Float32 a la misma frecuencia) con PARAGRAPH_PAUSE de silencio; devuelve también dónde empieza cada uno
function joinParagraphs(parts,rate){
  const gap=Math.round(PARAGRAPH_PAUSE*rate),total=parts.reduce((s,p)=>s+p.length,0)+gap*Math.max(0,parts.length-1),out=new Float32Array(total),starts=[];
  let o=0;parts.forEach((p,i)=>{if(i)o+=gap;starts.push(o/rate);out.set(p,o);o+=p.length;});
  return{samples:out,starts};
}

// ---------------------------------------------------------------- subtítulos
// Cada párrafo escrito (paso ①) se reparte sobre los tramos con voz de su propio párrafo de audio.
function buildSrt(written,spokenParas,starts,durations,file){
  const va=require('./voiceArchiveLab36'),seg=va.speechSegments(file),wp=paragraphs(written);
  if(wp.length!==spokenParas.length||!starts.length)return va.toSrt(va.buildCues(wp.join(' '),seg.segments,seg.duration));
  const cues=[];
  wp.forEach((p,i)=>{
    const a=starts[i],b=a+durations[i],segs=seg.segments.filter(([s,e])=>e>a&&s<b).map(([s,e])=>[Math.max(a,s),Math.min(b,e)]);
    cues.push(...va.buildCues(p,segs.length?segs:[[a,b]],durations[i]));
  });
  for(let i=1;i<cues.length;i++)if(cues[i].start<cues[i-1].end)cues[i].start=cues[i-1].end;
  return va.toSrt(cues);
}

// ---------------------------------------------------------------- archivos
const safeName=s=>{const t=String(s||'Off').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'');return(t.length>80?t.slice(0,80).replace(/\s+\S*$/,''):t)||'Off';};
function freeBase(folder,name){let base=safeName(name),n=1;while(['.wav','.txt','.srt'].some(e=>fs.existsSync(path.join(folder,base+e)))){n++;base=`${safeName(name)} (${n})`;}return base;}
function readJson(f,fb){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return fb;}}
function writeJson(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});const t=`${f}.tmp-${process.pid}`;fs.writeFileSync(t,JSON.stringify(v,null,2),'utf8');fs.renameSync(t,f);}

// ---------------------------------------------------------------- bloqueo con la automatización
function engineBusy(e){
  if(!e)return{blocked:false};
  const proc=!!e.processingRunning&&!e.processingPaused,emit=!!e.emissionRunning&&!e.emissionPaused,inflight=Number(e.inFlight?.size||0);
  const why=[proc&&'la Preparación de noticias',emit&&'la Emisión'].filter(Boolean);
  if(why.length)return{blocked:true,reason:`Para usar el Generador de offs, pausa ${why.join(' y ')} en Automático.`};
  if(inflight>0)return{blocked:true,reason:`Esperando que terminen ${inflight} nota(s) que se estaban preparando…`};
  return{blocked:false};
}
const GUARDED=['startProcessing','resumeProcessing','startEmission','resumeEmission'];
function lockEngine(e){
  if(!e||e.__gecOffsLock)return()=>{};
  const saved={};e.__gecOffsLock=true;
  for(const k of GUARDED){if(typeof e[k]!=='function')continue;saved[k]=Object.prototype.hasOwnProperty.call(e,k)?e[k]:undefined;
    e[k]=function(){const err=new Error('Hay un off generándose en el Generador de offs. Espera a que termine o cancélalo.');err.code='OFFS_BUSY';return k.includes('Processing')?Promise.reject(err):(()=>{throw err;})();};}
  return()=>{for(const k of Object.keys(saved)){if(saved[k]===undefined)delete e[k];else e[k]=saved[k];}delete e.__gecOffsLock;};
}

// ---------------------------------------------------------------- IPC
function installOffsLab47({api=null,electron=null}={}){
  if(global.__gecOffsLab47)return global.__gecOffsLab47;
  const {app,ipcMain,dialog,shell,BrowserWindow}=electron||require('electron');
  // __gecScheduleApi se define al final de main.js: se lee en cada llamada
  const A=()=>api||globalThis.__gecScheduleApi||null;
  const dataDir=()=>{try{return A()?.dataDir?.()||process.env.GEC_V2_TTS_LAB_ROOT||'';}catch{return process.env.GEC_V2_TTS_LAB_ROOT||'';}};
  const engine=()=>{try{return A()?.automation?.()||global.__ec0329AutomationRef||null;}catch{return global.__ec0329AutomationRef||null;}};
  const cfgFile=()=>path.join(dataDir(),CONFIG_FILE),histFile=()=>path.join(dataDir(),HISTORY_FILE),tempDir=()=>path.join(dataDir(),TEMP_DIR);
  const defaultFolder=()=>{try{return path.join(app.getPath('documents'),'GEC Offs');}catch{return path.join(dataDir(),'GEC Offs');}};
  const config=()=>{const c=readJson(cfgFile(),{})||{};return{folder:String(c.folder||defaultFolder()),txt:c.txt!==false,srt:c.srt!==false};};
  const history=()=>{const h=readJson(histFile(),[]);return Array.isArray(h)?h:[];};
  const send=(ch,p)=>{for(const w of BrowserWindow.getAllWindows())try{if(!w.isDestroyed())w.webContents.send(ch,p);}catch{}};
  const state={busy:false,cancel:false,stage:''};
  const progress=p=>send('offs:progress',{...p,busy:state.busy});
  // Lab.52: velocidad medida de la voz (RTF: segundos de cálculo por segundo de audio) para estimar cuánto tarda el off
  const voiceRtf=()=>{try{const x=settings()||{},r=Number(x.optimization0321?.voice?.medianRtf||x.activeOptimizationV2?.tts?.expectedRtf||x.tts?.lastBenchmark?.bestRealtimeFactor||0);return r>0&&r<20?Math.round(r*100)/100:0;}catch{return 0;}};
  const status=()=>({ok:true,version:VERSION,...engineBusy(engine()),busy:state.busy,stage:state.stage,config:config(),history:history().slice(0,20),rtf:voiceRtf()});
  const handle=(k,fn)=>{try{ipcMain.removeHandler(k);}catch{}ipcMain.handle(k,async(...a)=>{try{return await fn(...a);}catch(e){return{ok:false,error:String(e?.message||e),code:e?.code||''};}});};
  const settings=()=>{const e=engine();return e?.getSettings?.()||{};};
  const guard=()=>{const b=engineBusy(engine());if(b.blocked){const e=new Error(b.reason);e.code='OFFS_BLOCKED';throw e;}if(state.busy){const e=new Error('Ya hay un off en proceso.');e.code='OFFS_BUSY';throw e;}};
  async function exclusive(stage,fn){
    guard();state.busy=true;state.cancel=false;state.stage=stage;const unlock=lockEngine(engine());progress({stage});
    try{return await fn();}finally{unlock();state.busy=false;state.stage='';progress({stage:'idle'});}
  }
  // limpieza de temporales viejos (más de un día)
  try{const d=tempDir();if(fs.existsSync(d))for(const f of fs.readdirSync(d)){const p=path.join(d,f);try{if(Date.now()-fs.statSync(p).mtimeMs>864e5)fs.rmSync(p,{force:true});}catch{}}}catch{}

  handle('offs:status',()=>status());
  handle('offs:pickFiles',async e=>{
    const win=BrowserWindow.fromWebContents(e.sender)||undefined;
    const r=await dialog.showOpenDialog(win,{title:'Documentos para el off',properties:['openFile','multiSelections'],filters:[{name:'Texto o Word',extensions:['txt','docx']}]});
    if(r.canceled||!r.filePaths?.length)return{ok:false,canceled:true};
    const docs=[];for(const f of r.filePaths.slice(0,30)){try{const text=await readDocument(f);docs.push({path:f,name:path.basename(f,path.extname(f)),text,words:wordCount(text),estimateSec:estimateSec(text)});}catch(err){docs.push({path:f,name:path.basename(f),error:String(err.message||err)});}}
    return{ok:true,docs};
  });
  // ① resumen de off con la IA (cadena de proveedores del perfil: principal, respaldo 1, respaldo 2)
  handle('offs:summarize',async(_e,{text='',seconds=60}={})=>exclusive('summarize',async()=>{
    const src=String(text||'').trim();if(!src)throw new Error('El documento está vacío.');
    const secs=[30,60,90].includes(Number(seconds))?Number(seconds):60,s=settings(),prov=engine()?.providers;if(!prov?.callProvider)throw new Error('La IA todavía no está lista.');
    const order=[...new Set([s.ai?.primary,s.ai?.backup1,s.ai?.backup2].filter(x=>x&&x!=='none'))];if(!order.length)throw new Error('No hay una IA configurada en Ajustes.');
    try{await global.__gecLabRuntime?.stopAndWait?.();}catch{}
    const errors=[];
    for(const p of order){
      if(state.cancel)break;
      progress({stage:'summarize',provider:p});
      try{
        const out=await prov.callProvider(p,summaryPrompt(src,secs,p==='local'),s),script=String(out?.result?.script||'').trim();
        if(!script)throw new Error('respuesta vacía');
        return{ok:true,provider:p,title:String(out.result.title||'').trim(),text:script.replace(/\n{3,}/g,'\n\n'),words:wordCount(script),estimateSec:estimateSec(script)};
      }catch(err){errors.push(`${p}: ${String(err.message||err).slice(0,160)}`);}
      finally{if(p==='local'){const l=prov.localRuntime;try{await(l?.stopAndWaitExit?.('offs')??l?.stop?.('offs'));}catch{}}}
    }
    throw new Error(state.cancel?'Cancelado.':`La IA no pudo resumir el texto (${errors.join(' · ')}).`);
  }));
  // ② cómo lo va a leer la voz (párrafo por párrafo)
  handle('offs:prepare',async(_e,{text=''}={})=>exclusive('prepare',async()=>{
    const paras=paragraphs(text);if(!paras.length)throw new Error('No hay texto para narrar.');
    const pron=engine()?.pronunciation,s=settings(),out=[];
    // la pronunciación inteligente puede usar la IA local: la voz se descarga antes para no llenar la VRAM
    try{await global.__gecLabRuntime?.stopAndWait?.();}catch{}
    for(let i=0;i<paras.length;i++){
      if(state.cancel)throw new Error('Cancelado.');progress({stage:'prepare',index:i+1,total:paras.length});
      let spoken=paras[i];try{const r=await pron?.normalize?.(paras[i],{smart:s.tts?.pronunciationSmart!==false});if(r?.text)spoken=String(r.text).trim();}catch{}
      out.push(spoken);
    }
    return{ok:true,written:paras,spoken:out,text:out.join('\n\n'),estimateSec:estimateSec(out.join(' '))};
  }));
  // ③ audio
  handle('offs:generate',async(_e,{spoken='',written=''}={})=>exclusive('generate',async()=>{
    const paras=paragraphs(spoken);if(!paras.length)throw new Error('No hay texto para narrar.');
    const e=engine(),k=e?.kokoro,s=settings();if(!k?.generate)throw new Error('La voz todavía no está lista.');
    const local=e?.providers?.localRuntime;try{await(local?.stopAndWaitExit?.('offs')??local?.stop?.('offs'));}catch{}
    const parts=[],durations=[];let rate=0;
    // Lab.52: avance por cantidad de texto (no por párrafos) y velocidad de la voz, para el tiempo restante del panel
    const totalChars=paras.reduce((a,x)=>a+x.length,0),rtf=voiceRtf();let doneChars=0;
    for(let i=0;i<paras.length;i++){
      if(state.cancel)throw new Error('Cancelado.');
      progress({stage:'generate',index:i+1,total:paras.length,doneChars,totalChars,paraChars:paras[i].length,rtf});
      const a=await k.generate(paras[i],{voice:s.tts?.voice,speed:s.tts?.speed});
      if(!a?.path||!fs.existsSync(a.path))throw new Error(`La voz no devolvió audio en el párrafo ${i+1}.`);
      const w=readWavFloat(a.path);try{k.cleanupAudio?.(a.path);}catch{}
      const x=rate&&w.rate!==rate?resample(w.samples,w.rate,rate):w.samples;if(!rate)rate=w.rate;
      parts.push(x);durations.push(x.length/rate);doneChars+=paras[i].length;
    }
    progress({stage:'mix'});
    const joined=joinParagraphs(parts,rate),lv=levelize(joined.samples,rate),out=resample(lv.samples,rate,OUT_RATE);
    const id=`off-${Date.now()}`,file=path.join(tempDir(),`${id}.wav`);writeWav16(file,out,OUT_RATE);
    let srt='';try{srt=buildSrt(written||paras.join('\n\n'),paras,joined.starts,durations,file);}catch{}
    const duration=out.length/OUT_RATE;
    fs.writeFileSync(path.join(tempDir(),`${id}.json`),JSON.stringify({id,spoken:paras.join('\n\n'),written:String(written||''),srt,duration,gainDb:lv.gainDb}),'utf8');
    return{ok:true,id,url:pathToFileURL(file).href,duration:Math.round(duration*10)/10,gainDb:lv.gainDb,paragraphs:paras.length};
  }));
  handle('offs:cancel',()=>{state.cancel=true;return{ok:true};});
  handle('offs:pickFolder',async e=>{
    const win=BrowserWindow.fromWebContents(e.sender)||undefined,cur=config();
    const r=await dialog.showOpenDialog(win,{title:'Carpeta para los offs',defaultPath:cur.folder,properties:['openDirectory','createDirectory']});
    if(r.canceled||!r.filePaths?.[0])return{ok:false,canceled:true};
    writeJson(cfgFile(),{...cur,folder:r.filePaths[0]});return{ok:true,config:config()};
  });
  handle('offs:setOptions',(_e,o={})=>{const cur=config();writeJson(cfgFile(),{...cur,txt:o.txt!==undefined?!!o.txt:cur.txt,srt:o.srt!==undefined?!!o.srt:cur.srt});return{ok:true,config:config()};});
  handle('offs:save',(_e,{id='',name='',txt,srt,mode=''}={})=>{
    const meta=readJson(path.join(tempDir(),`${safeName(id)}.json`),null),wav=path.join(tempDir(),`${safeName(id)}.wav`);
    if(!meta||!fs.existsSync(wav))throw new Error('El audio ya no está disponible. Vuelve a generarlo.');
    const cfg=config(),folder=cfg.folder;fs.mkdirSync(folder,{recursive:true});
    const base=freeBase(folder,name||meta.written.split(/\s+/).slice(0,8).join(' ')),files={wav:path.join(folder,`${base}.wav`)};
    fs.copyFileSync(wav,files.wav);
    const wantTxt=txt!==undefined?!!txt:cfg.txt,wantSrt=srt!==undefined?!!srt:cfg.srt;
    if(wantTxt){files.txt=path.join(folder,`${base}.txt`);fs.writeFileSync(files.txt,'﻿'+(meta.written||meta.spoken).replace(/\n/g,'\r\n'),'utf8');}
    if(wantSrt&&meta.srt){files.srt=path.join(folder,`${base}.srt`);fs.writeFileSync(files.srt,meta.srt,'utf8');}
    writeJson(cfgFile(),{...cfg,txt:wantTxt,srt:wantSrt});
    const entry={name:base,at:new Date().toISOString(),duration:meta.duration,mode:String(mode||''),...files};
    writeJson(histFile(),[entry,...history().filter(h=>h.wav!==files.wav)].slice(0,20));
    return{ok:true,files,entry,history:history().slice(0,20)};
  });
  handle('offs:open',(_e,file)=>{const f=String(file||'');if(f&&fs.existsSync(f)){shell.showItemInFolder(f);return{ok:true};}const d=config().folder;fs.mkdirSync(d,{recursive:true});shell.openPath(d);return{ok:true};});
  handle('offs:fileUrl',(_e,file)=>{const f=String(file||'');return fs.existsSync(f)?{ok:true,url:pathToFileURL(f).href}:{ok:false,error:'El archivo ya no existe.'};});
  // el panel actualiza el aviso de bloqueo con cada cambio de la automatización
  const timer=setInterval(()=>{try{const b=engineBusy(engine());const key=`${b.blocked}|${b.reason||''}|${state.busy}`;if(key!==timer.last){timer.last=key;send('offs:progress',{stage:state.stage||'idle',busy:state.busy,blocked:b.blocked,reason:b.reason||''});}}catch{}},1500);timer.unref?.();
  global.__gecOffsLab47={status,engineBusy,busy:()=>state.busy};
  return global.__gecOffsLab47;
}

module.exports={VERSION,MODES,paragraphs,wordCount,estimateSec,readDocument,summaryPrompt,readWavFloat,resample,levelize,writeWav16,joinParagraphs,buildSrt,engineBusy,lockEngine,safeName,freeBase,installOffsLab47};
