'use strict';
// Lab.38 · intervenciones de la vista clásica: configuración por perfil, comodines, próxima emisión, IPC y el flujo de
// presenterHost (main.js) en la clásica sin cambiar a Merlín; además, que todo quede conectado (preload, LAN, salida).
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm');
const root=path.join(__dirname,'..'),src=path.join(root,'src'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ch=require('../src/services/classicHostLab38');
let n=0;const ok=(c,m)=>{if(!c){console.error(`check-classic-host-lab38: ${m}`);process.exit(1);}n++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
// ---- configuración
const d=ch.normalizeConfig({});
ok(d.enabled&&d.versions.intro==='A'&&d.versions.desp==='B'&&d.segs.tit&&d.background.mode==='anim'&&d.music==='low','valores por defecto');
const c=ch.normalizeConfig({versions:{intro:'c',tit:'Z'},segs:{pase:false},titulares:{everyMin:7,count:9},background:{mode:'x'},music:'none',phrases:{pase:['Pausa, {hora}, ya volvemos.',''],intro:[]},closing:{social:[['IG','@a'],{label:'YT',value:'@b'},['x',''],['c','@c'],['d','@d']],nextMode:'text',nextText:'Mañana'}});
ok(c.versions.intro==='C'&&c.versions.tit==='A'&&c.segs.pase===false,'versiones y activación por intervención');
ok(c.titulares.everyMin===25&&c.titulares.count===3,'titulares: valores no permitidos vuelven al defecto');
ok(c.background.mode==='anim'&&c.music==='none','fondo y música');
ok(c.phrases.pase[0]==='Pausa, ya volvemos.','{hora} se quita fuera de Presentación y Despedida');
ok(c.phrases.intro.length===ch.DEFAULT_PHRASES.intro.length,'sin frases vuelven las de fábrica');
ok(c.closing.social.length===3&&c.closing.social[1][1]==='@b'&&c.closing.nextMode==='text','redes (hasta 3) y próxima emisión escrita');

// ---- comodines
ok(ch.horaWords(new Date(2026,9,13,20,10))==='son las ocho y diez de la noche','hora en palabras (noche)');
ok(ch.horaWords(new Date(2026,9,13,13,0))==='es la una en punto de la tarde','la una en punto');
ok(ch.horaWords(new Date(2026,9,13,12,30))==='son las doce y media del mediodía','mediodía y media');
ok(ch.horaWords(new Date(2026,9,13,7,21))==='son las siete y veintiuno de la mañana','veintiuno');
ok(ch.horaWords(new Date(2026,9,13,3,45))==='son las tres y cuarenta y cinco de la madrugada','madrugada');
const at=new Date(2026,9,13,20,10);
ok(ch.fill('{saludo}, esto es {programa}. {hora}.',{program:'Noticias al Día',date:at})==='Buenas noches, esto es Noticias al Día. son las ocho y diez de la noche.','fill con saludo, programa y hora');
ok(/^Martes 13 de octubre|^martes, 13 de octubre|13 de octubre/i.test(ch.fill('{dia}',{date:at})),'{dia}');
const cfgP=ch.normalizeConfig({program:'Noticias al Día',phrases:{intro:['{saludo}, esto es {programa}.','Hola a todos.','{saludo}, {hora}.']}});
ok(ch.phrasesNow(cfgP,'intro',at).join('|')==='Buenas noches, esto es Noticias al Día.|Hola a todos.','frases de ahora: sin {hora}');
ok(ch.phrasesAll(cfgP,'intro',at).length===4,'se generan los tres saludos y la frase fija');
ok(ch.dynamicPhrase(cfgP,'intro',()=>.99)!==null&&ch.dynamicPhrase(cfgP,'intro',()=>0)===null&&ch.dynamicPhrase(cfgP,'pase',()=>.99)===null,'frase con {hora} solo en Presentación y Despedida');
// próxima emisión
const now=new Date(2026,9,13,9,0).getTime();
ok(ch.nextEmission(d,{schedule:{engine:{snapshot:()=>({next:{emitAt:new Date(2026,9,13,18,0).getTime()}})}},now})==='Hoy · 6:00 PM','próxima emisión del Horario: hoy');
ok(ch.nextEmission(d,{schedule:{engine:{snapshot:()=>({next:{emitAt:new Date(2026,9,14,7,5).getTime()}})}},now})==='Mañana · 7:05 AM','próxima emisión del Horario: mañana');
ok(ch.nextEmission(d,{schedule:{engine:{snapshot:()=>({next:null})}},now})==='','sin franjas no se muestra');
ok(ch.nextEmission(c,{now})==='Mañana'&&ch.nextEmission(ch.normalizeConfig({closing:{nextMode:'none'}}),{now})==='','escrita o no mostrar');

// ---- instalación: IPC por perfil, archivos propios del perfil
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-ch-'));const handlers={};let refreshed=0;
global.__gecClassicHost=null;global.__gecClassicHostRefresh=()=>refreshed++;global.__gecPresenterHost={ensureClips:async()=>{},speak:async t=>({file:path.join(tmp,'x.wav'),t})};
fs.writeFileSync(path.join(tmp,'logo.png'),Buffer.from('89504e470d0a1a0a','hex'));
const inst=ch.installClassicHostLab38({api:{dataDir:()=>tmp,log:()=>{}},electron:{ipcMain:{removeHandler(){},handle:(k,fn)=>handlers[k]=fn},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[path.join(tmp,'logo.png')]})}}});
ok(inst&&['classicHost:get','classicHost:set','classicHost:pickLogo','classicHost:pickBackground','classicHost:clearAsset','classicHost:speak'].every(k=>handlers[k]),'IPC classicHost:*');
let r=await handlers['classicHost:set']({}, {program:'Noticias al Día',versions:{reg:'C'},logo:'C:/no/debe/pasar.png'});
ok(r.ok&&r.config.program==='Noticias al Día'&&r.config.versions.reg==='C'&&r.config.logo===''&&refreshed===1,'guardar: el logo solo entra por "Subir logo…"');
r=await handlers['classicHost:pickLogo']();
ok(r.ok&&r.config.logo&&r.config.logo.startsWith(path.join(tmp,'classic-host'))&&fs.existsSync(r.config.logo)&&r.logoUrl.startsWith('file:'),'el logo se copia a la carpeta del perfil');
r=await handlers['classicHost:clearAsset']({}, 'logo');ok(r.ok&&r.config.logo===''&&!fs.readdirSync(path.join(tmp,'classic-host','default')).length,'quitar el logo borra la copia');
const all=JSON.parse(fs.readFileSync(path.join(tmp,'classic-host.json'),'utf8'));ok(all.profiles&&all.profiles.default&&all.profiles.default.versions.reg==='C','guardado por perfil');
r=await handlers['classicHost:speak']({}, '{programa} te saluda');ok(r.ok&&r.text==='Noticias al Día te saluda','Escuchar genera la frase con los comodines');
const rd=inst.renderData();ok(rd.program==='Noticias al Día'&&rd.versions.reg==='C'&&rd.background.mode==='anim'&&rd.closing.big,'datos para la salida');
ok(inst.segOn('regreso')&&inst.segOn('titulares')&&inst.titulares().everyMin===25,'segOn / titulares');

