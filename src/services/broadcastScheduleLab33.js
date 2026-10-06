'use strict';
// Lab.33 · Horario automático de Preparación, Emisión y transmisión a YouTube (vía OBS).
// - Franjas por perfil en data/broadcast-schedule.json: días (lunes primero), "preparar", "emitir" (vacío = manual) y
//   "hasta" (vacío = sin corte) en 24 h; YouTube por franja. El panel las muestra en AM/PM.
// - Cada 20 s: al entrar en la franja inicia la Preparación; 60 s antes de emitir le pide a OBS que transmita; a la hora
//   de emitir abre la salida e inicia la Emisión (si no hay noticias listas, espera hasta 10 min y avisa); en "hasta"
//   detiene la Emisión (Merlín se despide), espera a que termine y corta OBS y la Preparación.
// - Cada acción se ejecuta una sola vez por franja: si el operador pausa o detiene algo a mano, el horario lo respeta.
//   Si GEC se abre en medio de una franja, entra en ella.
// - OBS (misma PC por defecto, ws://127.0.0.1:4455): data/obs-websocket.json, contraseña cifrada con safeStorage.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {ipcMain,safeStorage}=require('electron');
const obs=require('./obsWebSocketLab33');

const SCHEDULE_FILE='broadcast-schedule.json',OBS_FILE='obs-websocket.json';
const TICK_MS=20000,OBS_LEAD_MS=60000,WAIT_READY_MS=10*60000,CLOSE_TIMEOUT_MS=6*60000,STREAM_TAIL_MS=8000,KEEP_PREP_MS=60*60000;
const DAY_MS=86400000,DAYS=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

