'use strict';
// Lab.31 · Perfil de producción por modelo de voz.
// El perfil de producción (tts-lab/active-production-profile.json: pipeline, capas de la IA local, RTF esperado) es
// uno solo por computadora y queda atado al modelo de voz con el que se optimizó. Al pasar de zero-shot a un
// fine-tuned (o al revés) dejaba de valer y había que reoptimizar aunque ese modelo ya estuviera optimizado.
// Ahora cada perfil válido se archiva por modelo (tts-lab/production-profiles-by-model.json) y, al cargar la
// configuración con otro modelo, se repone el perfil archivado de ese modelo si sigue siendo compatible
// (misma computadora, runtime y modelo). La optimización de la voz ya se guardaba por modelo (Lab.29/Lab.31).
const fs=require('fs');
const path=require('path');
const {ipcMain}=require('electron');
const {SettingsStore}=require('./settings');
const fidelity=require('./releaseV2ProductionFidelity');
const lab=require('./releaseV2Lab');

const ARCHIVE_FILE='production-profiles-by-model.json';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function readJson(file,fallback=null){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function atomicJson(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');
  try{fs.renameSync(tmp,file);}catch{fs.copyFileSync(tmp,file);try{fs.rmSync(tmp,{force:true});}catch{}}
}
function archiveFile(base){return path.join(base,'tts-lab',ARCHIVE_FILE);}
function readArchive(base){const raw=readJson(archiveFile(base),{});return{schemaVersion:1,entries:raw&&raw.entries&&typeof raw.entries==='object'?raw.entries:{}};}
function modelKey(settings){try{return lab.optimizationKey(settings?.tts||{});}catch{return'';}}
// misma regla que el perfil global (Lab.29): compatible con el modelo y de esta computadora
function usable(settings,profile){
  if(!profile)return false;
  let cmp;try{cmp=fidelity.compatibility(settings,profile);}catch{return false;}
  if(!cmp.ok)return false;
  const saved=String(settings?.optimization0321?.fingerprint||''),fp=String(profile.fingerprint||'');
  return !saved||!fp||saved===fp;
}

// Devuelve true si repuso el perfil archivado del modelo actual (hay que volver a cargar la configuración).
function syncProfileForModel(base,settings){
  const key=modelKey(settings);if(!key)return false;
  const file=fidelity.profileFile(base),active=readJson(file,null),archive=readArchive(base);
  if(active&&usable(settings,active)){
    const prev=archive.entries[key];
    if(!prev||JSON.stringify(prev.profile)!==JSON.stringify(active)){archive.entries[key]={profile:clone(active),savedAt:new Date().toISOString()};atomicJson(archiveFile(base),archive);}
    return false;
  }
  const entry=archive.entries[key];
  if(!entry?.profile||!usable(settings,entry.profile))return false;
  if(active&&JSON.stringify(active)===JSON.stringify(entry.profile))return false;
  // el perfil activo es de otro modelo: se archiva con su clave antes de reemplazarlo
  if(active){const otherKey=String(active.tts?.optimizationKey||'');if(otherKey&&otherKey!==key&&!archive.entries[otherKey]){archive.entries[otherKey]={profile:clone(active),savedAt:new Date().toISOString()};atomicJson(archiveFile(base),archive);}}
  atomicJson(file,clone(entry.profile));
  return true;
}

function installLoadHook(){
  const p=SettingsStore.prototype;if(p.__gecLab31ProfileByModel)return;Object.defineProperty(p,'__gecLab31ProfileByModel',{value:true});
  const baseLoad=p.load;
  p.load=function(...args){
    const settings=baseLoad.apply(this,args);
    let swapped=false;
    try{swapped=syncProfileForModel(this.baseDir,settings);}catch{}
    // con el perfil repuesto, las capas anteriores (Lab.29) aplican su configuración de producción
    return swapped?baseLoad.apply(this,args):settings;
  };
}

// "Borrar optimización" también borra los perfiles archivados; si no, el próximo load los repondría.
function installClearHook(){
  if(global.__gecLab31ProfileByModelClear)return;global.__gecLab31ProfileByModelClear=true;
  const glob=require('./releaseV2GlobalOptimizationLab29');
  try{ipcMain.removeHandler('optimization-v2:clear');}catch{}
  ipcMain.handle('optimization-v2:clear',async()=>{
    try{fs.rmSync(archiveFile(glob.dataRoot()),{force:true});}catch{}
    return glob.clear();
  });
}

function installReleaseV2ProfileByModelLab31(){installLoadHook();installClearHook();}

module.exports={installReleaseV2ProfileByModelLab31,syncProfileForModel,archiveFile,ARCHIVE_FILE};
