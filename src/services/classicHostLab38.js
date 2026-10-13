'use strict';
// Lab.38 · Intervenciones en la vista clásica, por perfil: presentación, titulares, pase a corte, regreso y despedida.
// Usa la misma lógica de presenterHost (main.js) que Merlín —cuándo se presenta, pasa a corte, regresa, da titulares y
// se despide al detener—, pero con las frases, la versión gráfica (A/B/C), el logo, el fondo y los datos de cierre de
// cada perfil. Merlín conserva sus frases (assets/merlin/presenter-phrases.json).
// Configuración en classic-host.json (carpeta de datos, profiles[id]); el logo y el fondo propio se copian a
// classic-host/<perfil>/. Comodines de las frases: {saludo}, {programa}, {dia} y {hora} (solo en Presentación y
// Despedida: «son las ocho y diez de la noche»; esa frase se genera en el momento).
// IPC classicHost:get|set|pickLogo|pickBackground|clearAsset|speak.
const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');

const FILE='classic-host.json';
const SEGS=['intro','tit','pase','reg','desp'];
const PHRASE_KEYS=['intro','titulares_intro','pase','regreso','despedida'];
const DEFAULT_PHRASES={
  intro:['{saludo}, esto es {programa}. Estas son las noticias del momento.','{saludo}. Empieza {programa}, con lo más importante del día.','{saludo}, {hora}. Esto es {programa}.'],
  titulares_intro:['Estos son los titulares de esta hora.','Repasamos los titulares.'],
  pase:['Hacemos una pausa. Ya volvemos.','No se vaya, regresamos enseguida.'],
  regreso:['Seguimos en {programa}. Vamos con más noticias.','Estamos de vuelta. Continuamos con la información.'],
  despedida:['Esto fue {programa}. Gracias por acompañarnos, hasta pronto.']
};
const DEFAULT={enabled:true,program:'',
  segs:{intro:true,tit:true,pase:true,reg:true,desp:true},
  versions:{intro:'A',tit:'A',pase:'A',reg:'A',desp:'B'},
  titulares:{everyMin:25,count:3},
  phrases:DEFAULT_PHRASES,
  closing:{big:'Hasta pronto',thanks:'Gracias por acompañarnos',social:[],nextMode:'schedule',nextText:''},
  background:{mode:'anim',file:''},music:'low',logo:''};

const clone=v=>JSON.parse(JSON.stringify(v));
const str=(v,max=140)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
function normalizeConfig(raw={}){
  const r=raw&&typeof raw==='object'?raw:{},out=clone(DEFAULT);
  out.enabled=r.enabled!==false;out.program=str(r.program,60);
  for(const s of SEGS){if(r.segs&&r.segs[s]!=null)out.segs[s]=r.segs[s]!==false;const v=String(r.versions?.[s]||'').toUpperCase();if(['A','B','C'].includes(v))out.versions[s]=v;}
  const ev=Number(r.titulares?.everyMin),cn=Number(r.titulares?.count);
  out.titulares.everyMin=[15,20,25,30,45,60].includes(ev)?ev:25;out.titulares.count=[3,4,5].includes(cn)?cn:3;
  if(r.phrases&&typeof r.phrases==='object')for(const k of PHRASE_KEYS){const list=(Array.isArray(r.phrases[k])?r.phrases[k]:[]).map(x=>str(x,240)).filter(Boolean).slice(0,8);
    // {hora} se dice solo en Presentación y Despedida (se genera en el momento); en las demás se quita
    out.phrases[k]=list.length?(k==='intro'||k==='despedida'?list:list.map(x=>x.replace(/\s*,?\s*\{hora\}/g,'').replace(/^\s*,\s*/,'').replace(/\s+([,.])/g,'$1').replace(/\s+/g,' ').trim()).filter(Boolean)):DEFAULT_PHRASES[k].slice();}
  const c=r.closing||{};out.closing.big=str(c.big??out.closing.big,40);out.closing.thanks=str(c.thanks??out.closing.thanks,60);
  out.closing.social=(Array.isArray(c.social)?c.social:[]).map(x=>Array.isArray(x)?[str(x[0],24),str(x[1],60)]:[str(x?.label,24),str(x?.value,60)]).filter(x=>x[1]).slice(0,3);
  out.closing.nextMode=c.nextMode==='text'?'text':c.nextMode==='none'?'none':'schedule';out.closing.nextText=str(c.nextText,40);
  const b=r.background||{};out.background.mode=['standby','anim','custom'].includes(b.mode)?b.mode:'anim';out.background.file=str(b.file,400);
  out.music=r.music==='none'?'none':'low';out.logo=str(r.logo,400);
  return out;
}

