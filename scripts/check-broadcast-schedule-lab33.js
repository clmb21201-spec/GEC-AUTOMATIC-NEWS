'use strict';
// Lab.33 · Horario automático y transmisión a YouTube vía OBS: franjas (AM/PM, cruce de medianoche, superposición),
// motor con reloj simulado (preparar, OBS, emitir, respetar acciones manuales, despedida de Merlín, cierre) y cliente obs-websocket v5.
const Module=require('module'),path=require('path'),fs=require('fs'),os=require('os'),assert=require('assert'),crypto=require('crypto');
const handlers=new Map(),baseLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='electron')return{app:{isPackaged:false,getPath:()=>os.tmpdir(),on(){}},ipcMain:{handle:(k,fn)=>handlers.set(k,fn),on(){},removeHandler:k=>handlers.delete(k)},safeStorage:{isEncryptionAvailable:()=>false}};
  return baseLoad.call(this,request,parent,isMain);
};
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const S=require(path.join(root,'src','services','broadcastScheduleLab33.js'));
const O=require(path.join(root,'src','services','obsWebSocketLab33.js'));
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};
const T=(y,mo,d,h,mi)=>new Date(y,mo-1,d,h,mi,0,0).getTime();
// 2026-10-05 es lunes
const MON=[5],weekday={id:'a',days:[1,1,1,1,1,0,0].map(Boolean),prep:'05:30',emit:'06:00',until:'09:00',youtube:true},weekend={id:'b',days:[0,0,0,0,0,1,1].map(Boolean),prep:'07:30',emit:'08:00',until:'11:00',youtube:true};

