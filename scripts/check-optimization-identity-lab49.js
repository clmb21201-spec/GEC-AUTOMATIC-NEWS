'use strict';
// Lab.49 · la optimización del fine-tuned recupera su modelo al cargar (la copia por perfil de Lab.28 lo perdía).
const Module=require('module'),path=require('path'),fs=require('fs'),os=require('os'),assert=require('assert');
const handlers=new Map(),baseLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='electron')return{app:{isPackaged:false,getPath:()=>os.tmpdir(),on(){},whenReady:()=>new Promise(()=>{}),getVersion:()=>'2.0'},ipcMain:{handle:(k,fn)=>handlers.set(k,fn),on(){},removeHandler:k=>handlers.delete(k)},BrowserWindow:Object.assign(function(){},{getAllWindows:()=>[]}),dialog:{},shell:{},screen:{}};
  return baseLoad.call(this,request,parent,isMain);
};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-opt-identity-'));
process.env.GEC_V2_TTS_LAB='1';process.env.GEC_V2_TTS_LAB_ROOT=tmp;
const root=path.join(__dirname,'..'),src=path.join(root,'src');
const {TTSLabRuntime}=require(path.join(src,'services','ttsLabRuntime.js'));
TTSLabRuntime.prototype.fineTunedModel=id=>id?{id,fingerprint:'fp-'+id,name:'Modelo '+id}:null;
const lab=require(path.join(src,'services','releaseV2Lab'));
const L=require(path.join(src,'services','optimizationIdentityLab49'));
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};
const tts=(mode,model,ref='v1')=>({engine:'qwen3tts',referenceVoiceId:ref,engineParams:{qwen3tts:{voiceMode:mode,fineTunedModelId:model}}});
// así queda la copia por perfil (optimization-lab28.json): clave y firma, sin el modelo
const lost=t=>({version:'2.0-lab.25',ttsEngine:'qwen3tts',fingerprint:'hw1',ttsOptimizationKey:lab.optimizationKey(t),ttsRuntimeSignature:lab.ttsRuntimeSignature(t)});
// el panel (renderer-v2lab.js, optimizationMatchesCurrent) exige modelo y huella iguales al elegido
const panelOk=s=>{const o=s.optimization0321||{},p=s.tts.engineParams.qwen3tts;return o.ttsEngine==='qwen3tts'&&(!o.ttsOptimizationKey||o.ttsOptimizationKey===lab.optimizationKey(s.tts))&&(p.voiceMode!=='finetuned'||(o.ttsModelId===p.fineTunedModelId&&o.ttsModelFingerprint==='fp-'+p.fineTunedModelId));};

let s={tts:tts('finetuned','m1'),optimization0321:lost(tts('finetuned','m1'))};
ok(!panelOk(s),'sin el arreglo el panel la toma como no optimizada');
ok(L.completeIdentity(s)&&panelOk(s),'se completa con el modelo actual y el panel la da por optimizada');
ok(s.optimization0321.ttsMode==='finetuned'&&s.optimization0321.fingerprint==='hw1','conserva el resto de la optimización');
ok(!L.completeIdentity(s),'ya completa: no se toca');

s={tts:tts('finetuned','m2'),optimization0321:lost(tts('finetuned','m1'))};
ok(!L.completeIdentity(s)&&!panelOk(s),'optimización de otro modelo: no se completa');

s={tts:tts('finetuned','m1'),optimization0321:{...lost(tts('finetuned','m1')),ttsRuntimeSignature:lab.ttsRuntimeSignature(tts('finetuned','m1')).replace('fingerprint=fp-m1','fingerprint=viejo')}};
ok(!L.completeIdentity(s),'el archivo del modelo cambió (otra huella): no se completa');

s={tts:tts('finetuned','m1'),optimization0321:{version:'2.0-lab.25',ttsEngine:'qwen3tts'}};
ok(!L.completeIdentity(s),'fine-tuned sin firma del runtime: no se adivina el modelo');

s={tts:tts('reference','','v2'),optimization0321:lost(tts('reference','','v1'))};
s.optimization0321.ttsOptimizationKey='';
ok(L.completeIdentity(s)&&s.optimization0321.ttsMode==='reference'&&panelOk(s),'zero-shot con otra voz de referencia: se completa (la referencia no cuenta como otro modelo)');

s={tts:{engine:'kokoro'},optimization0321:{ttsEngine:'kokoro'}};
ok(!L.completeIdentity(s),'otros motores no se tocan');

// instalado sobre SettingsStore.load
class Store{load(){return{tts:tts('finetuned','m1'),optimization0321:lost(tts('finetuned','m1'))};}}
ok(L.installOptimizationIdentityLab49({SettingsStore:Store})&&!L.installOptimizationIdentityLab49({SettingsStore:Store}),'se instala una sola vez');
ok(panelOk(new Store().load()),'al cargar los ajustes la optimización trae el modelo');
const boot=fs.readFileSync(path.join(src,'bootstrap-v2lab.js'),'utf8');
ok(/optimizationIdentityLab49'\)\.installOptimizationIdentityLab49\(\)/.test(boot)&&boot.indexOf('optimizationIdentityLab49')>boot.indexOf('releaseV2ProfileByModelLab31'),'bootstrap instala Lab.49 por fuera de las capas de la optimización');
try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
console.log(`check-optimization-identity-lab49 OK (${checks} verificaciones) · el fine-tuned conserva su optimización al reabrir`);
