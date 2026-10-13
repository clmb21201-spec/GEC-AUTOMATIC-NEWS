'use strict';
// Lab.36 · Archivo de voz para edición: por cada noticia que salió al aire (estado EMITIDA) guarda, antes de que la
// automatización borre el audio, una copia del WAV del TTS (solo la voz: la música se mezcla recién en la salida),
// un .txt con titular, bajada, guion de la IA, locución exacta y datos de la nota, y un .srt sincronizado con la voz.
// No depende de la salida (clásica o Merlín): se engancha a removeItem de la automatización.
// Carpeta: <carpeta>/AAAA-MM-DD/HH-MM-SS · Titular.{wav,txt,srt}. Configuración en voice-archive.json (carpeta de
// datos); limpieza opcional por días (solo carpetas AAAA-MM-DD y archivos .wav/.txt/.srt creados aquí).
// IPC voiceArchive:get|set|pick|open.
const fs=require('fs');
const path=require('path');

const FILE='voice-archive.json';
const EXT=new Set(['.wav','.txt','.srt']);
const pad=n=>String(n).padStart(2,'0');
const dayName=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

// ---------------------------------------------------------------- WAV: tramos con voz
function readWav(file){
  const b=fs.readFileSync(file);if(b.length<44||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE')return null;
  let o=12,fmt=null,data=null;
  while(o+8<=b.length){const id=b.toString('ascii',o,o+4),sz=b.readUInt32LE(o+4),st=o+8;
    if(id==='fmt ')fmt={format:b.readUInt16LE(st),channels:b.readUInt16LE(st+2),rate:b.readUInt32LE(st+4),bits:b.readUInt16LE(st+14)};
    else if(id==='data'){data=b.subarray(st,Math.min(b.length,st+sz));break;}
    o=st+sz+(sz%2);}
  return fmt&&data?{fmt,data}:null;
}
// [[inicio,fin],…] en s y duración total. PCM 16 bits o float 32 bits.
function speechSegments(file){
  const w=readWav(file);if(!w||!w.fmt.rate)return{segments:[],duration:0};
  const {fmt,data}=w,ch=Math.max(1,fmt.channels),float=fmt.format===3&&fmt.bits===32,bytes=float?4:fmt.bits===16?2:0;
  if(!bytes)return{segments:[],duration:0};
  const n=Math.floor(data.length/bytes),dur=n/ch/fmt.rate,frame=Math.max(1,Math.round(fmt.rate*.02))*ch,secPerFrame=frame/ch/fmt.rate,dbs=[];
  const at=i=>float?data.readFloatLE(i*4):data.readInt16LE(i*2)/32768;
  for(let i=0;i<n;i+=frame){let sum=0,c=0;for(let j=i;j<Math.min(n,i+frame);j++){const v=at(j);sum+=v*v;c++;}dbs.push(c?10*Math.log10(Math.max(sum/c,1e-12)):-120);}
  const sorted=[...dbs].sort((a,b)=>a-b),level=sorted[Math.floor(sorted.length*.9)]??-30,thr=Math.max(-55,Math.min(-30,level-30));
  const raw=[];let st=-1;dbs.forEach((db,i)=>{if(db>thr){if(st<0)st=i;}else if(st>=0){raw.push([st,i]);st=-1;}});if(st>=0)raw.push([st,dbs.length]);
  const merged=[];for(const r of raw){const last=merged[merged.length-1];if(last&&(r[0]-last[1])*secPerFrame<.12)last[1]=r[1];else merged.push([...r]);}
  const segments=merged.filter(r=>(r[1]-r[0])*secPerFrame>=.06).map(r=>[r[0]*secPerFrame,Math.min(dur,r[1]*secPerFrame)]);
  return{segments,duration:dur};
}

// ---------------------------------------------------------------- texto → subtítulos
// Bloques de hasta 2 líneas de ~42 caracteres, cortados en fin de oración, luego en comas y si no en palabras.
function splitCues(text,max=84){
  const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return[];
  const sentences=clean.match(/[^.!?…]+[.!?…]+["”»)]*|[^.!?…]+$/g)||[clean],out=[];
  for(let s of sentences.map(x=>x.trim()).filter(Boolean)){
    while(s.length>max){
      let cut=-1;for(const m of s.slice(0,max+1).matchAll(/[,;:](?=\s)/g))if(m.index>=max*.4)cut=m.index+1;
      if(cut<0){cut=s.lastIndexOf(' ',max);if(cut<max*.4)cut=s.indexOf(' ',max);if(cut<0)cut=s.length;}
      out.push(s.slice(0,cut).trim());s=s.slice(cut).trim();
    }
    if(s)out.push(s);
  }
  return out;
}
function twoLines(t,width=42){
  if(t.length<=width)return t;
  let best=-1;for(let i=0;i<t.length;i++)if(t[i]===' '&&(best<0||Math.abs(i-t.length/2)<Math.abs(best-t.length/2)))best=i;
  return best>0?`${t.slice(0,best)}\n${t.slice(best+1)}`:t;
}
// Reparte el texto sobre el tiempo con voz (proporcional a las letras) y ancla cada corte a la pausa más cercana.
function buildCues(text,segments,duration){
  const parts=splitCues(text);if(!parts.length)return[];
  const segs=segments&&segments.length?segments:[[0,Math.max(1,duration||parts.length*3)]];
  const voiced=segs.reduce((s,[a,b])=>s+(b-a),0),weights=parts.map(p=>Math.max(1,p.replace(/[^\p{L}\p{N}]/gu,'').length)),total=weights.reduce((a,b)=>a+b,0);
  const toTime=v=>{let acc=0;for(const [a,b] of segs){if(acc+(b-a)>=v)return a+(v-acc);acc+=b-a;}return segs[segs.length-1][1];};
  const gaps=[];for(let i=1;i<segs.length;i++)gaps.push([segs[i-1][1],segs[i][0]]);
  const bounds=[segs[0][0]];let acc=0;
  for(let i=0;i<parts.length-1;i++){
    acc+=weights[i];const t=toTime(voiced*acc/total);
    let best=null;for(const g of gaps){const d=Math.abs((g[0]+g[1])/2-t);if(d<.9&&(!best||d<best.d))best={g,d};}
    bounds.push(best?best.g:[t,t]);
  }
  bounds.push(segs[segs.length-1][1]);
  const cues=[];
  for(let i=0;i<parts.length;i++){
    const prev=bounds[i],next=bounds[i+1];
    let start=Array.isArray(prev)?prev[1]:prev,end=Array.isArray(next)?next[0]:next;
    if(cues.length)start=Math.max(start,cues[cues.length-1].end);
    if(end-start<.7)end=start+.7;
    cues.push({start,end,text:twoLines(parts[i])});
  }
  return cues;
}
const stamp=s=>{const ms=Math.max(0,Math.round(s*1000)),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,sec=Math.floor(ms/1000)%60;return`${pad(h)}:${pad(m)}:${pad(sec)},${String(ms%1000).padStart(3,'0')}`;};
const toSrt=cues=>cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n');

// ---------------------------------------------------------------- archivo
function safeName(s,max=70){
  const t=String(s||'Noticia').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'');
  return(t.length>max?t.slice(0,max).replace(/\s+\S*$/,''):t)||'Noticia';
}
const mmss=s=>{const v=Math.round(Number(s)||0);return`${Math.floor(v/60)}:${pad(v%60)}`;};
function textFile(item,{airedAt,duration}){
  const r=item.result||{},st=item.story||{},a=item.article||{};
  const rows=[['Titular',r.title||st.title],['Bajada',r.summary],['Categoría',r.category||st.category],['Exclusiva',(r.isExclusive||item.isExclusive)?'sí':''],
    ['Fuente',st.feedName],['Enlace',st.link||item.originalLink],['Publicada',st.pubDate||a.pubDate],['Emitida',airedAt.toLocaleString('es-PE')],
    ['Duración de la voz',duration?mmss(duration):''],['Motor de voz',item.audio?.engine||item.audio?.performanceLabel||'']].filter(([,v])=>v);
  return[...rows.map(([k,v])=>`${k}: ${String(v).replace(/\s+/g,' ').trim()}`),'',
    '── GUION (como lo escribió la IA) ──',String(r.script||'').trim()||'(sin guion)','',
    '── LOCUCIÓN (texto exacto que leyó la voz) ──',String(r.ttsScript||'').trim()||'(no disponible)',''].join('\r\n');
}
function archiveItem(item,cfg,{now=new Date(),log=()=>{}}={}){
  if(!cfg?.enabled||!cfg.folder||item?.status!=='EMITIDA')return null;
  const src=item.audio?.path;if(!src||!fs.existsSync(src))return null;
  const dir=path.join(cfg.folder,dayName(now));fs.mkdirSync(dir,{recursive:true});
  let base=`${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())} · ${safeName(item.result?.title||item.story?.title)}`;
  for(let i=2;fs.existsSync(path.join(dir,`${base}.wav`));i++)base=base.replace(/ \(\d+\)$/,'')+` (${i})`;
  const wav=path.join(dir,`${base}.wav`);fs.copyFileSync(src,wav);
  let seg={segments:[],duration:Number(item.audio?.durationSec)||0};try{seg=speechSegments(wav);}catch(e){log('VOICE_ARCHIVE',`análisis de voz: ${e.message||e}`);}
  fs.writeFileSync(path.join(dir,`${base}.txt`),'﻿'+textFile(item,{airedAt:now,duration:seg.duration||item.audio?.durationSec}),'utf8');
  let srt=null;
  if(cfg.srt!==false){const spoken=item.result?.ttsScript||[item.result?.title,item.result?.script].filter(Boolean).join('. ');
    const cues=buildCues(spoken,seg.segments,seg.duration);if(cues.length){srt=path.join(dir,`${base}.srt`);fs.writeFileSync(srt,toSrt(cues),'utf8');}}
  return{wav,txt:path.join(dir,`${base}.txt`),srt};
}
// borra días completos más viejos que keepDays (solo lo que crea este módulo)
function cleanup(cfg,{now=new Date(),log=()=>{}}={}){
  const days=Number(cfg?.keepDays)||0;if(!cfg?.folder||days<=0||!fs.existsSync(cfg.folder))return 0;
  const limit=new Date(now.getFullYear(),now.getMonth(),now.getDate()-days);let removed=0;
  for(const d of fs.readdirSync(cfg.folder)){
    const m=d.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)continue;
    if(new Date(+m[1],+m[2]-1,+m[3])>=limit)continue;
    const full=path.join(cfg.folder,d);
    try{for(const f of fs.readdirSync(full))if(EXT.has(path.extname(f).toLowerCase())){fs.unlinkSync(path.join(full,f));removed++;}
      if(!fs.readdirSync(full).length)fs.rmdirSync(full);}catch(e){log('VOICE_ARCHIVE',`limpieza ${d}: ${e.message||e}`);}
  }
  return removed;
}

// ---------------------------------------------------------------- instalación
function readJson(f,fb){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return fb;}}
function writeJson(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});const t=`${f}.tmp-${process.pid}`;fs.writeFileSync(t,JSON.stringify(v,null,2),'utf8');fs.renameSync(t,f);}

