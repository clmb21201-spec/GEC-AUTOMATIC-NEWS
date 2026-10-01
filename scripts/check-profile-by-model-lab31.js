'use strict';
// Lab.31 · el perfil de producción se guarda por modelo de voz y se repone al volver a ese modelo.
const Module=require('module'),path=require('path'),fs=require('fs'),os=require('os'),assert=require('assert');
const handlers=new Map(),baseLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='electron')return{app:{isPackaged:false,getPath:()=>os.tmpdir(),on(){},whenReady:()=>new Promise(()=>{}),getVersion:()=>'2.0'},ipcMain:{handle:(k,fn)=>handlers.set(k,fn),on(){},removeHandler:k=>handlers.delete(k)},BrowserWindow:Object.assign(function(){},{getAllWindows:()=>[]}),dialog:{},shell:{},screen:{}};
  return baseLoad.call(this,request,parent,isMain);
};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-profile-model-'));
process.env.GEC_V2_TTS_LAB='1';process.env.GEC_V2_TTS_LAB_ROOT=tmp;
const root=path.join(__dirname,'..'),src=path.join(root,'src');
const {TTSLabRuntime}=require(path.join(src,'services','ttsLabRuntime.js'));
TTSLabRuntime.prototype.fineTunedModel=id=>id?{id,fingerprint:'fp-'+id,name:'Modelo '+id}:null;
const {SettingsStore}=require(path.join(src,'services','settings.js'));
require(path.join(src,'services','releaseV2Lab')).installReleaseV2Lab();
const fidelity=require(path.join(src,'services','releaseV2ProductionFidelity'));fidelity.installV2ProductionFidelity();
require(path.join(src,'services','releaseV2Stabilization')).installReleaseV2Stabilization();
const glob=require(path.join(src,'services','releaseV2GlobalOptimizationLab29'));glob.installMachineGlobalOptimizationLab29();
require(path.join(src,'services','releaseV2FinalCorrectionsLab29')).installReleaseV2FinalCorrectionsLab29();
const mod=require(path.join(src,'services','releaseV2ProfileByModelLab31'));mod.installReleaseV2ProfileByModelLab31();
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};

(async()=>{
  const base=glob.dataRoot(),store=()=>new SettingsStore(base),pf=fidelity.profileFile(base);
  const active=()=>JSON.parse(fs.readFileSync(pf,'utf8'));
  const setMode=(mode,model='')=>{const s=store().load();s.tts.engine='qwen3tts';s.tts.referenceVoiceId='v1';Object.assign(s.tts.engineParams.qwen3tts,{voiceMode:mode,fineTunedModelId:model});store().save(s);};
  const optimize=(label,layers)=>{const s=store().load();s.optimization0321={version:'2.0-lab.25',ttsEngine:'qwen3tts',fingerprint:'hw1',hardwareLabel:'RTX',at:new Date().toISOString(),voice:{medianRtf:1}};store().save(s);
    const p=fidelity.buildProfile(store().load(),{fingerprint:'hw1',hardwareLabel:'RTX',source:'optimizer',validated:true});p.pipeline={...(p.pipeline||{}),mode:'simultaneous',validated:true};p.localAi={...(p.localAi||{}),config:{...(p.localAi?.config||{}),gpuLayers:layers}};p.check=label;fs.mkdirSync(path.dirname(pf),{recursive:true});fs.writeFileSync(pf,JSON.stringify(p));};

  // 1) zero-shot optimizado: el perfil queda archivado con su modelo
  setMode('reference');optimize('zero-shot',48);
  let st=await glob.status(base);
  ok(st.compatible===true,`el perfil de zero-shot debe valer: ${st.reason}`);
  let arch=JSON.parse(fs.readFileSync(mod.archiveFile(base),'utf8'));
  ok(arch.entries['qwen3tts:reference:v1']?.profile?.check==='zero-shot','el perfil de zero-shot debe archivarse por modelo');

  // 2) fine-tuned sin optimizar: no hay perfil para él
  setMode('finetuned','m1');st=await glob.status(base);
  ok(st.compatible===false&&active().check==='zero-shot','un modelo sin optimizar no recibe el perfil de otro');
  optimize('fine-tuned',99);st=await glob.status(base);
  ok(st.compatible===true,'el perfil del fine-tuned debe valer');
  arch=JSON.parse(fs.readFileSync(mod.archiveFile(base),'utf8'));
  ok(arch.entries['qwen3tts:finetuned:m1']?.profile?.check==='fine-tuned'&&arch.entries['qwen3tts:reference:v1']?.profile?.check==='zero-shot','los dos perfiles quedan archivados');

  // 3) volver a zero-shot repone su perfil sin reoptimizar, y al revés
  setMode('reference');st=await glob.status(base);
  ok(st.compatible===true&&active().check==='zero-shot'&&st.profile?.localAi?.config?.gpuLayers===48,'al volver a zero-shot se repone su perfil');
  ok(Number(store().load().ai?.localTunedConfig?.gpuLayers||48)===48,'la configuración de la IA local sigue al perfil repuesto');
  setMode('finetuned','m1');st=await glob.status(base);
  ok(st.compatible===true&&active().check==='fine-tuned','al volver al fine-tuned se repone su perfil');

  // 4) otro fine-tuned u otra computadora no reciben un perfil archivado
  setMode('finetuned','m2');st=await glob.status(base);
  ok(st.compatible===false,'otro fine-tuned no hereda el perfil de m1');
  setMode('reference');{const s=store().load();s.optimization0321={...(s.optimization0321||{}),fingerprint:'hw2'};store().save(s);}
  st=await glob.status(base);ok(!(st.compatible===true&&st.profile?.fingerprint==='hw1'&&store().load().optimization0321?.fingerprint==='hw2'),'un perfil de otra computadora no se repone');

  // 5) borrar la optimización borra también los archivados
  ok(handlers.has('optimization-v2:clear'),'falta el IPC optimization-v2:clear');
  await handlers.get('optimization-v2:clear')();
  ok(!fs.existsSync(mod.archiveFile(base)),'borrar la optimización debe borrar los perfiles archivados');

  // 6) instalación
  const boot=fs.readFileSync(path.join(src,'bootstrap-v2lab.js'),'utf8'),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  ok(boot.indexOf('releaseV2ProfileByModelLab31')>boot.indexOf('releaseV2QwenSpeedLab31'),'el perfil por modelo se instala al final');
  ok(/check-profile-by-model-lab31\.js/.test(pkg.scripts.check),'el script check debe correr este check');

  fs.rmSync(tmp,{recursive:true,force:true});
  console.log(`check-profile-by-model-lab31.js OK (${checks} verificaciones)`);
})().catch(e=>{console.error(e);process.exit(1);});
