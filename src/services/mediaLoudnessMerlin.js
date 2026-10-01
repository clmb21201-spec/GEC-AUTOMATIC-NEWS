'use strict';
// Volumen normalizado de enlatados y anuncios (Merlín, sección 6B).
// El panel de control mide cada video con Web Audio (renderer-media-loudness.js) y guarda aquí la ganancia.
// La salida la recibe como p.audioGainDb en el payload kind:'canned'. Si no se pudo medir, no se envía (0 dB).
const fs=require('fs'),path=require('path'),{fileURLToPath}=require('url');

const STORE_FILE='media-loudness.json';
const MAX_ENTRIES=2000;
const MAX_READ_BYTES=300*1024*1024;

class MediaLoudness{
  constructor({dataDir,canned,ads}){this.dataDir=dataDir;this.canned=canned;this.ads=ads;this.store=null;}
  file(){return path.join(this.dataDir,STORE_FILE);}
  load(){if(this.store)return this.store;try{const v=JSON.parse(fs.readFileSync(this.file(),'utf8'));this.store=v&&typeof v==='object'&&v.entries&&typeof v.entries==='object'?v:{entries:{}};}catch{this.store={entries:{}};}return this.store;}
  save(){try{fs.mkdirSync(this.dataDir,{recursive:true});const tmp=this.file()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.store,null,1),'utf8');fs.renameSync(tmp,this.file());}catch{}}
  // la clave cambia si el archivo se reemplaza o se edita, así se vuelve a medir
  keyFor(file,st){return `${file}|${st.size}|${Math.round(st.mtimeMs)}`;}
  // videos de las carpetas de enlatados y anuncios que todavía no tienen medición
  pending(settings={},limit=3){
    const c=settings.canned||{},folders=[[this.canned,c.folder],[this.ads,c.adsFolder]],entries=this.load().entries,out=[];
    for(const [mgr,folder] of folders){const dir=String(folder||'').trim();if(!mgr||!dir)continue;let scan;try{scan=mgr.list(dir);}catch{continue;}if(!scan?.ok)continue;
      for(const f of scan.files){const key=`${f.path}|${f.sizeBytes}|${Math.round(f.mtimeMs)}`;if(key in entries)continue;out.push({key,name:f.name,sizeBytes:f.sizeBytes,tooLarge:f.sizeBytes>MAX_READ_BYTES});if(out.length>=limit)return out;}}
    return out;
  }
  // bytes del archivo para que el panel lo decodifique (solo claves de pending, y con tope de tamaño)
  read(key){
    const file=String(key||'').split('|')[0];let st;try{st=fs.statSync(file);}catch{throw new Error('El archivo ya no existe');}
    if(this.keyFor(file,st)!==key)throw new Error('El archivo cambió');if(st.size>MAX_READ_BYTES)throw new Error('Archivo demasiado grande para medir');
    const b=fs.readFileSync(file);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
  }
  // gainDb numérico, o null si no se pudo medir (no se vuelve a intentar hasta que el archivo cambie)
  set(key,gainDb){
    const k=String(key||'');if(!k.includes('|'))return false;const g=gainDb==null||!Number.isFinite(Number(gainDb))?null:Math.max(-12,Math.min(6,Math.round(Number(gainDb)*10)/10));
    const s=this.load();s.entries[k]={gainDb:g,at:Date.now()};const keys=Object.keys(s.entries);if(keys.length>MAX_ENTRIES)for(const old of keys.sort((a,b)=>(s.entries[a].at||0)-(s.entries[b].at||0)).slice(0,keys.length-MAX_ENTRIES))delete s.entries[old];
    this.save();return true;
  }
  gainForUrl(url){
    let file='';try{file=String(url||'').startsWith('file:')?fileURLToPath(url):'';}catch{}if(!file)return undefined;
    let st;try{st=fs.statSync(file);}catch{return undefined;}const e=this.load().entries[this.keyFor(file,st)];
    return e&&Number.isFinite(e.gainDb)?e.gainDb:undefined;
  }
}

module.exports={MediaLoudness,MAX_READ_BYTES};
