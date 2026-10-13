'use strict';
// Lab.48 · después de reiniciar, la optimización guardada sigue figurando como OPTIMIZADA (la IA de texto detenida
// recibe el perfil al consultar el estado; si está corriendo con otra configuración, se informa la diferencia).
const Module=require('module'),path=require('path'),fs=require('fs'),os=require('os'),assert=require('assert');
const handlers=new Map(),baseLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='electron')return{app:{isPackaged:false,getPath:()=>os.tmpdir(),on(){},whenReady:()=>new Promise(()=>{}),getVersion:()=>'2.0'},ipcMain:{handle:(k,fn)=>handlers.set(k,fn),on(){},removeHandler:k=>handlers.delete(k)},BrowserWindow:Object.assign(function(){},{getAllWindows:()=>[]}),dialog:{},shell:{},screen:{}};
  return baseLoad.call(this,request,parent,isMain);
};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-opt-badge-'));
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
require(path.join(src,'services','releaseV2QwenSpeedLab31')).installReleaseV2QwenSpeedLab31();
const mod=require(path.join(src,'services','releaseV2ProfileByModelLab31'));mod.installReleaseV2ProfileByModelLab31();
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};
(async()=>{
  const base=glob.dataRoot(),store=()=>new SettingsStore(base),pf=fidelity.profileFile(base);
  const s=store().load();s.ai.primary='local';s.tts.engine='qwen3tts';s.optimization0321={version:'2.0-lab.25',ttsEngine:'qwen3tts',fingerprint:'hw1',at:new Date().toISOString(),voice:{medianRtf:.6}};store().save(s);
  const tuned={gpuLayers:99,batch:512,ubatch:256,threads:6,prio:0,poll:25,warmup:true,ctx:4096};
  const p=fidelity.buildProfile(store().load(),{fingerprint:'hw1',source:'optimizer',validated:true,pipelineMode:'simultaneous',localResult:{recommendedConfig:tuned}});
  fs.mkdirSync(path.dirname(pf),{recursive:true});fs.writeFileSync(pf,JSON.stringify(p));
  const fresh=()=>({resourceMode:'safe_streaming',cfg:{gpuLayers:20,batch:384,ubatch:192,threads:4,prio:-1,poll:0,warmup:false,ctx:4096},running:false,calls:0,
    configure(m,c){this.calls++;this.resourceMode=m;if(c)this.cfg={...c};},async status(){return{running:this.running,resourceMode:this.resourceMode,profile:{...this.cfg,parallel:1}};}});

  // programa recién abierto: IA de texto detenida y en su modo por defecto
  let rt=fresh();global.__ec0320LocalRuntime=rt;
  let st=await glob.status(base);
  ok(st.compatible===true,`el perfil guardado sigue valiendo: ${st.reason}`);
  ok(st.profileMatch?.ok===true,`la insignia debe decir OPTIMIZADA después de reiniciar: ${st.profileMatch?.reason}`);
  ok(rt.resourceMode==='tuned'&&rt.cfg.gpuLayers===99&&rt.calls===1,'la IA de texto detenida recibe el perfil optimizado');
  st=await glob.status(base);ok(rt.calls===1&&st.profileMatch?.ok===true,'ya aplicado: no se vuelve a configurar');

  // corriendo con otra configuración: no se toca (se reiniciaría) y se informa la diferencia
  rt=fresh();rt.running=true;global.__ec0320LocalRuntime=rt;
  st=await glob.status(base);
  ok(rt.calls===0&&st.profileMatch?.ok===false,'en marcha con otra configuración no se reconfigura y se avisa');

  // perfil de otro modelo (incompatible): no se aplica a la IA de texto
  rt=fresh();global.__ec0320LocalRuntime=rt;
  {const x=store().load();x.tts.engineParams.qwen3tts.voiceMode='finetuned';x.tts.engineParams.qwen3tts.fineTunedModelId='m9';store().save(x);}
  st=await glob.status(base);
  ok(st.compatible===false&&rt.calls===0,'un perfil incompatible no se aplica');

  const src29=fs.readFileSync(path.join(src,'services','releaseV2GlobalOptimizationLab29.js'),'utf8');
  ok(/Lab\.48/.test(src29),'Lab.29 aplica el perfil a la IA de texto detenida');
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
  console.log(`check-optimization-badge-lab48 OK (${checks} verificaciones) · perfil aplicado tras reiniciar`);
})().catch(e=>{console.error('check-optimization-badge-lab48: '+(e.stack||e.message));process.exit(1);});