// ---------------------------------------------------------------- comodines
const UN=['cero','una','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
const TENS={3:'treinta',4:'cuarenta',5:'cincuenta'};
const numWords=n=>n<30?UN[n]:TENS[Math.floor(n/10)]+(n%10?` y ${n%10===1?'uno':UN[n%10]}`:'');
function horaWords(d=new Date()){
  const h24=d.getHours(),m=d.getMinutes(),h=h24%12||12;
  const part=h24<6?'de la madrugada':h24<12?'de la mañana':h24===12?'del mediodía':h24<19?'de la tarde':'de la noche';
  const mins=m===0?'en punto':m===15?'y cuarto':m===30?'y media':`y ${numWords(m)}`;
  return`${h===1?'es la una':`son las ${numWords(h)}`} ${mins} ${part}`;
}
const saludo=(d=new Date())=>{const h=d.getHours();return h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';};
const SALUDOS=['Buenos días','Buenas tardes','Buenas noches'];
function diaText(d=new Date()){return d.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'});}
function fill(text,{program='',date=new Date(),greet=null}={}){
  return String(text||'').replace(/\{saludo\}/g,greet||saludo(date)).replace(/\{programa\}/g,program||'el noticiero').replace(/\{dia\}/g,diaText(date)).replace(/\{hora\}/g,horaWords(date))
    .replace(/^\s*([a-záéíóúñ])/,(_,c)=>c.toUpperCase()).replace(/\s+/g,' ').trim();
}
const isDynamic=t=>/\{hora\}/.test(String(t||''));
const keyOf=seg=>({intro:'intro',titulares:'titulares_intro',titulares_intro:'titulares_intro',pase:'pase',regreso:'regreso',reg:'regreso',despedida:'despedida',desp:'despedida'}[seg]||seg);
// frases para elegir ahora (sin {hora}: esas van por dynamicPhrase)
function phrasesNow(cfg,key,date=new Date()){return(cfg.phrases[keyOf(key)]||[]).filter(t=>!isDynamic(t)).map(t=>fill(t,{program:cfg.program,date}));}
// todas las variantes a generar con anticipación: cada saludo y el día de hoy
function phrasesAll(cfg,key,date=new Date()){const out=new Set();for(const t of cfg.phrases[keyOf(key)]||[]){if(isDynamic(t))continue;if(/\{saludo\}/.test(t))for(const g of SALUDOS)out.add(fill(t,{program:cfg.program,date,greet:g}));else out.add(fill(t,{program:cfg.program,date}));}return[...out];}
// Presentación y Despedida: si se elige una frase con {hora}, se devuelve completa para generarla en el momento
function dynamicPhrase(cfg,key,rand=Math.random){const k=keyOf(key);if(k!=='intro'&&k!=='despedida')return null;const list=cfg.phrases[k]||[];if(!list.length)return null;const t=list[Math.floor(rand()*list.length)];return isDynamic(t)?fill(t,{program:cfg.program}):null;}
const segKey=seg=>({intro:'intro',titulares:'tit',pase:'pase',regreso:'reg',despedida:'desp'}[seg]||seg);

// ---------------------------------------------------------------- próxima emisión (Horario automático)
function nextEmission(cfg,{schedule=global.__gecScheduleLab33,now=Date.now()}={}){
  if(cfg.closing.nextMode==='none')return'';if(cfg.closing.nextMode==='text')return cfg.closing.nextText;
  try{const n=schedule?.engine?.snapshot?.()?.next;if(!n)return'';const at=n.emitAt??n.start,d=new Date(at),day=new Date(now);day.setHours(0,0,0,0);const dd=new Date(at);dd.setHours(0,0,0,0);
    const diff=Math.round((dd-day)/86400000),label=diff===0?'Hoy':diff===1?'Mañana':cap(d.toLocaleDateString('es-PE',{weekday:'long'}));let h=d.getHours();const m=String(d.getMinutes()).padStart(2,'0'),ap=h>=12?'PM':'AM';h=h%12||12;return`${label} · ${h}:${m} ${ap}`;}catch{return'';}
}
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;

// ---------------------------------------------------------------- datos para la salida (design.classicHost)
const url=f=>{try{return f&&fs.existsSync(f)?pathToFileURL(f).href:'';}catch{return'';}};
function renderData(cfg){
  return{enabled:cfg.enabled,program:cfg.program,versions:{...cfg.versions},segs:{...cfg.segs},logoUrl:url(cfg.logo),
    background:{mode:cfg.background.mode,url:cfg.background.mode==='custom'?url(cfg.background.file):'',video:/\.(mp4|webm|mov|m4v)$/i.test(cfg.background.file||'')},
    music:cfg.music,closing:{big:cfg.closing.big,thanks:cfg.closing.thanks,social:cfg.closing.social}};
}

// ---------------------------------------------------------------- instalación (main)
function profileId(dataDir){try{const {getProfileManager}=require('./profileManager0329');return String(getProfileManager(dataDir).activeId?.()||'default');}catch{return'default';}}
function profileName(dataDir){try{const {getProfileManager}=require('./profileManager0329');return String(getProfileManager(dataDir).active?.()?.name||'').trim();}catch{return'';}}
function readJson(f,fb){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return fb;}}
function writeJson(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});const t=`${f}.tmp-${process.pid}`;fs.writeFileSync(t,JSON.stringify(v,null,2),'utf8');fs.renameSync(t,f);}
const safeId=id=>String(id||'default').replace(/[^a-z0-9_-]+/gi,'_').slice(0,60)||'default';