function installVoiceArchiveLab36({api=globalThis.__gecScheduleApi,electron=null,startTimer=true}={}){
  if(!api)return null;if(global.__gecVoiceArchiveLab36)return global.__gecVoiceArchiveLab36;
  const {ipcMain,dialog,shell,app}=electron||require('electron');
  const file=()=>path.join(api.dataDir(),FILE);
  const defaultFolder=()=>{try{return path.join(app.getPath('documents'),'GEC Audios de voz');}catch{return path.join(api.dataDir(),'Audios de voz');}};
  const config=()=>{const v=readJson(file(),{})||{};return{enabled:v.enabled===true,folder:String(v.folder||defaultFolder()),srt:v.srt!==false,keepDays:Math.max(0,Math.min(3650,Number(v.keepDays??30)||0))};};
  const log=(k,m)=>{try{api.log?.(k,m);}catch{}};
  const state={last:null,count:0,error:''};
  function onRemove(item){
    try{const r=archiveItem(item,config(),{log});if(r){state.last={file:path.basename(r.wav),at:Date.now()};state.count++;state.error='';log('VOICE_ARCHIVE',path.basename(r.wav));try{api.notify?.('voiceArchive:state',{...state});}catch{}}}
    catch(e){state.error=String(e.message||e);log('VOICE_ARCHIVE_ERROR',state.error);}
  }
  // removeItem borra el WAV: se guarda la copia justo antes. Se envuelve donde está definido (sirve para cualquier
  // instancia); si la automatización todavía no existe, se reintenta.
  const patch=()=>{
    const a=api.automation?.();if(!a)return false;
    let p=Object.getPrototypeOf(a);while(p&&!Object.prototype.hasOwnProperty.call(p,'removeItem'))p=Object.getPrototypeOf(p);
    const targets=[Object.prototype.hasOwnProperty.call(a,'removeItem')?a:null,p].filter(Boolean);
    for(const t of targets){if(t.__gecLab36)continue;const base=t.removeItem;t.removeItem=function(item,...rest){onRemove(item);return base.call(this,item,...rest);};Object.defineProperty(t,'__gecLab36',{value:true});}
    return true;
  };
  if(!patch()){const t=setInterval(()=>{if(patch())clearInterval(t);},1000);t.unref?.();}
  const handle=(k,fn)=>{try{ipcMain.removeHandler(k);}catch{}ipcMain.handle(k,fn);};
  const view=()=>({ok:true,...config(),state:{...state}});
  handle('voiceArchive:get',()=>view());
  handle('voiceArchive:set',(_e,inc={})=>{
    const cur=readJson(file(),{})||{},folder=String(inc.folder||cur.folder||defaultFolder()).trim();
    if(!path.isAbsolute(folder))return{ok:false,error:'Elige una carpeta válida.'};
    try{fs.mkdirSync(folder,{recursive:true});fs.accessSync(folder,fs.constants.W_OK);}catch{return{ok:false,error:'No se puede escribir en esa carpeta.'};}
    writeJson(file(),{...cur,enabled:inc.enabled===true,folder,srt:inc.srt!==false,keepDays:Math.max(0,Math.min(3650,Number(inc.keepDays)||0))});
    return view();
  });
  handle('voiceArchive:pick',async()=>{const r=await dialog.showOpenDialog({title:'Carpeta para los audios de voz',defaultPath:config().folder,properties:['openDirectory','createDirectory']});return r.canceled||!r.filePaths?.[0]?{ok:false,canceled:true}:{ok:true,folder:r.filePaths[0]};});
  handle('voiceArchive:open',async()=>{const f=config().folder;try{fs.mkdirSync(f,{recursive:true});}catch{}const err=await shell.openPath(f);return err?{ok:false,error:err}:{ok:true};});
  if(startTimer){const run=()=>{try{const n=cleanup(config(),{log});if(n)log('VOICE_ARCHIVE',`limpieza: ${n} archivos`);}catch{}};setTimeout(run,60000).unref?.();const t=setInterval(run,6*3600000);t.unref?.();}
  global.__gecVoiceArchiveLab36={config,onRemove,patch,state};
  return global.__gecVoiceArchiveLab36;
}

module.exports={installVoiceArchiveLab36,archiveItem,speechSegments,splitCues,buildCues,toSrt,safeName,cleanup,textFile};