// ---------------------------------------------------------------- franjas (puras, probadas en el check)
const toMin=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return null;const h=+m[1],mi=+m[2];return h<24&&mi<60?h*60+mi:null;};
function normalizeSlot(s={},i=0){
  const days=Array.from({length:7},(_,k)=>!!(Array.isArray(s.days)&&s.days[k]));
  const fix=t=>{const m=toMin(t);return m==null?'':`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;};
  let prep=fix(s.prep),emit=fix(s.emit);const until=fix(s.until);if(!prep)prep=emit;
  return{id:String(s.id||`f${i+1}`),days,prep,emit,until,youtube:!!s.youtube&&!!emit};
}
function normalizeSchedule(c={}){return{enabled:c.enabled!==false&&Array.isArray(c.slots)&&c.slots.length>0,slots:(Array.isArray(c.slots)?c.slots:[]).slice(0,14).map(normalizeSlot).filter(s=>s.prep)};}
const dayStart=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x;};
const monIdx=d=>(new Date(d).getDay()+6)%7;
const at=(base,min)=>{const x=new Date(base);x.setHours(0,0,0,0);x.setMinutes(min);return x.getTime();};
// instancia de una franja que empieza el día `day`: prep ≤ emit ≤ fin (si una hora es menor que la anterior, es del día siguiente)
function instanceOn(slot,day){
  if(!slot.days[monIdx(day)])return null;
  const start=at(day,toMin(slot.prep));let emitAt=slot.emit?at(day,toMin(slot.emit)):null;if(emitAt!=null&&emitAt<start)emitAt+=DAY_MS;
  const ref=emitAt??start;let end=slot.until?at(day,toMin(slot.until)):null;if(end!=null)while(end<=ref)end+=DAY_MS;
  return{id:`${slot.id}@${dayStart(day).toISOString().slice(0,10)}`,slot,start,emitAt,end,openEnd:end==null,youtube:slot.youtube};
}
function instancesAround(slots,now){const out=[];for(let k=-1;k<=7;k++){const d=new Date(now+k*DAY_MS);for(const s of slots){const i=instanceOn(s,d);if(i)out.push(i);}}return out.sort((a,b)=>a.start-b.start);}
const endOf=i=>i.end??(i.start+DAY_MS);
function activeInstance(slots,now){return instancesAround(slots,now).find(i=>i.start<=now&&now<endOf(i))||null;}
function nextInstance(slots,now){return instancesAround(slots,now).find(i=>i.start>now)||null;}
// franjas que se pisan (mismo rango de tiempo en algún día)
function overlaps(slots){const list=[];const all=instancesAround(slots,Date.now());for(let a=0;a<all.length;a++)for(let b=a+1;b<all.length;b++){const x=all[a],y=all[b];if(x.slot.id!==y.slot.id&&x.start<endOf(y)&&y.start<endOf(x))list.push([x.slot.id,y.slot.id]);}return[...new Set(list.map(p=>p.sort().join('|')))].map(s=>s.split('|'));}
function validate(cfg){const errors=[];cfg.slots.forEach((s,i)=>{if(!s.days.some(Boolean))errors.push(`Franja ${i+1}: marca al menos un día.`);if(!s.prep)errors.push(`Franja ${i+1}: falta la hora de preparar.`);if(s.emit&&s.prep){const p=toMin(s.prep),e=toMin(s.emit),diff=(e-p+1440)%1440;if(diff>720)errors.push(`Franja ${i+1}: "Preparar" debe ser antes de "Emitir".`);}});
  for(const [a,b] of overlaps(cfg.slots)){const ia=cfg.slots.findIndex(s=>s.id===a)+1,ib=cfg.slots.findIndex(s=>s.id===b)+1;errors.push(`Las franjas ${ia} y ${ib} se superponen.`);}return errors;}
const fmt12=ms=>{const d=new Date(ms);let h=d.getHours();const m=String(d.getMinutes()).padStart(2,'0'),ap=h>=12?'PM':'AM';h=h%12||12;return`${h}:${m} ${ap}`;};
function dayLabel(ms,now){const d=dayStart(ms).getTime(),t=dayStart(now).getTime();if(d===t)return'hoy';if(d===t+DAY_MS)return'mañana';return DAYS[monIdx(ms)];}

// ---------------------------------------------------------------- motor
class ScheduleEngine{
  constructor({config,api,obsOps,now=()=>Date.now(),log=()=>{}}){this.config=config;this.api=api;this.obsOps=obsOps;this.now=now;this.log=log;this.runs=new Map();this.message='';this.obsState={configured:false};this.busy=false;}
  automation(){try{return this.api.automation();}catch{return null;}}
  readyCount(a){return(a?.queue||[]).filter(x=>x&&x.status==='LISTA').length;}
  run(inst){let r=this.runs.get(inst.id);if(!r){r={inst,done:new Set(),obsTries:0,waitSince:0,closingSince:0,streamTailAt:0};this.runs.set(inst.id,r);}r.inst=inst;return r;}
  async act(r,key,label,fn){try{await fn();r.done.add(key);this.log('SCHEDULE',`${label} · ${r.inst.id}`);return true;}catch(e){this.message=`${label}: ${e.message||e}`;this.log('SCHEDULE_ERROR',`${label}: ${e.message||e}`);return false;}}
  async tick(){
    if(this.busy)return;this.busy=true;
    try{
      const cfg=normalizeSchedule(this.config()),now=this.now(),a=this.automation();this.message='';
      if(cfg.enabled&&a){
        const inst=activeInstance(cfg.slots,now);
        if(inst){
          const r=this.run(inst);
          if(!r.done.has('prep'))await this.act(r,'prep','Horario: inicia la preparación',async()=>{if(!a.processingRunning)await a.startProcessing();else if(a.processingPaused)await a.resumeProcessing?.();});
          if(inst.youtube&&inst.emitAt!=null&&now>=inst.emitAt-OBS_LEAD_MS&&!r.done.has('obsStart')&&r.obsTries<3){
            r.obsTries++;const ok=await this.act(r,'obsStart','Horario: OBS inicia la transmisión',()=>this.obsOps.start());
            if(!ok&&r.obsTries>=3)this.message=`${this.message} · Se emite igual sin YouTube.`;
          }
          if(inst.emitAt!=null&&now>=inst.emitAt&&!r.done.has('emit')){
            const ready=this.readyCount(a);
            if(a.emissionRunning)r.done.add('emit');
            else if(ready<1&&(!r.waitSince||now-r.waitSince<WAIT_READY_MS)){if(!r.waitSince)r.waitSince=now;this.message='Horario: esperando noticias listas para empezar a emitir.';}
            else await this.act(r,'emit','Horario: inicia la emisión',()=>this.api.startEmission());
          }
        }
      }
      // cierre: franjas que terminaron (aunque el horario se haya apagado mientras tanto)
      for(const r of this.runs.values()){
        const i=r.inst;if(i.openEnd||now<i.end||r.done.has('closed'))continue;
        if(!a){r.done.add('closed');continue;}
        if(!r.done.has('end')){await this.act(r,'end','Horario: fin de la franja, detiene la emisión',async()=>{if(a.emissionRunning)await a.stopEmission();});r.closingSince=now;}
        // en Merlín la noticia al aire termina y sigue la despedida: la salida queda libre recién con el stop final
        const idle=!a.emissionRunning&&String(a.currentKind||'none')==='none'&&!this.api.outputBusy?.();
        if(!idle&&now-r.closingSince<CLOSE_TIMEOUT_MS)continue;   // Merlín termina la noticia y se despide
        if(!r.streamTailAt)r.streamTailAt=now+STREAM_TAIL_MS;
        if(now<r.streamTailAt&&r.done.has('obsStart'))continue;
        if(r.done.has('obsStart')&&!r.done.has('obsStop'))await this.act(r,'obsStop','Horario: OBS detiene la transmisión',()=>this.obsOps.stop());
        const nxt=nextInstance(normalizeSchedule(this.config()).slots,now),soon=nxt&&nxt.start-now<KEEP_PREP_MS;
        if(!soon&&a.processingRunning&&!activeInstance(normalizeSchedule(this.config()).slots,now))await this.act(r,'prepStop','Horario: detiene la preparación',()=>a.stopProcessing());
        r.done.add('closed');
      }
      for(const [k,r] of this.runs)if(r.done.has('closed')&&now-endOf(r.inst)>DAY_MS)this.runs.delete(k);
    }finally{this.busy=false;}
  }
  snapshot(){
    const cfg=normalizeSchedule(this.config()),now=this.now(),act=cfg.enabled?activeInstance(cfg.slots,now):null,nxt=cfg.enabled?nextInstance(cfg.slots,now):null,a=this.automation();
    const live=act&&act.emitAt!=null&&now>=act.emitAt;
    return{enabled:cfg.enabled,slots:cfg.slots,anyYoutube:cfg.slots.some(s=>s.youtube),message:this.message,obs:this.obsState,
      active:act?{phase:live?'emit':'prep',youtube:act.youtube,emitAt:act.emitAt,end:act.end,label:live?(act.end?`Emitiendo hasta ${fmt12(act.end)}`:'Emitiendo (sin hora de fin)'):`Preparando · emite ${fmt12(act.emitAt??act.start)}`}:null,
      next:nxt?{start:nxt.start,emitAt:nxt.emitAt,youtube:nxt.youtube,label:`${dayLabel(nxt.emitAt??nxt.start,now)} ${fmt12(nxt.emitAt??nxt.start)}`}:null,
      emissionRunning:!!a?.emissionRunning,processingRunning:!!a?.processingRunning};
  }
}

// ---------------------------------------------------------------- almacenamiento
function profileId(dataDir){try{const {getProfileManager}=require('./profileManager0329');return String(getProfileManager(dataDir).activeId?.()||'default');}catch{return'default';}}
function readJson(f,fb){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return fb;}}
function writeJson(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});const t=`${f}.tmp-${process.pid}`;fs.writeFileSync(t,JSON.stringify(v,null,2),'utf8');fs.renameSync(t,f);}
const enc=v=>{if(!v)return'';try{if(safeStorage?.isEncryptionAvailable?.())return'ss:'+safeStorage.encryptString(v).toString('base64');}catch{}return'b64:'+Buffer.from(v,'utf8').toString('base64');};
const dec=v=>{const s=String(v||'');try{if(s.startsWith('ss:'))return safeStorage.decryptString(Buffer.from(s.slice(3),'base64'));if(s.startsWith('b64:'))return Buffer.from(s.slice(4),'base64').toString('utf8');}catch{}return'';};

function installBroadcastScheduleLab33({api=globalThis.__gecScheduleApi,obsOps:obsOverride=null,now,startTimer=true}={}){
  if(!api)return null;if(global.__gecScheduleLab33)return global.__gecScheduleLab33;
  const dataDir=()=>api.dataDir();
  const schedFile=()=>path.join(dataDir(),SCHEDULE_FILE),obsFile=()=>path.join(dataDir(),OBS_FILE);
  const readAll=()=>{const v=readJson(schedFile(),{});return v&&typeof v==='object'&&v.profiles&&typeof v.profiles==='object'?v:{version:1,profiles:{}};};
  const config=()=>readAll().profiles[profileId(dataDir())]||{enabled:false,slots:[]};
  const obsCfg=()=>{const v=readJson(obsFile(),{})||{};return{url:String(v.url||'ws://127.0.0.1:4455'),password:dec(v.passwordEnc),hasPassword:!!v.passwordEnc};};
  const obsOps=obsOverride||{start:()=>obs.startStream(obsCfg()),stop:()=>obs.stopStream(obsCfg()),status:()=>obs.streamStatus(obsCfg())};
  const engine=new ScheduleEngine({config,api,obsOps,now,log:(k,m)=>{try{api.log?.(k,m);}catch{}}});
  const push=()=>{try{api.notify?.('schedule:state',engine.snapshot());}catch{}};
  async function refreshObs(){const c=obsCfg();try{const s=await obsOps.status();engine.obsState={configured:true,url:c.url,...s,error:''};}catch(e){engine.obsState={configured:true,url:c.url,connected:false,streaming:false,error:String(e.message||e)};}return engine.obsState;}
  let obsCounter=0;
  const loop=async()=>{try{await engine.tick();const snap=engine.snapshot();if(snap.anyYoutube&&snap.enabled&&(++obsCounter%3===0||snap.active))await refreshObs();}catch(e){try{api.log?.('SCHEDULE_ERROR',e.message||e);}catch{}}push();};
  if(startTimer){const t=setInterval(loop,TICK_MS);t.unref?.();setTimeout(loop,8000).unref?.();}
  const handle=(k,fn)=>{try{ipcMain.removeHandler(k);}catch{}ipcMain.handle(k,fn);};
  handle('schedule:get',()=>({ok:true,schedule:normalizeSchedule(config()),raw:config(),state:engine.snapshot()}));
  handle('schedule:set',async(_e,incoming={})=>{
    const raw={enabled:incoming.enabled!==false,slots:(Array.isArray(incoming.slots)?incoming.slots:[]).map((s,i)=>({...s,id:String(s.id||crypto.randomBytes(3).toString('hex')||`f${i+1}`)}))};
    const cfg=normalizeSchedule(raw),errors=validate(cfg);if(errors.length)return{ok:false,errors};
    const all=readAll();all.profiles[profileId(dataDir())]={enabled:raw.enabled,slots:cfg.slots};writeJson(schedFile(),all);
    await loop();return{ok:true,schedule:cfg,state:engine.snapshot()};
  });
  handle('schedule:state',async()=>engine.snapshot());
  handle('obs:get',()=>{const c=obsCfg();return{ok:true,url:c.url,hasPassword:c.hasPassword,state:engine.obsState};});
  handle('obs:set',async(_e,{url,password,keepPassword}={})=>{const cur=readJson(obsFile(),{})||{};const u=String(url||'').trim()||'ws://127.0.0.1:4455';if(!/^wss?:\/\/[^\s]+$/i.test(u))return{ok:false,error:'La dirección debe empezar con ws:// (por ejemplo ws://127.0.0.1:4455).'};
    writeJson(obsFile(),{url:u,passwordEnc:keepPassword&&!password?cur.passwordEnc||'':enc(String(password||''))});const st=await refreshObs();push();return{ok:true,state:st};});
  handle('obs:test',async()=>{const st=await refreshObs();push();return{ok:!!st.connected,state:st};});
  handle('obs:start',async()=>{try{const r=await obsOps.start();await refreshObs();push();return{ok:true,...r};}catch(e){return{ok:false,error:String(e.message||e)};}});
  handle('obs:stop',async()=>{try{const r=await obsOps.stop();await refreshObs();push();return{ok:true,...r};}catch(e){return{ok:false,error:String(e.message||e)};}});
  global.__gecScheduleLab33={engine,loop,refreshObs};
  return global.__gecScheduleLab33;
}

module.exports={installBroadcastScheduleLab33,ScheduleEngine,normalizeSchedule,normalizeSlot,instanceOn,activeInstance,nextInstance,overlaps,validate,fmt12,toMin};
