'use strict';
// Lab.47 · Generador de offs: lectura de documentos, bloqueo con la automatización, resumen, preparación, audio
// (párrafos con pausa, 48 kHz, volumen parejo), SRT con el texto escrito y guardado. Con un motor de voz simulado.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const O=require('../src/services/offsLab47');
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);},eq=(a,b,m)=>{checks++;assert.deepStrictEqual(a,b,m);};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-offs-'));
const tone=(sec,rate=24000,amp=.1)=>{const n=Math.round(sec*rate),x=new Float32Array(n);for(let i=0;i<n;i++)x[i]=amp*Math.sin(2*Math.PI*220*i/rate);return x;};
(async()=>{try{
  // texto
  eq(O.paragraphs('Uno dos.\n\nTres cuatro.\r\n\r\n\r\nCinco.'),['Uno dos.','Tres cuatro.','Cinco.'],'párrafos por línea en blanco');
  eq(O.paragraphs('Línea uno\nsigue aquí.'),['Línea uno sigue aquí.'],'un salto simple no corta el párrafo');
  eq(O.estimateSec('palabra '.repeat(150)),60,'150 palabras ≈ 1 minuto');
  const txt=path.join(tmp,'doc.txt');fs.writeFileSync(txt,'﻿Primer párrafo.\n\n\n\nSegundo párrafo.');
  eq(await O.readDocument(txt),'Primer párrafo.\n\nSegundo párrafo.','TXT con BOM y saltos de más');
  const lat=path.join(tmp,'lat.txt');fs.writeFileSync(lat,Buffer.from('Año de la niñez','latin1'));ok((await O.readDocument(lat)).includes('niñez'),'TXT en Latin-1');
  await O.readDocument(path.join(tmp,'x.pdf')).then(()=>ok(false,'pdf'),e=>ok(/txt o \.docx/.test(e.message),'otro formato: error claro'));
  const p=O.summaryPrompt('Texto largo',60,true);ok(/150 palabras/.test(p)&&/Sin saludo, sin despedida/.test(p)&&/"script"/.test(p),'prompt de off: 150 palabras, sin saludo ni despedida, JSON');
  // audio
  const r48=O.resample(tone(1),24000,48000);ok(Math.abs(r48.length-48000)<=1,'24 kHz → 48 kHz');
  const lv=O.levelize(tone(1,24000,.01),24000);const rms=Math.sqrt(lv.samples.reduce((s,v)=>s+v*v,0)/lv.samples.length);ok(Math.abs(20*Math.log10(rms)-(-20))<1.5&&lv.gainDb>0,'voz baja sube a ~-20 dBFS');
  const loud=O.levelize(tone(1,24000,.9),24000);let pk=0;for(const v of loud.samples)pk=Math.max(pk,Math.abs(v));ok(pk<=Math.pow(10,-1/20)+1e-6,'pico limitado a -1 dB');
  const j=O.joinParagraphs([tone(1),tone(2)],24000);ok(Math.abs(j.samples.length/24000-3.8)<.01&&Math.abs(j.starts[1]-1.8)<.01,'pausa de 0,8 s entre párrafos');
  // bloqueo
  const eng={processingRunning:true,processingPaused:false,emissionRunning:false,inFlight:new Set()};
  ok(O.engineBusy(eng).blocked&&/pausa la Preparación/.test(O.engineBusy(eng).reason),'bloqueado con la Preparación en marcha');
  eng.processingPaused=true;ok(!O.engineBusy(eng).blocked,'con la Preparación pausada se puede usar');
  eng.inFlight=new Set([1]);ok(O.engineBusy(eng).blocked&&/Esperando que terminen/.test(O.engineBusy(eng).reason),'espera las notas en curso');
  eng.inFlight=new Set();eng.emissionRunning=true;eng.emissionPaused=false;ok(/la Emisión/.test(O.engineBusy(eng).reason),'bloqueado con la Emisión al aire');
  // flujo completo por IPC con un motor simulado
  const handlers={},sent=[];
  const genFiles=[];
  const engine={processingRunning:false,emissionRunning:false,inFlight:new Set(),getSettings:()=>({ai:{primary:'local',backup1:'claude',backup2:'none'},tts:{voice:'v1',speed:1}}),
    startProcessing:async()=>'started',startEmission:()=>'emitting',
    providers:{localRuntime:{stop(){}},callProvider:async(prov,prompt)=>{if(prov==='local')throw new Error('sin modelo');return{result:{title:'Ventas',script:'La Sunat fiscalizó 24 locales.\n\nLas ventas llegaron a S/ 5,8 millones.'}};}},
    pronunciation:{normalize:async t=>({text:t.replace('24','veinticuatro').replace('S/ 5,8 millones','cinco punto ocho millones de soles')})},
    kokoro:{generate:async(text)=>{const f=path.join(tmp,`v${genFiles.length}.wav`);O.writeWav16(f,tone(Math.max(1,text.length/15),24000,.05),24000);genFiles.push(text);return{path:f};},cleanupAudio(){}}};
  const electron={app:{getPath:()=>tmp},ipcMain:{handle:(k,f)=>{handlers[k]=f;},removeHandler:k=>{delete handlers[k];}},dialog:{},shell:{showItemInFolder(){},openPath(){}},BrowserWindow:{getAllWindows:()=>[{isDestroyed:()=>false,webContents:{send:(c,p)=>sent.push([c,p])}}],fromWebContents:()=>null}};
  O.installOffsLab47({api:{dataDir:()=>tmp,automation:()=>engine},electron});
  const call=(k,a)=>handlers[k](null,a);
  const st=await call('offs:status');ok(!st.blocked&&st.config.folder===path.join(tmp,'GEC Offs')&&st.config.srt,'carpeta por defecto Documentos/GEC Offs y SRT activado');
  engine.processingRunning=true;const blocked=await call('offs:summarize',{text:'x',seconds:60});ok(blocked.ok===false&&blocked.code==='OFFS_BLOCKED','con la Preparación en marcha no se puede resumir');engine.processingRunning=false;
  const sum=await call('offs:summarize',{text:'Documento largo.',seconds:60});ok(sum.ok&&sum.provider==='claude'&&/5,8 millones/.test(sum.text),'si la IA local falla usa la siguiente de la cadena');
  const prep=await call('offs:prepare',{text:sum.text});eq(prep.spoken,['La Sunat fiscalizó veinticuatro locales.','Las ventas llegaron a cinco punto ocho millones de soles.'],'② cómo lo leerá la voz, por párrafo');
  // durante la generación no se puede iniciar la Preparación ni la Emisión
  let during=null;const realGen=engine.kokoro.generate;engine.kokoro.generate=async(t,o)=>{if(!during){during={proc:await engine.startProcessing().then(()=>'ok',e=>e.code),emit:(()=>{try{engine.startEmission();return'ok';}catch(e){return e.code;}})()};}return realGen(t,o);};
  const gen=await call('offs:generate',{spoken:prep.text+'\n\nY cerraron tres.',written:sum.text+'\n\nY cerraron 3.'});
  ok(gen.ok&&gen.url.startsWith('file:')&&gen.paragraphs===3,'③ audio generado por párrafo');
  eq(during,{proc:'OFFS_BUSY',emit:'OFFS_BUSY'},'mientras se genera el off no arrancan la Preparación ni la Emisión');
  eq(await engine.startProcessing(),'started','al terminar se liberan');ok(!Object.prototype.hasOwnProperty.call(engine,'__gecOffsLock'),'sin marca de bloqueo');
  eq(genFiles.slice(-3),['La Sunat fiscalizó veinticuatro locales.','Las ventas llegaron a cinco punto ocho millones de soles.','Y cerraron tres.'],'se narra exactamente lo editado en ②');
  const wav=fs.readFileSync(path.join(tmp,'offs-temp',`${gen.id}.wav`));eq(wav.readUInt32LE(24),48000,'WAV de 48 kHz');
  const meta=JSON.parse(fs.readFileSync(path.join(tmp,'offs-temp',`${gen.id}.json`),'utf8'));
  ok(/S\/ 5,8 millones/.test(meta.srt)&&/Y cerraron 3\./.test(meta.srt)&&!/cinco punto ocho/.test(meta.srt),'el SRT lleva el texto escrito (paso ①)');
  const firstCue=meta.srt.split('\n')[1];ok(/^00:00:00,/.test(firstCue),'el SRT empieza con la voz');
  // guardar
  const saved=await call('offs:save',{id:gen.id,name:'Ventas BTS',srt:true,txt:true,mode:'s60'});
  ok(saved.ok&&fs.existsSync(saved.files.wav)&&fs.existsSync(saved.files.srt)&&fs.existsSync(saved.files.txt),'guarda .wav, .txt y .srt');
  ok(fs.readFileSync(saved.files.txt,'utf8').startsWith('﻿La Sunat fiscalizó 24'),'el .txt es el texto escrito, UTF-8 con BOM');
  const again=await call('offs:save',{id:gen.id,name:'Ventas BTS',srt:false,txt:false});ok(/Ventas BTS \(2\)\.wav$/.test(again.files.wav)&&!again.files.srt&&!again.files.txt,'no pisa uno existente y respeta sin SRT ni TXT');
  eq((await call('offs:status')).history.map(h=>h.name),['Ventas BTS (2)','Ventas BTS'],'historial');
  ok(sent.some(([c,p])=>c==='offs:progress'&&p.stage==='generate'&&p.total===3),'avisa el progreso por párrafo');
  const pre=fs.readFileSync(path.join(__dirname,'..','src','preload.js'),'utf8');
  ok(/offsGenerate:o=>invoke\('offs:generate',o\)/.test(pre)&&/'offs:progress'/.test(pre)&&/renderer-offs-lab47\.js/.test(pre),'preload expone la API, el evento y la pestaña');
  const rd=fs.readFileSync(path.join(__dirname,'..','src','renderer-offs-lab47.js'),'utf8');
  ok(/Generador de offs/.test(rd)&&/generator-cols/.test(rd)&&!/Enviar a la emisión/.test(rd),'pestaña renombrada, tarjetas viejas ocultas y sin «Enviar a la emisión»');
  const boot=fs.readFileSync(path.join(__dirname,'..','src','bootstrap-v2lab.js'),'utf8');ok(/offsLab47'\)\.installOffsLab47\(\)/.test(boot),'bootstrap instala Lab.47');
  console.log(`check-offs-lab47 OK (${checks} verificaciones) · documentos · bloqueo · resumen · voz · 48 kHz · SRT · guardado`);
}catch(e){console.error('check-offs-lab47: '+(e.stack||e.message));process.exitCode=1;}finally{fs.rmSync(tmp,{recursive:true,force:true});}})();
