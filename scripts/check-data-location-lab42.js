'use strict';
// Lab.42 · carpeta de datos e IAs que sobrevive a cada versión nueva del EXE (dataLocationLab42.js + bootstrap + panel).
const fs=require('fs'),path=require('path'),os=require('os');
const root=path.join(__dirname,'..'),src=f=>fs.readFileSync(path.join(root,'src',f),'utf8');
let checks=0;const ok=(c,m)=>{checks++;if(!c){console.error('check-data-location-lab42: '+m);process.exit(1);}};
const D=require('../src/services/dataLocationLab42.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-dl-'));
const appData=path.join(tmp,'AppData'),lab=b=>path.join(b,D.LAB_DIR_NAME),data=b=>path.join(lab(b),D.DATA_DIR_NAME);
function seed(base,{profiles=1,model=true}={}){const d=data(base);fs.mkdirSync(path.join(d,'models'),{recursive:true});if(model)fs.writeFileSync(path.join(d,'models','ia.gguf'),'x'.repeat(2048));
  fs.writeFileSync(path.join(d,'profiles.json'),JSON.stringify({activeProfileId:'p1',profiles:Array.from({length:profiles},(_,i)=>({id:'p'+(i+1),name:'Perfil '+(i+1)}))}));
  fs.mkdirSync(path.join(d,'tts-lab','qwen3tts','site-packages','torch'),{recursive:true});fs.writeFileSync(path.join(d,'tts-lab','qwen3tts','site-packages','torch','lib.dll'),'y'.repeat(4096));}
try{
  const A=path.join(tmp,'C','GEC'),B=path.join(tmp,'Descargas','artifact'),F=path.join(tmp,'D','GEC Datos');
  // 1) primera vez, sin nada: junto al EXE
  let r=D.resolveStartup({rawBase:A,appData,exeDir:A});
  ok(r.source==='local-new'&&r.labBase===lab(A),'primera vez: junto al EXE');
  ok(D.readPointer(appData).lastBase===lab(A),'anota la última carpeta usada');
  // 2) con datos junto al EXE: esos
  seed(A);r=D.resolveStartup({rawBase:A,appData,exeDir:A});ok(r.source==='local'&&r.labBase===lab(A),'usa los datos de junto al EXE');
  ok(D.hasData(lab(A))&&!D.hasData(lab(B)),'detecta si una carpeta tiene datos');
  // 3) versión nueva abierta desde Descargas, sin datos ahí: sigue con los de C:\GEC
  r=D.resolveStartup({rawBase:B,appData,exeDir:B});ok(r.source==='remembered'&&r.labBase===lab(A),'un EXE nuevo en otra carpeta sigue con la última carpeta con datos');
  ok(D.readPointer(appData).lastBase===lab(A),'la última sigue siendo C:\\GEC');
  // 4) si la carpeta nueva ya tiene sus propios datos, se respetan
  seed(B,{profiles:2});r=D.resolveStartup({rawBase:B,appData,exeDir:B});ok(r.source==='local'&&r.labBase===lab(B),'si la carpeta del EXE ya tiene datos, se usan esos');
  // 5) carpeta fija elegida en Ajustes: la usa cualquier EXE, aunque tenga datos propios
  D.writePointer(appData,{...D.readPointer(appData),fixed:true,fixedBase:lab(F)});
  r=D.resolveStartup({rawBase:B,appData,exeDir:B});ok(r.source==='fixed'&&r.labBase===lab(F)&&fs.existsSync(lab(F)),'carpeta fija: la usa cualquier versión y se crea si falta');
  // 6) reinicio controlado (variable de entorno) manda
  r=D.resolveStartup({rawBase:B,envBase:lab(A),appData,exeDir:B});ok(r.source==='env'&&r.labBase===lab(A),'en un reinicio se respeta la carpeta con la que se reinició');
  // 7) puntero roto o ausente: junto al EXE, sin error
  fs.writeFileSync(D.pointerPath(appData),'{roto');r=D.resolveStartup({rawBase:A,appData,exeDir:A});ok(r.labBase===lab(A),'puntero dañado: vuelve a junto al EXE');
  // 8) copia con progreso, sin pisar lo que ya está igual
  const G=path.join(tmp,'E','copia');let prog=[];
  (async()=>{
    const c1=await D.copyTree(lab(A),lab(G),p=>prog.push(p));
    ok(c1.files>=3&&c1.copied===c1.files&&D.hasData(lab(G)),'copia todos los datos');
    ok(prog.length&&prog[prog.length-1].done===c1.files&&prog[prog.length-1].bytes===c1.bytes,'informa el avance hasta el final');
    const c2=await D.copyTree(lab(A),lab(G));ok(c2.copied===0,'reanudar una copia no vuelve a copiar lo que ya está');
    // conexión
    const boot=src('bootstrap-v2lab.js');
    ok(/if\(app\.isPackaged\)\{[\s\S]*require\('\.\/services\/dataLocationLab42'\)\.resolveStartup\(/.test(boot)&&boot.indexOf('resolveStartup')<boot.indexOf("process.env.GEC_V2_TTS_LAB_ROOT=labBase"),'el arranque decide la carpeta antes de fijar las rutas');
    ok(/GEC_V2_EXE_DIR/.test(boot)&&/installDataLocationLab42\(\)/.test(boot),'recuerda la carpeta real del EXE e instala el IPC');
    const pre=src('preload.js');
    ok(/dataLocationSet:req=>invoke\('dataLocation:set',req\)/.test(pre)&&/'dataLocation:progress'/.test(pre)&&/renderer-data-location-lab42\.js/.test(pre),'preload expone la API, el evento y la tarjeta');
    const svc=src('services/dataLocationLab42.js');
    ok(/stopStrict\(true\)/.test(svc)&&/app\.relaunch\(\)/.test(svc)&&/process\.env\.GEC_V2_TTS_LAB_ROOT = labBase/.test(svc),'antes de cambiar se detiene todo y se reinicia con la carpeta nueva');
    const rd=src('renderer-data-location-lab42.js');
    ok(/Carpeta de datos e IAs/.test(rd)&&/gecDlOpen/.test(rd)&&/gecDlPick/.test(rd)&&/gecDlLocal/.test(rd),'tarjeta con abrir, elegir y volver a junto al EXE');
    fs.rmSync(tmp,{recursive:true,force:true});
    console.log(`check-data-location-lab42 OK (${checks} verificaciones) · arranque · última carpeta · fija · copia · panel`);
  })().catch(e=>{console.error('check-data-location-lab42: '+e.message);process.exit(1);});
}catch(e){fs.rmSync(tmp,{recursive:true,force:true});throw e;}
