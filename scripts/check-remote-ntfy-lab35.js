'use strict';
// Lab.35 · control desde el celular con ntfy (services/remoteNtfyLab35.js), contra un servidor ntfy simulado en local:
// publica con botones, escucha los dos temas por stream y ejecuta pausar / reanudar / siguiente / detener la
// preparación / cortar la transmisión, con clave en los botones y PIN en las órdenes escritas.
const fs=require('fs'),os=require('os'),path=require('path'),http=require('http');
const root=path.join(__dirname,'..');
const R=require(path.join(root,'src/services/remoteNtfyLab35'));
let checks=0;const ok=(c,m)=>{checks++;if(!c){console.error('check-remote-ntfy-lab35: '+m);process.exit(1);}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=3000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return true;await sleep(20);}return false;}

// ---- funciones puras
ok(R.parseTyped('Pausar 1234','1234').c==='pause'&&R.parseTyped('pausar 1234','1234').viaPin,'pausar con PIN');
ok(!R.parseTyped('pausar','1234').viaPin,'sin PIN no vale');
ok(R.parseTyped('1234 siguiente','1234').c==='next','el PIN puede ir antes');
ok(R.parseTyped('detener la preparación 1234','1234').c==='prep-stop!','detener la preparación (con tilde)');
ok(R.parseTyped('cortar transmisión 1234','1234').c==='obs-stop!','cortar la transmisión');
ok(R.parseTyped('detener youtube 1234','1234').c==='obs-stop!','detener youtube');
ok(R.parseTyped('reanudar 1234','1234').c==='resume'&&R.parseTyped('estado 1234','1234').c==='status','reanudar / estado');
ok(R.parseButton('{"gec":"k1","c":"next"}','k1').valid&&!R.parseButton('{"gec":"x","c":"next"}','k1').valid,'clave de los botones');
ok(R.parseButton('pausar 1234','k1')===null,'texto escrito no es un botón');
ok(R.panelButtons({emissionRunning:true,emissionPaused:false}).join()==='pause,next,more','botones en emisión');
ok(R.panelButtons({emissionRunning:true,emissionPaused:true})[0]==='resume','pausada → Reanudar');
ok(R.panelButtons({},{more:true}).join()==='screen,obs,prep-stop','más opciones');
ok(R.panelButtons({},{menu:'obs'}).join()==='obs-start,obs-stop,status','menú transmisión');
ok(R.parseTyped('iniciar transmisión 1234','1234').c==='obs-start!'&&R.parseTyped('ver pantalla 1234','1234').c==='screen','iniciar transmisión / ver pantalla');
ok(R.validTopic('gec-0123456789abcdef01')&&!R.validTopic('a b')&&!R.validTopic('corto'),'validación del tema');