function installClassicHostLab38({api=globalThis.__gecScheduleApi,electron=null}={}){
  if(!api)return null;if(global.__gecClassicHost)return global.__gecClassicHost;
  const {ipcMain,dialog}=electron||require('electron');
  const file=()=>path.join(api.dataDir(),FILE),pid=()=>profileId(api.dataDir()),assetDir=()=>path.join(api.dataDir(),'classic-host',safeId(pid()));
  const readAll=()=>{const v=readJson(file(),{});return v&&typeof v==='object'&&v.profiles&&typeof v.profiles==='object'?v:{version:1,profiles:{}};};
  // sin nombre de programa se usa el nombre del perfil (para que la voz no diga «el noticiero»)
  const config=()=>{const c=normalizeConfig(readAll().profiles[pid()]||{});if(!c.program)c.program=str(profileName(api.dataDir()),60);return c;};
  const log=(k,m)=>{try{api.log?.(k,m);}catch{}};
  const save=cfg=>{const all=readAll();all.profiles[pid()]=normalizeConfig(cfg);writeJson(file(),all);try{global.__gecClassicHostRefresh?.();}catch{}return all.profiles[pid()];};
  const view=()=>{const c=config();return{ok:true,profile:pid(),profileName:str(profileName(api.dataDir()),60),config:c,logoUrl:url(c.logo),backgroundUrl:url(c.background.file),nextEmission:nextEmission(c)};};
  function copyAsset(src,kind){
    const ext=path.extname(src).toLowerCase(),okLogo=['.png','.jpg','.jpeg','.webp','.svg'],okBg=['.png','.jpg','.jpeg','.webp','.mp4','.webm','.mov','.m4v'];
    if(!(kind==='logo'?okLogo:okBg).includes(ext))throw new Error('Formato no admitido.');
    const st=fs.statSync(src);if(st.size>(kind==='logo'?10:400)*1024*1024)throw new Error('El archivo es demasiado grande.');
    fs.mkdirSync(assetDir(),{recursive:true});
    for(const f of fs.readdirSync(assetDir()))if(f.startsWith(kind+'-'))try{fs.rmSync(path.join(assetDir(),f),{force:true});}catch{}
    const dest=path.join(assetDir(),`${kind}-${Date.now()}${ext}`);fs.copyFileSync(src,dest);return dest;
  }
  const handle=(k,fn)=>{try{ipcMain.removeHandler(k);}catch{}ipcMain.handle(k,fn);};
  handle('classicHost:get',()=>view());
  handle('classicHost:set',(_e,inc={})=>{try{const cur=config(),next={...inc,logo:cur.logo,background:{...(inc.background||{}),file:cur.background.file}};save(next);global.__gecPresenterHost?.ensureClips?.().catch?.(()=>{});return view();}catch(e){return{ok:false,error:String(e.message||e)};}});
  const pick=async(kind)=>{
    const filters=kind==='logo'?[{name:'Logo',extensions:['png','jpg','jpeg','webp','svg']}]:[{name:'Imagen o video',extensions:['png','jpg','jpeg','webp','mp4','webm','mov','m4v']}];
    const r=await dialog.showOpenDialog({title:kind==='logo'?'Logo del programa':'Fondo de las intervenciones',properties:['openFile'],filters});
    if(r.canceled||!r.filePaths?.[0])return{ok:false,canceled:true};
    try{const dest=copyAsset(r.filePaths[0],kind),cur=config();if(kind==='logo')cur.logo=dest;else{cur.background.file=dest;cur.background.mode='custom';}save(cur);return view();}
    catch(e){return{ok:false,error:String(e.message||e)};}
  };
  handle('classicHost:pickLogo',()=>pick('logo'));
  handle('classicHost:pickBackground',()=>pick('background'));
  handle('classicHost:clearAsset',(_e,kind)=>{const cur=config();const f=kind==='logo'?cur.logo:cur.background.file;try{if(f&&f.startsWith(assetDir()))fs.rmSync(f,{force:true});}catch{}if(kind==='logo')cur.logo='';else{cur.background.file='';if(cur.background.mode==='custom')cur.background.mode='anim';}save(cur);return view();});
  // Escuchar: genera la frase con la voz del perfil (comodines con la hora actual) y devuelve el audio
  handle('classicHost:speak',async(_e,text)=>{try{const c=config(),t=fill(text,{program:c.program});const r=await global.__gecPresenterHost?.speak?.(t);return r?.file?{ok:true,url:url(r.file),text:t}:{ok:false,error:'La voz no está lista.'};}catch(e){return{ok:false,error:String(e.message||e)};}});
  global.__gecClassicHost={config,profileId:pid,renderData:()=>renderData(config()),
    phrasesNow:key=>phrasesNow(config(),key),phrasesAll:key=>phrasesAll(config(),key),dynamicPhrase:key=>dynamicPhrase(config(),key),
    segOn:seg=>{const c=config();return c.enabled&&c.segs[segKey(seg)]!==false;},titulares:()=>{const c=config();return c.segs.tit?{everyMin:c.titulares.everyMin,count:c.titulares.count}:{everyMin:0,count:c.titulares.count};},
    nextEmission:()=>nextEmission(config()),log};
  return global.__gecClassicHost;
}

module.exports={installClassicHostLab38,normalizeConfig,horaWords,numWords,fill,phrasesNow,phrasesAll,dynamicPhrase,nextEmission,renderData,isDynamic,keyOf,segKey,DEFAULT,DEFAULT_PHRASES};
