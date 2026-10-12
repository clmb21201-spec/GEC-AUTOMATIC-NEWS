'use strict';
// Lab.36 · archivo de voz para edición (services/voiceArchiveLab36.js) y Merlín solo con su página cargada (main.js).
const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const V=require(path.join(root,'src/services/voiceArchiveLab36'));
let checks=0;const ok=(c,m)=>{checks++;if(!c){console.error('check-voice-archive-lab36: '+m);process.exit(1);}};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-lab36-'));

// WAV con tramos [segundos, amplitud] (16 bits o float 32)
function wav(file,parts,{float=false}={}){
  const rate=24000,samples=[];for(const [dur,amp] of parts)for(let i=0;i<Math.round(dur*rate);i++)samples.push(amp*Math.sin(2*Math.PI*220*i/rate)*(0.6+0.4*Math.sin(2*Math.PI*3*i/rate)));
  const bps=float?4:2,data=Buffer.alloc(samples.length*bps);samples.forEach((v,i)=>float?data.writeFloatLE(v,i*4):data.writeInt16LE(Math.round(v*32767),i*2));
  const h=Buffer.alloc(44);h.write('RIFF',0,'ascii');h.writeUInt32LE(36+data.length,4);h.write('WAVE',8,'ascii');h.write('fmt ',12,'ascii');h.writeUInt32LE(16,16);h.writeUInt16LE(float?3:1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*bps,28);h.writeUInt16LE(bps,32);h.writeUInt16LE(bps*8,34);h.write('data',36,'ascii');h.writeUInt32LE(data.length,40);
  fs.writeFileSync(file,Buffer.concat([h,data]));return file;
}