(async()=>{
  // ---------------------------------------------------------------- franjas
  const cfg=S.normalizeSchedule({enabled:true,slots:[weekday,weekend]});
  ok(new Date(T(2026,10,5,12,0)).getDay()===1,'el 5/10/2026 debe ser lunes');
  let i=S.activeInstance(cfg.slots,T(2026,10,5,5,45));
  ok(i&&i.slot.id==='a'&&i.emitAt===T(2026,10,5,6,0)&&i.end===T(2026,10,5,9,0),'lunes 5:45 AM: franja de lunes a viernes activa');
  ok(!S.activeInstance(cfg.slots,T(2026,10,5,9,0)),'a las 9:00 AM la franja terminó');
  ok(!S.activeInstance(cfg.slots,T(2026,10,10,6,0))&&S.activeInstance(cfg.slots,T(2026,10,10,8,30)).slot.id==='b','el sábado rige la franja de fin de semana');
  const nx=S.nextInstance(cfg.slots,T(2026,10,9,10,0));ok(nx&&nx.slot.id==='b'&&nx.start===T(2026,10,10,7,30),'viernes 10 AM: la próxima es el sábado 7:30 AM');
  const night=S.normalizeSchedule({slots:[{id:'n',days:[1,0,0,0,0,0,0].map(Boolean),prep:'22:30',emit:'23:00',until:'01:00'}]}).slots;
  i=S.activeInstance(night,T(2026,10,6,0,30));ok(i&&i.end===T(2026,10,6,1,0)&&i.start===T(2026,10,5,22,30),'franja que cruza medianoche: cuenta para el día en que empieza');
  const mid=S.normalizeSchedule({slots:[{id:'m',days:Array(7).fill(true),prep:'11:30',emit:'12:00',until:'00:00'}]}).slots;
  i=S.activeInstance(mid,T(2026,10,5,23,59));ok(i&&i.end===T(2026,10,6,0,0),'12:00 PM es mediodía y 12:00 AM es medianoche del día siguiente');
  ok(S.fmt12(T(2026,10,5,0,5))==='12:05 AM'&&S.fmt12(T(2026,10,5,12,0))==='12:00 PM'&&S.fmt12(T(2026,10,5,18,30))==='6:30 PM','formato AM/PM');
  const ov=S.validate(S.normalizeSchedule({slots:[weekday,{...weekday,id:'c',prep:'08:00',emit:'08:30',until:'10:00'}]}));
  ok(ov.some(e=>/se superponen/.test(e)),'detecta franjas superpuestas');
  ok(S.validate(S.normalizeSchedule({slots:[{...weekday,days:Array(7).fill(false)}]})).some(e=>/al menos un día/.test(e)),'exige al menos un día');
  ok(S.validate(cfg).length===0,'lunes a viernes y fin de semana no se superponen');
  ok(S.normalizeSlot({days:[1,1,1,1,1,0,0],prep:'05:30',emit:'',until:'09:00',youtube:true}).youtube===false,'sin hora de emitir no hay YouTube');

  // ---------------------------------------------------------------- motor
  function rig({now,ready=0,slots=[weekday,weekend],obsFail=false}){
    const log=[];let t=now,busy=false;
    const a={processingRunning:false,processingPaused:false,emissionRunning:false,currentKind:'none',queue:Array.from({length:ready},()=>({status:'LISTA'})),
      async startProcessing(){this.processingRunning=true;log.push('PREP');},stopProcessing(){this.processingRunning=false;log.push('PREP_STOP');},
      stopEmission(){this.emissionRunning=false;log.push('STOP');}};
    const api={automation:()=>a,startEmission:()=>{a.emissionRunning=true;log.push('EMIT');},outputBusy:()=>busy};
    let obsTries=0;const obsOps={start:async()=>{obsTries++;if(obsFail)throw new Error('OBS no responde');log.push('OBS_START');},stop:async()=>{log.push('OBS_STOP');},status:async()=>({connected:true})};
    const conf={enabled:true,slots};
    const e=new S.ScheduleEngine({config:()=>conf,api,obsOps,now:()=>t});
    return{e,a,log,conf,set:x=>{t=x;},busy:v=>{busy=v;},get obsTries(){return obsTries;}};
  }
  {const r=rig({now:T(2026,10,5,5,29)});
    await r.e.tick();ok(r.log.length===0,'5:29 AM: nada');
    r.set(T(2026,10,5,5,30));await r.e.tick();ok(r.log.join()==='PREP','5:30 AM: inicia la preparación');
    r.set(T(2026,10,5,5,59,0));await r.e.tick();ok(r.log.join()==='PREP,OBS_START','5:59 AM: OBS empieza a transmitir (video de espera)');
    r.set(T(2026,10,5,6,0));await r.e.tick();ok(!r.log.includes('EMIT')&&/esperando noticias/.test(r.e.message),'6:00 AM sin noticias listas: espera y avisa');
    r.a.queue.push({status:'LISTA'});r.set(T(2026,10,5,6,1));await r.e.tick();ok(r.log.join()==='PREP,OBS_START,EMIT','con una noticia lista: inicia la emisión');
    ok(r.e.snapshot().active.label==='Emitiendo hasta 9:00 AM','el panel muestra "Emitiendo hasta 9:00 AM"');
    r.a.emissionRunning=false;r.set(T(2026,10,5,7,0));await r.e.tick();ok(r.log.filter(x=>x==='EMIT').length===1,'si el operador detiene la emisión, el horario no la vuelve a iniciar');
    r.a.emissionRunning=true;r.a.currentKind='news';r.busy(true);
    r.set(T(2026,10,5,9,0));await r.e.tick();ok(r.log.includes('STOP')&&!r.log.includes('OBS_STOP'),'9:00 AM: detiene la emisión y espera la despedida');
    r.a.currentKind='none';r.set(T(2026,10,5,9,1));await r.e.tick();ok(!r.log.includes('OBS_STOP'),'mientras Merlín se despide, OBS sigue transmitiendo');
    r.busy(false);r.set(T(2026,10,5,9,2));await r.e.tick();ok(!r.log.includes('OBS_STOP'),'espera unos segundos después de la despedida');
    r.set(T(2026,10,5,9,2)+9000);await r.e.tick();ok(r.log.slice(-2).join()==='OBS_STOP,PREP_STOP',`cierra OBS y la preparación (${r.log.join()})`);
    r.set(T(2026,10,5,9,10));await r.e.tick();ok(r.log.filter(x=>x==='OBS_STOP').length===1,'el cierre ocurre una sola vez');}
  {const r=rig({now:T(2026,10,5,7,15),ready:3});await r.e.tick();
    ok(r.log.join()==='PREP,OBS_START,EMIT','GEC abierto en medio de la franja: entra en ella');}
  {const r=rig({now:T(2026,10,5,5,59),ready:2,obsFail:true});for(let k=0;k<5;k++){r.set(T(2026,10,5,6,0)+k*20000);await r.e.tick();}
    ok(r.obsTries===3&&r.log.includes('EMIT'),'si OBS no responde: 3 intentos y se emite igual');}
  {const r=rig({now:T(2026,10,5,6,0),ready:2});r.conf.enabled=false;await r.e.tick();ok(r.log.length===0,'horario apagado: no hace nada');}
  {const r=rig({now:T(2026,10,5,5,30),slots:[{...weekday,emit:'',youtube:false}]});await r.e.tick();r.set(T(2026,10,5,6,30));await r.e.tick();
    ok(r.log.join()==='PREP','"Emitir" vacío: solo prepara; la emisión la inicia el operador');}

  // ---------------------------------------------------------------- cliente obs-websocket v5 (servidor falso)
  const salt='c2FsdA==',challenge='Y2hhbGxlbmdl';
  const h1=crypto.createHash('sha256').update('clave'+salt).digest('base64'),expected=crypto.createHash('sha256').update(h1+challenge).digest('base64');
  ok(O.authString('clave',salt,challenge)===expected,'autenticación de obs-websocket v5');
  function FakeObs(password,state){
    return class{constructor(url,proto){this.url=url;this.proto=proto;setTimeout(()=>this.onmessage({data:JSON.stringify({op:0,d:{rpcVersion:1,authentication:{salt,challenge}}})}),1);}
      send(raw){const m=JSON.parse(raw);
        if(m.op===1){if(m.d.authentication!==O.authString(password,salt,challenge))return setTimeout(()=>this.onclose({code:4009}),1);return setTimeout(()=>this.onmessage({data:JSON.stringify({op:2,d:{}})}),1);}
        if(m.op===6){const {requestType,requestId}=m.d;let status={result:true,code:100},data={};
          if(requestType==='GetStreamStatus')data={outputActive:state.live,outputTimecode:'00:01:00.000'};
          else if(requestType==='StartStream'){state.live=true;state.calls.push('start');}
          else if(requestType==='StopStream'){state.live=false;state.calls.push('stop');}
          else if(requestType==='GetVersion')data={obsVersion:'31.0.0'};
          setTimeout(()=>this.onmessage({data:JSON.stringify({op:7,d:{requestType,requestId,requestStatus:status,responseData:data}})}),1);}}
      close(){}};
  }
  const st={live:false,calls:[]},W=FakeObs('clave',st);
  ok((await O.startStream({password:'clave',WebSocketImpl:W})).started===true&&st.live,'StartStream con contraseña');
  ok((await O.startStream({password:'clave',WebSocketImpl:W})).alreadyStreaming===true&&st.calls.length===1,'no repite StartStream si ya transmite');
  const s2=await O.streamStatus({password:'clave',WebSocketImpl:W});ok(s2.connected&&s2.streaming&&s2.obsVersion==='31.0.0','GetStreamStatus');
  ok((await O.stopStream({password:'clave',WebSocketImpl:W})).stopped===true&&!st.live,'StopStream');
  let err='';try{await O.streamStatus({password:'mala',WebSocketImpl:W});}catch(e){err=e.message;}
  ok(/contraseña de OBS no es correcta/.test(err),`contraseña equivocada: mensaje claro (${err})`);
  err='';try{await O.streamStatus({url:'ws://127.0.0.1:4455',WebSocketImpl:class{constructor(){setTimeout(()=>this.onerror(new Error('connect ECONNREFUSED')),1);}send(){}close(){}}});}catch(e){err=e.message;}
  ok(/OBS no responde en ws:\/\/127\.0\.0\.1:4455/.test(err),'OBS cerrado: avisa que no responde');

  // ---------------------------------------------------------------- IPC y archivos
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-sched-'));
  const a={processingRunning:false,emissionRunning:false,currentKind:'none',queue:[],startProcessing(){},stopProcessing(){},stopEmission(){}};
  S.installBroadcastScheduleLab33({api:{automation:()=>a,dataDir:()=>tmp,startEmission(){},outputBusy:()=>false,notify(){},log(){}},obsOps:{start:async()=>({}),stop:async()=>({}),status:async()=>({connected:true,streaming:false})},startTimer:false});
  for(const k of ['schedule:get','schedule:set','schedule:state','obs:get','obs:set','obs:test','obs:start','obs:stop'])ok(handlers.has(k),`falta el IPC ${k}`);
  let res=await handlers.get('schedule:set')({},{enabled:true,slots:[weekday,{...weekday,id:'',prep:'08:00',emit:'08:30',until:'10:00'}]});
  ok(res.ok===false&&res.errors.some(e=>/superponen/.test(e)),'no guarda franjas superpuestas');
  res=await handlers.get('schedule:set')({},{enabled:true,slots:[weekday,weekend]});
  ok(res.ok&&res.schedule.slots.length===2,'guarda el horario');
  const file=JSON.parse(fs.readFileSync(path.join(tmp,'broadcast-schedule.json'),'utf8'));
  ok(Object.keys(file.profiles).length===1&&file.profiles[Object.keys(file.profiles)[0]].slots[0].prep==='05:30','se guarda por perfil, en 24 h');
  res=await handlers.get('obs:set')({},{url:'ws://127.0.0.1:4455',password:'secreto'});
  const of=JSON.parse(fs.readFileSync(path.join(tmp,'obs-websocket.json'),'utf8'));
  ok(res.ok&&of.passwordEnc&&!JSON.stringify(of).includes('secreto'),'la contraseña de OBS no se guarda en claro');
  ok((await handlers.get('obs:get')()).hasPassword===true,'obs:get no devuelve la contraseña, solo si existe');
  ok((await handlers.get('obs:set')({},{url:'http://x'})).ok===false,'valida la dirección ws://');

  // ---------------------------------------------------------------- integración
  const main=read('src/main.js'),pre=read('src/preload.js'),boot=read('src/bootstrap-v2lab.js'),ren=read('src/renderer-schedule-lab33.js'),pkg=JSON.parse(read('package.json'));
  ok(/globalThis\.__gecScheduleApi=\{automation:\(\)=>automation/.test(main)&&/startEmission:\(\)=>\{if\(!outputReady\(\)\)createOutputWindow\(false\)/.test(main)&&/outputBusy:\(\)=>!!currentOutputProgram/.test(main),'main.js expone la API del horario');
  ok(/'schedule:state'\]\)/.test(pre)&&/scheduleSet:cfg=>invoke\('schedule:set',cfg\)/.test(pre)&&/obsStart:\(\)=>invoke\('obs:start'\)/.test(pre)&&/renderer-schedule-lab33\.js/.test(pre),'preload expone el horario, OBS y el panel');
  ok(/broadcastScheduleLab33'\)\.installBroadcastScheduleLab33\(\)/.test(boot),'el servicio se instala en el arranque');
  ok(/insertAdjacentElement\('afterend', pill\)/.test(ren)&&ren.includes("$('#outputStatus')")&&ren.includes("$('#ecNdiOutputCard')"),'pastilla junto a OUTPUT y tarjeta OBS debajo de NDI');
  ok(/node scripts\/check-labs\.js/.test(pkg.scripts.check)&&/check-broadcast-schedule-lab33\.js/.test(read('scripts/check-labs.js')),'el check corre en npm run check (vía scripts/check-labs.js)');
  ok(pkg.scripts.check.length<8100,`el script check debe quedar bajo el límite de cmd.exe en Windows (${pkg.scripts.check.length} caracteres)`);
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log(`check-broadcast-schedule-lab33 OK (${checks} verificaciones) · franjas · motor · OBS · IPC`);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