// ---- presenterHost en la vista clásica (mismo bloque de main.js que Merlín)
const main=fs.readFileSync(path.join(src,'main.js'),'utf8'),a=main.indexOf('// ---- Presentador Merlín: intervenciones'),b=main.indexOf('// ---- Merlín: volumen normalizado');
ok(a>0&&b>a,'bloque presenterHost');
const block=main.slice(a,b);
function wav(file,sec){const rate=24000,len=Math.round(rate*sec),data=Buffer.alloc(len*2);for(let i=0;i<len;i++)data.writeInt16LE(Math.round(Math.sin(2*Math.PI*220*i/rate)*.3*32767),i*2);
  const h=Buffer.alloc(44);h.write('RIFF',0,'ascii');h.writeUInt32LE(36+data.length,4);h.write('WAVE',8,'ascii');h.write('fmt ',12,'ascii');h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36,'ascii');h.writeUInt32LE(data.length,40);fs.writeFileSync(file,Buffer.concat([h,data]));return file;}
function load({mode='clasico',classic=inst,genDelay=0}={}){
  const log=[],on={},dir=fs.mkdtempSync(path.join(os.tmpdir(),'gec-chh-'));let k=0;const sent=[];
  const automation={queue:[{status:'LISTA',result:{title:'Próxima noticia',category:'POLÍTICA'},image:'file:///i.jpg'}],currentKind:'none',state(){},stopEmission(){ctx.controlOutput('stop');return true;},startEmission(){return true;}};
  const ctx={__dirname:src,require,console,setTimeout,clearTimeout,setInterval,clearInterval,Buffer,Date,Math,JSON,Promise,fs,path,dataDir:dir,portableDataDir:()=>dir,
    app:{whenReady:()=>new Promise(()=>{}),getPath:()=>dir},ipcMain:{on:(ch2,fn)=>{(on[ch2]=on[ch2]||[]).push(fn);},handle(){}},logEvent:()=>{},
    readPresenter:()=>({mode}),currentDesign:()=>({format:'16:9'}),settingsStore:{load:()=>({tts:{voice:'v',speed:1}})},
    kokoro:{generate:async text=>{if(genDelay)await sleep(genDelay);sent.push(text);return{path:wav(path.join(dir,`t${++k}.wav`),1),durationSec:1};},cleanupAudio(){}},
    pronunciation:null,automation,currentOutputProgram:{durationSec:30,currentSec:10},__gecClassicHost:classic,
    deliverToOutput(p){log.push(p.kind==='host'?`HOST:${p.segment}`:p.kind);ctx.last=p;return true;},controlOutput(x){log.push(String(x).toUpperCase());return true;}};
  vm.createContext(ctx);vm.runInContext(block+';this.presenterHost=presenterHost;',ctx);
  const emit=(c2,ev)=>(on[c2]||[]).forEach(fn=>fn({},ev));
  return{ctx,log,sent,automation,host:ctx.presenterHost,ended:()=>emit('presenter:hostPlayback',{type:'ended'}),outEnded:()=>emit('output:playback',{type:'ended'})};
}
const news=()=>({kind:'news',title:'Noticia',category:'DEPORTES',image:'file:///n.jpg'}),canned=()=>({kind:'canned',title:'Lima en 360.mp4',videoUrl:'file:///v.mp4'});
await handlers['classicHost:set']({}, {program:'Noticias al Día',phrases:{intro:['{saludo}, esto es {programa}.'],despedida:['Gracias por vernos.']}});
{const t=load();ok(t.host.classicOn()&&t.host.hostActive(),'con el perfil activado, la clásica interviene');await t.host.ensureClips();
  const send=p=>t.ctx.deliverToOutput(p,'automatic',false);
  for(const p of [news(),news(),canned(),news()]){send(p);if(t.log[t.log.length-1].startsWith('HOST:'))t.ended();}
  ok(t.log.join(',')==='HOST:intro,news,news,HOST:pase,canned,HOST:regreso,news',`orden en la clásica: ${t.log.join(',')}`);
  ok(t.sent.some(x=>/esto es Noticias al Día\./.test(x))&&!t.sent.some(x=>/\{/.test(x)),'genera las frases del perfil con los comodines resueltos');
  const hosts=[];t.ctx.deliverToOutput=function(p){if(p.kind==='host')hosts.push(p);t.log.push(p.kind==='host'?`HOST:${p.segment}`:p.kind);return true;};
}
{const t=load();await t.host.ensureClips();const got=[];const orig=t.ctx.deliverToOutput;
  // capturar los payloads que llegan a la salida (el envoltorio usa la función original guardada al cargar)
  const send=p=>t.ctx.deliverToOutput(p,'automatic',false);send(news());const intro=t.ctx.last;
  ok(intro.kind==='host'&&intro.hostFlavor==='clasica'&&Array.isArray(intro.upcoming)&&intro.upcoming[0].title==='Próxima noticia'&&'nextEmission' in intro,'la intervención clásica lleva datos para la placa');
  t.ended();send(news());send(canned());const pase=t.ctx.last;ok(pase.segment==='pase'&&pase.next&&pase.next.title==='Lima en 360.mp4'&&pase.next.videoUrl==='file:///v.mp4','el pase sabe qué contenido viene');
  t.ended();send(news());const reg=t.ctx.last;ok(reg.segment==='regreso'&&reg.next&&reg.next.title==='Noticia'&&reg.next.category==='DEPORTES','el regreso sabe qué noticia viene');}
// detener: despedida y stop
{const t=load();await t.host.ensureClips();const send=p=>t.ctx.deliverToOutput(p,'automatic',false);
  send(news());t.ended();t.automation.currentKind='news';t.log.length=0;t.automation.stopEmission();t.outEnded();
  ok(t.log.join(',')==='HOST:despedida','Detener: despedida al terminar la noticia');t.ended();ok(t.log.join(',')==='HOST:despedida,STOP','y luego stop');}
// intervención desactivada en el perfil
await handlers['classicHost:set']({}, {program:'Noticias al Día',segs:{pase:false},phrases:{intro:['{saludo}, esto es {programa}.']}});
{const t=load();await t.host.ensureClips();const send=p=>t.ctx.deliverToOutput(p,'automatic',false);
  for(const p of [news(),canned(),news()]){send(p);if(t.log[t.log.length-1].startsWith('HOST:'))t.ended();}
  ok(t.log.join(',')==='HOST:intro,news,canned,HOST:regreso,news',`sin pase si está desactivado: ${t.log.join(',')}`);}
// {hora}: se genera en el momento; si tarda demasiado, se sigue sin esa frase
await handlers['classicHost:set']({}, {program:'Noticias al Día',phrases:{intro:['{saludo}, {hora}. Esto es {programa}.']}});
{const t=load();await t.host.ensureClips();const send=p=>t.ctx.deliverToOutput(p,'automatic',false);
  ok(send(news())===true&&t.log.length===0,'con {hora} la intervención se arma en el momento');
  await sleep(60);ok(t.log[0]==='HOST:intro'&&/son las|es la una/.test(t.ctx.last.hostText),`la frase dice la hora: ${t.ctx.last?.hostText}`);t.ended();ok(t.log.join(',')==='HOST:intro,news','después sigue la noticia');}
// clásica desactivada: sin intervenciones
await handlers['classicHost:set']({}, {enabled:false});
{const t=load();ok(!t.host.hostActive(),'perfil sin intervenciones: no interviene');const send=p=>t.ctx.deliverToOutput(p,'automatic',false);send(news());ok(t.log.join(',')==='news','la noticia sale directo');}
// Merlín conserva sus frases
await handlers['classicHost:set']({}, {enabled:true,phrases:{intro:['FRASE CLASICA']}});
{const t=load({mode:'merlin'});ok(!t.host.classicOn()&&t.host.hostActive(),'en Merlín no se usa la clásica');await t.host.ensureClips();
  ok(!t.sent.includes('FRASE CLASICA')&&t.sent.length>0,'Merlín genera solo sus frases');const send=p=>t.ctx.deliverToOutput(p,'automatic',false);send(news());ok(t.ctx.last.kind==='host'&&!t.ctx.last.hostFlavor,'la intervención de Merlín no lleva datos de la clásica');}
fs.rmSync(tmp,{recursive:true,force:true});global.__gecClassicHost=null;

// ---- conexiones
const m=read('src/main.js'),pre=read('src/preload.js'),lan=read('src/services/outputLanServer.js'),web=read('src/output-web.html'),boot=read('src/bootstrap-v2lab.js'),css=read('src/output-classic-host-lab38.css');
ok(/const active=\(\)=>\{try\{return readPresenter\(\)\.mode==='merlin'&&\(currentDesign\?\.\(\)\|\|\{\}\)\.format!=='9:16'&&merlinPage\(\);/.test(m),'active() de Merlín sin cambios');
ok(m.includes("const hostActive=()=>active()||classicOn();")&&m.includes('globalThis.__gecPresenterHost=')&&m.includes('d.classicHost=c'),'main.js: clásica en presenterHost, diseño y voz para el panel');
ok(/installNewsMotionLab37\(\);\s*require\('\.\/services\/classicHostLab38'\)\.installClassicHostLab38\(\);/.test(boot),'bootstrap instala Lab.38');
ok(['output-classic-host-lab38.css','output-classic-host-render-lab38.js','output-classic-host-lab38.js'].every(f=>pre.includes(f)&&lan.includes(`'${f}'`)&&web.includes(f)),'salida, LAN y output-web cargan Lab.38');
ok(pre.indexOf('output-classic-host-render-lab38.js')<pre.indexOf("src:'output-classic-host-lab38.js'"),'el motor se carga antes que la salida');
ok(pre.includes("classicHostGet:()=>invoke('classicHost:get')")&&pre.includes("injectAsset('script',{src:'renderer-classic-host-lab38.js'})"),'preload: API y panel');
ok(/'schedule:state'\]\);/.test(pre),'preload: schedule:state sigue al final');
ok(lan.includes('if(d.classicHost)')&&lan.includes("for(const k of ['headlines','upcoming'])"),'LAN: logo, fondo e imágenes de la placa se sirven por la red');
ok(!/(^|[^-\w])\.stage\b/m.test(css.replace(/#stage/g,''))&&!/@keyframes (?!ch)/.test(css),'CSS aislado: sin .stage y animaciones con prefijo ch');
ok(!/max-width:400px/.test(css),'sin el tamaño de la página de la maqueta');
const out=read('src/output-classic-host-lab38.js');
ok(out.includes('presenterHostPlayback')&&!/outputPlayback\(/.test(out),'la salida avisa el fin de la intervención a presenterHost, no como noticia');
ok(!read('src/output.html').includes('classic-host')&&!read('src/output.js').includes('chLayer'),'no se modifica la salida clásica original');
ok(fs.existsSync(path.join(src,'output-classic-host-preview.html')),'vista previa del panel');
console.log(`check-classic-host-lab38 OK (${n} verificaciones)`);
})().catch(e=>{console.error('check-classic-host-lab38:',e);process.exit(1);});