// ---- servidor ntfy simulado: POST / publica; GET /<t1>,<t2>/json mantiene un stream NDJSON
const published=[],streams=new Set();let seq=0,authSeen='';
const server=http.createServer((req,res)=>{
  authSeen=req.headers.authorization||authSeen;
  if(req.method==='PUT'){const chunks=[];req.on('data',d=>chunks.push(d));req.on('end',()=>{
    const u=new URL(req.url,'http://x'),body=Buffer.concat(chunks),topic=u.pathname.slice(1);
    const msg={id:`m${++seq}`,time:Math.floor(Date.now()/1000),event:'message',topic,title:u.searchParams.get('title'),message:u.searchParams.get('message'),tags:(u.searchParams.get('tags')||'').split(','),attachment:{name:u.searchParams.get('filename'),size:body.length,head:body.subarray(0,8).toString('hex')},actions:[]};
    published.push(msg);for(const s of streams)if(s.topics.includes(topic))s.res.write(JSON.stringify(msg)+'\n');
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(msg));});return;}
  if(req.method==='POST'){let b='';req.on('data',d=>b+=d);req.on('end',()=>{
    let msg;const now=Math.floor(Date.now()/1000);
    if(req.url==='/'){const j=JSON.parse(b);msg={id:`m${++seq}`,time:now,event:'message',topic:j.topic,title:j.title,message:j.message,tags:j.tags,actions:j.actions};published.push(msg);}
    else msg={id:`m${++seq}`,time:now,event:'message',topic:req.url.slice(1),message:b};
    for(const s of streams)if(s.topics.includes(msg.topic))s.res.write(JSON.stringify(msg)+'\n');
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(msg));});return;}
  const m=req.url.match(/^\/([^/]+)\/json/);if(!m){res.statusCode=404;return res.end();}
  res.writeHead(200,{'Content-Type':'application/x-ndjson'});res.write(JSON.stringify({id:'o',event:'open'})+'\n');
  const s={topics:m[1].split(','),res};streams.add(s);req.on('close',()=>streams.delete(s));
});
// el celular: toca un botón (POST al tema de órdenes) o escribe en el tema de avisos
async function tap(btn){return fetch(btn.url,{method:btn.method,body:btn.body,headers:btn.headers});}
async function type(base,topic,text){return fetch(`${base}/${topic}`,{method:'POST',body:text});}

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-lab35-'));
  // automatización y OBS simulados
  const calls=[];
  const a={emissionRunning:true,emissionPaused:false,processingRunning:true,processingPaused:false,currentKind:'news',currentItem:{result:{title:'Canal 5 transmite México vs Chile'}},queue:[{status:'LISTA'},{status:'LISTA'},{status:'EMITIDA'}],
    pauseEmission(){calls.push('pause');this.emissionPaused=true;},resumeEmission(){calls.push('resume');this.emissionPaused=false;},skipCurrent(){calls.push('next');},stopProcessing(){calls.push('prep-stop');this.processingRunning=false;}};
  const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  global.__gecScheduleLab33={engine:{obsState:{connected:true,streaming:true},message:''},obsOps:{stop:async()=>{calls.push('obs-stop');global.__gecScheduleLab33.engine.obsState.streaming=false;return{stopped:true};},start:async()=>{calls.push('obs-start');global.__gecScheduleLab33.engine.obsState.streaming=true;return{started:true};}},refreshObs:async()=>{},push(){}};
  const handlers={},events=[];
  const electron={ipcMain:{handle:(k,fn)=>{handlers[k]=fn;},removeHandler:()=>{}},safeStorage:{isEncryptionAvailable:()=>false}};
  let frame={ok:true,dataUrl:`data:image/png;base64,${PNG}`};
  const api={automation:()=>a,dataDir:()=>tmp,notify:(ch,p)=>events.push([ch,p]),log:()=>{},monitorFrame:async()=>frame};
  const inst=R.installRemoteNtfyLab35({api,electron,startTimer:false});
  ok(inst&&handlers['remote:get']&&handlers['remote:set']&&handlers['remote:test']&&handlers['remote:newTopic'],'faltan los IPC remote:*');
  let v=handlers['remote:get']();
  ok(/^gec-[0-9a-f]{18}$/.test(v.topic)&&!v.enabled,'tema aleatorio y desactivado al inicio');
  const raw0=JSON.parse(fs.readFileSync(path.join(tmp,'remote-ntfy.json'),'utf8'));ok(raw0.key&&raw0.key.length>=20,'clave de botones aleatoria');
  ok((await handlers['remote:set']({},{enabled:true,server:'ftp://x',topic:v.topic})).ok===false,'servidor inválido rechazado');
  ok((await handlers['remote:set']({},{enabled:true,server:base,topic:v.topic,pin:'12 34'})).ok===false,'PIN con espacio rechazado');
  v=await handlers['remote:set']({},{enabled:true,server:base,topic:v.topic,pin:'1234',token:'tk_abc'});
  ok(v.ok&&v.enabled&&v.hasPin&&v.hasToken,'configuración guardada');
  const saved=fs.readFileSync(path.join(tmp,'remote-ntfy.json'),'utf8');ok(!saved.includes('1234')&&!saved.includes('tk_abc'),'PIN y token no quedan en texto plano');
  ok(await until(()=>inst.engine.state.connected),'no se conectó al stream de ntfy');
  ok(authSeen==='Bearer tk_abc','no manda el token de acceso');

  // botones de prueba
  const t=await handlers['remote:test']();ok(t.ok,'remote:test falló: '+t.error);
  let last=published.at(-1);
  ok(last.topic===v.topic&&last.tags.includes('gec')&&/Canal 5 transmite/.test(last.message)&&/2 listas/.test(last.message)&&/EN VIVO/.test(last.message),'el aviso no describe el estado:\n'+last.message);
  ok(last.actions.length===3&&last.actions.map(x=>x.label).join()==='Pausar,Siguiente,Más opciones','botones del panel');
  ok(last.actions.every(x=>x.action==='http'&&x.url===`${base}/${v.topic}-cmd`&&x.method==='POST'&&x.headers?.Authorization==='Bearer tk_abc'),'los botones no apuntan al tema de órdenes con el token');
  // los propios avisos no se ejecutan como órdenes
  await sleep(150);ok(calls.length===0,'ejecutó su propio aviso');

  // Pausar
  await tap(last.actions[0]);ok(await until(()=>calls.includes('pause')),'el botón Pausar no pausó');
  ok(await until(()=>/pausada/.test(published.at(-1).title)),'no confirmó la pausa');
  last=published.at(-1);ok(last.actions[0].label==='Reanudar','tras pausar, el primer botón debe ser Reanudar');
  await tap(last.actions[0]);ok(await until(()=>calls.includes('resume')),'Reanudar no funcionó');
  // Siguiente
  last=published.at(-1);await tap(last.actions[1]);ok(await until(()=>calls.includes('next')),'Siguiente no funcionó');
  ok(await until(()=>/Se omitió: Canal 5/.test(published.at(-1).message)),'no informa qué se omitió');
  // Más opciones → Detener preparación (pide confirmación) → Sí
  last=published.at(-1);await tap(last.actions[2]);ok(await until(()=>published.at(-1).title==='Más opciones'),'Más opciones no respondió');
  last=published.at(-1);ok(last.actions.map(x=>x.label).join()==='Ver pantalla,Transmisión,Detener preparación','botones de Más opciones');
  const more=last;
  // Ver pantalla: captura adjunta (PNG real), sin botones, ignorada como orden
  await tap(more.actions[0]);ok(await until(()=>published.at(-1).attachment),'Ver pantalla no envió la captura');
  last=published.at(-1);ok(last.attachment.name==='gec-pantalla.png'&&last.attachment.head==='89504e470d0a1a0a'&&last.title==='📺 Al aire ahora'&&/Canal 5/.test(last.message)&&last.tags.includes('gec'),'la captura no llegó como PNG con título y estado');
  frame={ok:false,error:'La ventana de salida está cerrada.'};await tap(more.actions[0]);ok(await until(()=>/No se pudo capturar/.test(published.at(-1).title)&&/cerrada/.test(published.at(-1).message)),'no avisó que no pudo capturar');
  // Detener preparación (con confirmación)
  await tap(more.actions[2]);ok(await until(()=>/¿Detener la preparación/.test(published.at(-1).title)),'no pidió confirmación para detener la preparación');
  ok(!calls.includes('prep-stop'),'detuvo la preparación sin confirmar');
  await tap(published.at(-1).actions[0]);ok(await until(()=>calls.includes('prep-stop')),'la confirmación no detuvo la preparación');
  // Transmisión → [Iniciar] [Cortar] [Estado]
  await tap(more.actions[1]);ok(await until(()=>published.at(-1).title==='Transmisión de YouTube'),'el menú Transmisión no respondió');
  last=published.at(-1);ok(last.actions.map(x=>x.label).join()==='Iniciar transmisión,Cortar transmisión,Estado','botones del menú Transmisión');
  await tap(last.actions[1]);ok(await until(()=>/¿Cortar la transmisión/.test(published.at(-1).title)),'no pidió confirmación para cortar');
  ok(!calls.includes('obs-stop'),'cortó sin confirmar');
  await tap(published.at(-1).actions[0]);ok(await until(()=>calls.includes('obs-stop')),'la confirmación no cortó la transmisión');
  ok(await until(()=>/Transmisión cortada/.test(published.at(-1).title)),'no confirmó el corte');
  await tap(last.actions[0]);ok(await until(()=>/¿Iniciar la transmisión/.test(published.at(-1).title)),'no pidió confirmación para iniciar');ok(!calls.includes('obs-start'),'inició sin confirmar');
  await tap(published.at(-1).actions[0]);ok(await until(()=>calls.includes('obs-start')&&/Transmisión iniciada/.test(published.at(-1).title)),'la confirmación no inició la transmisión');

  // botón con clave equivocada: se ignora
  let n=calls.length;await fetch(`${base}/${v.topic}-cmd`,{method:'POST',body:JSON.stringify({gec:'otra',c:'pause'})});await sleep(200);
  ok(calls.length===n,'ejecutó un botón con clave inválida');
  // órdenes escritas: con PIN funcionan; sin PIN, solo un aviso
  a.emissionPaused=false;await type(base,v.topic,'pausar 1234');ok(await until(()=>calls.length===n+1&&calls.at(-1)==='pause'),'«pausar 1234» no funcionó');
  n=calls.length;await type(base,v.topic,'siguiente');ok(await until(()=>published.at(-1).title==='Falta el PIN'),'no avisó que falta el PIN');ok(calls.length===n,'ejecutó una orden sin PIN');
  await type(base,v.topic,'cortar 9999');await sleep(200);ok(calls.length===n,'ejecutó con un PIN equivocado');

  // aviso automático al iniciar la emisión
  a.emissionRunning=false;inst.engine.watch();const before=published.length;a.emissionRunning=true;a.emissionPaused=false;inst.engine.watch();
  ok(await until(()=>published.length>before&&/Emisión iniciada/.test(published.at(-1).title)),'no avisó al iniciar la emisión');
  ok(events.some(e=>e[0]==='remote:state'&&e[1].lastCommand),'no notifica el estado al panel');

  // ---- avisos automáticos con un reloj simulado
  let clock=Date.now();const realNow=inst.engine.now;inst.engine.now=()=>clock;
  // salida trabada: noticia de 60 s que sigue al aire
  a.currentKind='news';a.currentItem={id:'n7',result:{title:'Nota trabada'},audio:{durationSec:60}};a.emissionPaused=false;inst.engine.watch();
  let cnt=published.length;clock+=100000;inst.engine.watch();await sleep(100);ok(published.length===cnt,'avisó antes de tiempo');
  a.emissionPaused=true;clock+=120000;inst.engine.watch();await sleep(100);ok(published.length===cnt,'contó el tiempo en pausa');
  a.emissionPaused=false;clock+=50000;inst.engine.watch();
  ok(await until(()=>/trabada/.test(published.at(-1).title)),'no avisó la salida trabada');
  last=published.at(-1);ok(/«Nota trabada»/.test(last.message)&&last.actions.map(x=>x.label).join()==='Siguiente,Ver pantalla,Estado','aviso de salida trabada incompleto');
  cnt=published.length;clock+=60000;inst.engine.watch();await sleep(100);ok(published.length===cnt,'repitió el aviso enseguida');
  n=calls.length;await tap(last.actions[0]);ok(await until(()=>calls.length===n+1&&calls.at(-1)==='next'),'Siguiente desde el aviso no funcionó');
  // otra pieza: el contador vuelve a cero
  a.currentItem={id:'n8',result:{title:'Otra'},audio:{durationSec:60}};inst.engine.watch();cnt=published.length;clock+=30000;inst.engine.watch();await sleep(100);ok(published.length===cnt,'no reinició el contador con la pieza nueva');
  // transmisión cortada sin que nadie la cortara
  const o=global.__gecScheduleLab33.engine.obsState;o.streaming=true;clock+=200000;inst.engine.watch();
  o.streaming=false;inst.engine.watch();ok(await until(()=>/Se cortó la transmisión/.test(published.at(-1).title)),'no avisó que se cortó la transmisión');
  ok(published.at(-1).actions[0].label==='Iniciar transmisión','el aviso de corte no ofrece Iniciar transmisión');
  // cortada por GEC (panel u horario): no avisa
  o.streaming=true;inst.engine.watch();await global.__gecScheduleLab33.obsOps.stop();cnt=published.length;inst.engine.watch();await sleep(100);ok(published.length===cnt,'avisó un corte pedido por GEC');
  // error del horario con OBS
  global.__gecScheduleLab33.engine.message='Horario: inicia la transmisión en OBS: OBS no responde en ws://127.0.0.1:4455.';inst.engine.watch();
  ok(await until(()=>/no arrancó/.test(published.at(-1).title)),'no avisó el error del horario');
  cnt=published.length;inst.engine.watch();await sleep(100);ok(published.length===cnt,'repitió el aviso del horario');
  inst.engine.now=realNow;

  // tema nuevo: los botones viejos dejan de valer
  const oldBtn=published.at(-1).actions[1];const nv=handlers['remote:newTopic']();ok(nv.topic!==v.topic,'no generó otro tema');
  ok(await until(()=>inst.engine.state.connected),'no se reconectó con el tema nuevo');
  n=calls.length;await tap(oldBtn);await sleep(200);ok(calls.length===n,'un botón del tema anterior siguió funcionando');

  inst.engine.stop();server.close();fs.rmSync(tmp,{recursive:true,force:true});
  // conexión con el panel y el arranque
  const pre=fs.readFileSync(path.join(root,'src/preload.js'),'utf8');
  ok(/'remote:state'/.test(pre)&&/remoteGet:\(\)=>invoke\('remote:get'\)/.test(pre)&&/renderer-remote-ntfy-lab35\.js/.test(pre),'preload no expone el control remoto');
  const boot=fs.readFileSync(path.join(root,'src/bootstrap-v2lab.js'),'utf8');
  ok(/installTtsRunawayGuardLab34\(\);\s*require\('\.\/services\/remoteNtfyLab35'\)\.installRemoteNtfyLab35\(\);/.test(boot),'no se instala al final de bootstrap-v2lab.js');
  ok(/monitorFrame:\(\)=>outputReady\(\)\?captureOutputMonitorFrame\(\)/.test(fs.readFileSync(path.join(root,'src/main.js'),'utf8')),'main.js no expone la captura de la salida');
  ok(/global\.__gecScheduleLab33=\{[^}]*obsOps/.test(fs.readFileSync(path.join(root,'src/services/broadcastScheduleLab33.js'),'utf8')),'Lab.33 no expone obsOps');
  console.log(`check-remote-ntfy-lab35 OK (${checks} verificaciones) · botones · órdenes con PIN · confirmaciones · OBS`);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
