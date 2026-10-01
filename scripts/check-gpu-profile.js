'use strict';
// Verifica que TTS Lab elija PyTorch según la GPU: RTX serie 50 (Blackwell, sm_120) -> CUDA 12.8; resto -> CUDA 12.4.
const path=require('path'),fs=require('fs'),os=require('os'),assert=require('assert');
const {TTSLabRuntime}=require(path.join(__dirname,'..','src','services','ttsLabRuntime.js'));
(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-gpu-'));
  const rt=new TTSLabRuntime({resourcesDir:tmp,dataDir:tmp});
  assert.strictEqual(rt.cudaProfile,'standard');
  const cases=[['NVIDIA GeForce RTX 5070, 12.0','blackwell','cu128'],['NVIDIA GeForce RTX 3080, 8.6','standard','cu124'],['NVIDIA GeForce RTX 5090','blackwell','cu128'],['NVIDIA GeForce RTX 4070, 8.9','standard','cu124']];
  for(const [out,profile,cuda] of cases){rt.cudaProfilePromise=null;rt.runProcess=async(exe,args)=>args[0].includes('compute_cap')&&!out.includes(',')?{status:6,stdout:'',stderr:'Field "compute_cap" is not a valid field'}:{status:0,stdout:out.split(',').slice(0,args[0].includes('compute_cap')?2:1).join(',')+'\n',stderr:''};
    const r=await rt.detectCudaProfile();assert.strictEqual(r.profile,profile,out);assert(rt.cudaRoot.includes(cuda==='cu128'?'cu128':'shared-cuda-v2'),out);
    const {CUDA_RUNTIME}=require(path.join(__dirname,'..','src','services','ttsLabRuntime.js'));assert(CUDA_RUNTIME.indexUrl.endsWith(cuda),out);}
  const again=new TTSLabRuntime({resourcesDir:tmp,dataDir:tmp});assert.strictEqual(again.cudaProfile,'standard','el perfil detectado debe persistir');
  rt.cudaProfilePromise=null;rt.runProcess=async()=>{throw new Error('ENOENT');};const none=await rt.detectCudaProfile();assert.strictEqual(none.detected,false);
  const src=fs.readFileSync(path.join(__dirname,'..','src','services','ttsLabRuntime.js'),'utf8');assert(src.includes("device='cuda'")&&src.includes('no puede ejecutar en esta GPU'),'La validación CUDA debe probar un cálculo real en la GPU');
  console.log('check-gpu-profile OK · RTX 50 -> cu128 · resto -> cu124 · persistencia · sin GPU');
})().catch(e=>{console.error(e);process.exit(1);});