// ---- texto → bloques de subtítulos
const long='El Ministerio de Economía anunció este martes un paquete de medidas para reactivar la inversión privada en las regiones del sur del país, con incentivos tributarios y simplificación de trámites. ¿Será suficiente? Los analistas creen que sí.';
const parts=V.splitCues(long);
ok(parts.length>=3&&parts.every(p=>p.length<=84),'bloques de más de 84 caracteres: '+JSON.stringify(parts));
ok(parts.join(' ').replace(/\s+/g,' ')===long,'el corte perdió o cambió texto');
ok(parts.includes('¿Será suficiente?'),'no cortó en el fin de oración');
ok(V.safeName('Título: "raro" / con <signos>?')==='Título raro con signos'&&!/[\\/:*?"<>|]/.test(V.safeName('a/b:c*d?e"f<g>h|i')),'nombre de archivo con caracteres inválidos');

// ---- tramos de voz y alineación a las pausas
const w1=wav(path.join(tmp,'a.wav'),[[.2,0],[2.0,.5],[.5,0],[1.5,.5],[.6,0],[2.2,.5],[.3,0]]);
const seg=V.speechSegments(w1);
ok(seg.segments.length===3&&Math.abs(seg.duration-7.3)<.01,'tramos de voz: '+JSON.stringify(seg));
const text='Primera oración de prueba bastante larga. Segunda más corta. Tercera oración que cierra la nota con calma.';
const cues=V.buildCues(text,seg.segments,seg.duration);
ok(cues.length===3,'debe haber 3 subtítulos');
ok(Math.abs(cues[1].start-seg.segments[1][0])<.05&&Math.abs(cues[0].end-seg.segments[0][1])<.05,'el corte no quedó en la pausa: '+JSON.stringify(cues));
ok(Math.abs(cues[2].start-seg.segments[2][0])<.05&&Math.abs(cues[2].end-seg.segments[2][1])<.05,'el último subtítulo no coincide con la voz');
ok(cues.every((c,i)=>c.end>c.start&&(!i||c.start>=cues[i-1].end)),'subtítulos superpuestos');
const srt=V.toSrt(cues);
ok(/^1\n00:00:00,2\d\d --> 00:00:02,2\d\d\nPrimera oración/.test(srt)&&/\n3\n00:00:0\d,\d{3} --> 00:00:07,0\d\d\n/.test(srt),'formato SRT:\n'+srt);
const f32=V.speechSegments(wav(path.join(tmp,'f.wav'),[[1,.5],[.5,0],[1,.5]],{float:true}));ok(f32.segments.length===2,'WAV float 32 no se analizó');
ok(V.buildCues('Sin voz detectada.',[],4).length===1,'sin tramos debe repartir en la duración');

// ---- de punta a punta: automatización simulada cuyo removeItem borra el audio
class Engine{constructor(){this.queue=[];}removeItem(item){if(item.audio?.path)try{fs.unlinkSync(item.audio.path);}catch{}this.queue=this.queue.filter(x=>x!==item);}}
const a=new Engine();const events=[],handlers={};
const electron={ipcMain:{handle:(k,fn)=>{handlers[k]=fn;},removeHandler:()=>{}},dialog:{},shell:{openPath:async()=>''},app:{getPath:()=>path.join(tmp,'Documentos')}};
const api={automation:()=>a,dataDir:()=>tmp,notify:(ch,p)=>events.push([ch,p]),log:()=>{}};
const inst=V.installVoiceArchiveLab36({api,electron,startTimer:false});
ok(handlers['voiceArchive:get']&&handlers['voiceArchive:set']&&handlers['voiceArchive:pick']&&handlers['voiceArchive:open'],'faltan los IPC voiceArchive:*');
let v=handlers['voiceArchive:get']();ok(!v.enabled&&v.srt&&v.keepDays===30&&/GEC Audios de voz$/.test(v.folder),'valores por defecto');
const out=path.join(tmp,'Archivo');
ok(handlers['voiceArchive:set']({},{enabled:true,folder:'relativa'}).ok===false,'carpeta relativa aceptada');
v=handlers['voiceArchive:set']({},{enabled:true,folder:out,srt:true,keepDays:15});ok(v.ok&&v.enabled&&v.keepDays===15,'no guardó la configuración');
const mk=(status,title)=>({status,sourceType:'rss',story:{title,link:'https://elcomercio.pe/nota',feedName:'El Comercio',pubDate:'2026-10-12T10:00:00Z'},
  result:{title,summary:'Bajada de la nota.',category:'DEPORTES',script:'Guion de la IA con 81 casos.',ttsScript:text},audio:{path:wav(path.join(tmp,`tts-${Math.random()}.wav`),[[.2,0],[2.0,.5],[.5,0],[1.5,.5],[.6,0],[2.2,.5],[.3,0]]),durationSec:7.3}});
const aired=mk('EMITIDA','México vs Chile: ¿dónde ver?');const bytes=fs.readFileSync(aired.audio.path);a.queue.push(aired);
a.removeItem(aired);
ok(!fs.existsSync(aired.audio.path),'la automatización debe seguir borrando su audio');
const days=fs.readdirSync(out);ok(days.length===1&&/^\d{4}-\d{2}-\d{2}$/.test(days[0]),'carpeta del día');
const files=fs.readdirSync(path.join(out,days[0])).sort();
ok(files.length===3&&files.every(f=>/^\d{2}-\d{2}-\d{2} · México vs Chile ¿dónde ver\.(srt|txt|wav)$/.test(f)),'archivos guardados: '+files.join(' | '));
const base=path.join(out,days[0],files[0].replace(/\.srt$/,''));
ok(Buffer.compare(fs.readFileSync(base+'.wav'),bytes)===0,'el WAV no es una copia exacta');
const txt=fs.readFileSync(base+'.txt','utf8');
ok(/Titular: México vs Chile: ¿dónde ver\?/.test(txt)&&/Bajada: Bajada de la nota\./.test(txt)&&/Fuente: El Comercio/.test(txt)&&/Enlace: https:\/\/elcomercio\.pe\/nota/.test(txt)&&/Duración de la voz: 0:07/.test(txt),'cabecera del .txt:\n'+txt);
ok(/GUION[^\n]*\r\nGuion de la IA con 81 casos\./.test(txt)&&/LOCUCIÓN[^\n]*\r\nPrimera oración/.test(txt),'guion y locución en el .txt');
ok(fs.readFileSync(base+'.srt','utf8')===srt,'el .srt no coincide con la voz');
ok(inst.state.count===1&&events.some(e=>e[0]==='voiceArchive:state'),'no avisó al panel');
// otra con el mismo título en el mismo segundo: no pisa
const twin=mk('EMITIDA','México vs Chile: ¿dónde ver?');inst.onRemove(twin);ok(fs.readdirSync(path.join(out,days[0])).length>=6,'pisó un archivo con el mismo nombre');
// omitida, con error o sin audio: no se guarda
const before=fs.readdirSync(path.join(out,days[0])).length;
for(const st of ['OMITIDA','ERROR','LISTA'])a.removeItem(mk(st,'No va'));a.removeItem({status:'EMITIDA',result:{title:'Sin audio'}});
ok(fs.readdirSync(path.join(out,days[0])).length===before,'guardó algo que no salió al aire');
// sin .srt / desactivado
handlers['voiceArchive:set']({},{enabled:true,folder:out,srt:false,keepDays:15});const r2=V.archiveItem(mk('EMITIDA','Sin subtítulos'),inst.config(),{now:new Date(2026,0,2,8,0,0)});ok(r2&&!r2.srt&&!fs.existsSync(r2.wav.replace(/\.wav$/,'.srt')),'creó .srt con la opción apagada');
handlers['voiceArchive:set']({},{enabled:false,folder:out});ok(V.archiveItem(mk('EMITIDA','Apagado'),inst.config())===null,'guardó con la opción apagada');

// ---- limpieza: solo días viejos y solo lo que crea este módulo
fs.mkdirSync(path.join(out,'2020-01-01'),{recursive:true});fs.writeFileSync(path.join(out,'2020-01-01','x.wav'),'a');fs.writeFileSync(path.join(out,'2020-01-01','nota.docx'),'b');
fs.mkdirSync(path.join(out,'2020-01-02'),{recursive:true});fs.writeFileSync(path.join(out,'2020-01-02','y.srt'),'a');
fs.mkdirSync(path.join(out,'Mis cosas'),{recursive:true});fs.writeFileSync(path.join(out,'Mis cosas','z.wav'),'a');
const n=V.cleanup({folder:out,keepDays:30},{now:new Date(2026,9,12)});
// 2020-01-01: x.wav · 2020-01-02: y.srt · 2026-01-02: .wav y .txt de «Sin subtítulos»
ok(n===4&&!fs.existsSync(path.join(out,'2020-01-02'))&&!fs.existsSync(path.join(out,'2026-01-02'))&&fs.existsSync(path.join(out,'2020-01-01','nota.docx'))&&fs.existsSync(path.join(out,'Mis cosas','z.wav'))&&fs.existsSync(path.join(out,days[0])),'la limpieza borró de más o de menos');
ok(V.cleanup({folder:out,keepDays:0})===0,'keepDays 0 no debe borrar');

// ---- Merlín solo habla si la salida muestra su página (si WebGL falla, la salida vuelve a output.html)
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const m=main.match(/const merlinPage=\(\)=>\{.*?\};\n/s);ok(m,'main.js no define merlinPage');
const page=url=>{const ctx={outputWindow:url==null?null:{isDestroyed:()=>false,webContents:{getURL:()=>url}}};vm.createContext(ctx);return vm.runInContext(`${m[0]};merlinPage()`,ctx);};
ok(page('file:///C:/GEC/resources/app.asar/src/output-merlin.html')===true,'con la página de Merlín debe hablar');
ok(page('file:///C:/GEC/resources/app.asar/src/output.html')===false,'con la salida clásica (respaldo) no debe hablar');
ok(page(null)===true&&page('')===true,'sin ventana o cargando: decide el modo');
ok(/const active=\(\)=>\{try\{return readPresenter\(\)\.mode==='merlin'&&\(currentDesign\?\.\(\)\|\|\{\}\)\.format!=='9:16'&&merlinPage\(\);/.test(main),'active() no consulta merlinPage');

// ---- conexión con el panel y el arranque
const pre=fs.readFileSync(path.join(root,'src/preload.js'),'utf8');
ok(/'voiceArchive:state'/.test(pre)&&/voiceArchiveSet:cfg=>invoke\('voiceArchive:set',cfg\)/.test(pre)&&/renderer-voice-archive-lab36\.js/.test(pre),'preload no expone el archivo de voz');
ok(/installRemoteNtfyLab35\(\);\s*require\('\.\/services\/voiceArchiveLab36'\)\.installVoiceArchiveLab36\(\);/.test(fs.readFileSync(path.join(root,'src/bootstrap-v2lab.js'),'utf8')),'no se instala al final de bootstrap-v2lab.js');
fs.rmSync(tmp,{recursive:true,force:true});
console.log(`check-voice-archive-lab36 OK (${checks} verificaciones) · wav · txt · srt · limpieza · Merlín`);
