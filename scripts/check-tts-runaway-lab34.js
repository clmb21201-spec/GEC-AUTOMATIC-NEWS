'use strict';
// Lab.34 · control de la aplicación sobre la voz que no se detiene (services/ttsRunawayGuardLab34.js).
const fs=require('fs'),os=require('os'),path=require('path');
const root=path.join(__dirname,'..');
const {TTSLabRuntime}=require(path.join(root,'src/services/ttsLabRuntime'));
let checks=0;const ok=(c,m)=>{checks++;if(!c){console.error('check-tts-runaway-lab34: '+m);process.exit(1);}};

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-lab34-'));
// motor simulado: generate devuelve la duración pedida; command devuelve lo que traiga el worker
let nextDur=0,nextCommand={},lastPath='';
TTSLabRuntime.prototype.generate=async function(id,text){const p=path.join(tmp,`v-${Date.now()}-${Math.random()}.wav`);fs.writeFileSync(p,Buffer.alloc(2000));lastPath=p;return{path:p,durationSec:nextDur};};
TTSLabRuntime.prototype.command=async function(){return nextCommand;};
const {installTtsRunawayGuardLab34,limitSec}=require(path.join(root,'src/services/ttsRunawayGuardLab34'));
installTtsRunawayGuardLab34();installTtsRunawayGuardLab34();
const rt=Object.create(TTSLabRuntime.prototype);rt.dataDir=tmp;
const settle=()=>new Promise(r=>setTimeout(r,80));
const log=()=>{try{return fs.readFileSync(path.join(tmp,'logs','tts-runaway.log'),'utf8');}catch{return'';}};
const text='Canal 5 transmite en vivo el partido amistoso entre México y Chile este martes. '.repeat(18); // ~100 s esperados

(async()=>{
  ok(limitSec(text)>text.length/14*1.9&&limitSec(text)<text.length/14*2.5+10,'límite fuera de rango');
  ok(limitSec('Hola.')>=20,'límite mínimo para frases cortas (intervenciones de Merlín)');
  nextDur=text.length/14*1.1;
  const good=await rt.generate('qwen3tts',text,{});
  ok(good.durationSec===nextDur&&fs.existsSync(good.path),'un audio normal no debe tocarse');
  // el caso real: ~100 s de voz y ~70 s de ruido
  nextDur=text.length/14+70+80;let err=null,res=null;
  try{res=await rt.generate('qwen3tts',text,{});}catch(e){err=e;}
  ok(err&&err.code==='TTS_RUNAWAY','un audio desproporcionado debe descartarse antes de emitirse');
  ok(/no se detuvo/.test(err.message),'el error debe explicar la causa');
  ok(!fs.existsSync(lastPath),'el WAV descartado debe borrarse');
  await settle();ok(/descartado/.test(log()),'el descarte debe quedar en logs/tts-runaway.log');
  // en mediciones solo se registra
  res=await rt.generate('qwen3tts',text,{params:{benchmarkSeed:20260908}});
  ok(res&&res.durationSec===nextDur,'en una medición no debe lanzar error');
  await settle();ok(/medición: solo se registra/.test(log()),'la medición debe quedar registrada');
  // lo que corrigió el worker queda registrado
  nextCommand={runaway:[{chunk:2,chars:340,audio_sec:66.1,expected_sec:24.3,reason:'tope+largo+cola',action:'regenerado',retry:{audio_sec:23.8,reason:''}}]};
  const r=await rt.command('qwen3tts',{text,output:'C:/x/nota.wav'});
  ok(r===nextCommand,'command debe devolver el resultado del worker sin cambios');
  await settle();ok(/fragmento 2 \(340 caracteres\): 66\.1 s para ~24\.3 s \[tope\+largo\+cola\] · reintento 23\.8 s \(bien\) → regenerado · nota\.wav/.test(log()),'falta el registro del fragmento regenerado:\n'+log());
  // instalado al final del arranque
  const boot=fs.readFileSync(path.join(root,'src/bootstrap-v2lab.js'),'utf8');
  ok(/installBroadcastScheduleLab33\(\);\s*require\('\.\/services\/ttsRunawayGuardLab34'\)\.installTtsRunawayGuardLab34\(\);/.test(boot),'el control no se instala al final de bootstrap-v2lab.js');
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log(`check-tts-runaway-lab34 OK (${checks} verificaciones)`);
})().catch(e=>{console.error(e);process.exit(1);});
