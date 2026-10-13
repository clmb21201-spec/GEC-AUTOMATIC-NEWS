'use strict';
// Lab.43 · el perfil exportado lleva movimiento + sonidos, intervenciones (con logo y fondo) y horario (que se importa
// desactivado). Exporta con el ProfilePackage0329 real y lo importa en otra carpeta de datos.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const {getProfileManager}=require('../src/services/profileManager0329');
const {ProfilePackage0329,readPackage}=require('../src/services/profilePackage0329');
const X=require('../src/services/profileExtrasLab43');
const nm=require('../src/services/newsMotionLab37'),ch=require('../src/services/classicHostLab38');
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);},eq=(a,b,m)=>{checks++;assert.deepStrictEqual(a,b,m);};
const defaults={rssFeeds:[],ai:{primary:'local',backup1:'none',backup2:'none'},tts:{voice:'ef_dora',speed:1},visual:{queueColors:{},output:{}},canned:{},documents:{processed:{}},automation:{}};
const rj=f=>JSON.parse(fs.readFileSync(f,'utf8')),wj=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v));};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-lab43-'));
try{
  X.installProfileExtrasLab43();X.installProfileExtrasLab43();
  ok(ProfilePackage0329.prototype.__gecProfileExtrasLab43,'se instala una sola vez sobre ProfilePackage0329');
  const a=path.join(tmp,'a');fs.mkdirSync(a,{recursive:true});const m=getProfileManager(a);
  const p1=m.create({name:'Noticiero',color:'#F7C600',defaults}),p2=m.create({name:'Sin extras',color:'#00AAFF',defaults});
  const motion=nm.normalizeConfig({enabled:true,level:'custom',custom:{planes:{full:true,side:false,zoom:true,dato:true},minSec:7,transition:'fade'},ticker:{messages:['Síguenos'],every:3},sfx:{enabled:true,style:'marcado',volume:70,events:{sting:true,plane:true,dato:true,ex:true,card:false,host:true}}});
  wj(path.join(a,X.NM_FILE),{version:1,profiles:{[p1.id]:motion}});
  const chDir=path.join(a,'classic-host',p1.id);fs.mkdirSync(chDir,{recursive:true});
  const logo=path.join(chDir,'logo-111.png'),bg=path.join(chDir,'background-222.mp4');fs.writeFileSync(logo,Buffer.from('PNGDATA'));fs.writeFileSync(bg,Buffer.from('VIDEODATA'));
  const host=ch.normalizeConfig({enabled:true,program:'Mi programa',logo,background:{mode:'custom',file:bg},music:'none',phrases:{intro:['Hola desde {programa}']}});
  wj(path.join(a,X.CH_FILE),{version:1,profiles:{[p1.id]:host}});
  const slots=[{id:'f1',days:[1,2,3,4,5],prep:'05:30',emit:'06:00',until:'09:00',youtube:true}];
  wj(path.join(a,X.SCHED_FILE),{version:1,profiles:{[p1.id]:{enabled:true,slots}}});

  // exportar un perfil
  const pkgA=new ProfilePackage0329({manager:m,dataDir:a}),file=path.join(tmp,'noticiero.gecprofile');pkgA.exportProfile(p1.id,file);
  const P=readPackage(file),ex=P.extrasLab43;
  ok(ex&&ex.profiles[p1.id],'el paquete trae extrasLab43 del perfil');
  eq(ex.profiles[p1.id].newsMotion,motion,'movimiento y sonidos completos');
  eq(ex.profiles[p1.id].schedule,{enabled:true,slots},'horario con sus franjas');
  eq([ex.profiles[p1.id].classicHost.logo,ex.profiles[p1.id].classicHost.background.file],[X.ASSET_PREFIX+'logo-111.png',X.ASSET_PREFIX+'background-222.mp4'],'logo y fondo con ruta portable');
  ok(!JSON.stringify(ex).includes(tmp),'el paquete no lleva rutas de esta computadora');
  ok(P.resources.some(r=>r.path===`extras/${p1.id}/classic-host/logo-111.png`)&&P.resources.some(r=>r.path===`extras/${p1.id}/classic-host/background-222.mp4`),'logo y fondo van como recursos');
  const file2=path.join(tmp,'vacio.gecprofile');pkgA.exportProfile(p2.id,file2);ok(!readPackage(file2).extrasLab43,'un perfil sin extras no agrega nada');

  // importar en otra carpeta
  const b=path.join(tmp,'b');fs.mkdirSync(b,{recursive:true});const m2=getProfileManager(b),pkgB=new ProfilePackage0329({manager:m2,dataDir:b});
  const r=pkgB.importFile(file,'keep'),nid=r.imported[0];
  ok(r.ok&&nid,'importación correcta');
  eq(rj(path.join(b,X.NM_FILE)).profiles[nid],motion,'movimiento y sonidos repuestos con el id nuevo');
  const h=rj(path.join(b,X.CH_FILE)).profiles[nid];
  eq(h.program,'Mi programa','intervenciones repuestas');
  ok(h.logo.startsWith(path.join(b,'classic-host'))&&fs.readFileSync(h.logo,'utf8')==='PNGDATA','logo copiado a la carpeta del perfil nuevo');
  ok(h.background.mode==='custom'&&fs.readFileSync(h.background.file,'utf8')==='VIDEODATA','fondo propio copiado');
  eq(rj(path.join(b,X.SCHED_FILE)).profiles[nid],{enabled:false,slots:rj(path.join(b,X.SCHED_FILE)).profiles[nid].slots},'el horario llega desactivado');
  eq(rj(path.join(b,X.SCHED_FILE)).profiles[nid].slots.length,1,'con sus franjas');
  ok(r.extrasLab43&&r.extrasLab43.scheduleDisabled.includes(nid),'el resultado avisa que el horario quedó desactivado');

  // importar otra vez (mantener ambos): segundo perfil con su propia copia; y omitir no escribe nada
  const r2=pkgB.importFile(file,'keep'),nid2=r2.imported[0];
  ok(nid2&&nid2!==nid&&rj(path.join(b,X.CH_FILE)).profiles[nid2].logo.includes(nid2),'«mantener ambos» crea otra copia para el perfil nuevo');
  const before=fs.readFileSync(path.join(b,X.NM_FILE),'utf8');const r3=pkgB.importFile(file,'skip');
  ok(!r3.imported.length&&fs.readFileSync(path.join(b,X.NM_FILE),'utf8')===before,'«omitir» no toca nada');

  // logo que ya no existe: se exporta sin él y el fondo propio pasa a animado
  const c2=rj(path.join(a,X.CH_FILE));fs.rmSync(bg);wj(path.join(a,X.CH_FILE),c2);
  const file3=path.join(tmp,'sinfondo.gecprofile');pkgA.exportProfile(p1.id,file3);const e3=readPackage(file3).extrasLab43;
  ok(e3.profiles[p1.id].classicHost.background.mode==='anim'&&!e3.profiles[p1.id].classicHost.background.file&&e3.skipped.length===1,'fondo faltante: se avisa y queda la animación');

  // exportar todos
  const fileAll=path.join(tmp,'todo.gecpack');pkgA.exportAll(fileAll);const PA=readPackage(fileAll);
  ok(PA.extrasLab43&&PA.extrasLab43.profiles[p1.id]&&!PA.extrasLab43.profiles[p2.id],'«exportar todos» también los lleva');

  // un paquete viejo (sin extras) se importa igual
  const c=getProfileManager(path.join(tmp,'c'));fs.mkdirSync(path.join(tmp,'c'),{recursive:true});
  const r4=new ProfilePackage0329({manager:c,dataDir:path.join(tmp,'c')}).importFile(file2,'keep');
  ok(r4.ok&&!r4.extrasLab43&&!fs.existsSync(path.join(tmp,'c',X.NM_FILE)),'paquete sin extras: importación normal');

  const boot=fs.readFileSync(path.join(__dirname,'..','src','bootstrap-v2lab.js'),'utf8');
  ok(/profileExtrasLab43'\)\.installProfileExtrasLab43\(\)/.test(boot),'bootstrap instala Lab.43');
  console.log(`check-profile-extras-lab43 OK (${checks} verificaciones) · exportar · importar · horario desactivado · logo y fondo`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
