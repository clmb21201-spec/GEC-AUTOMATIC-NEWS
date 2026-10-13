'use strict';
// Lab.35 · Control desde el celular con ntfy (https://ntfy.sh o un servidor propio).
// GEC solo hace conexiones de salida al servidor de ntfy: funciona desde cualquier lugar sin abrir puertos.
// - Tema de avisos (el operador se suscribe en la app ntfy): GEC publica el estado con botones.
// - Tema de órdenes (`<tema>-cmd`, oculto): los botones mandan ahí {"gec":<clave>,"c":<orden>}.
//   También se pueden escribir órdenes en el tema de avisos con el PIN: "pausar 1234".
// Órdenes: pausar, reanudar, siguiente, ver pantalla (captura de la salida), detener la preparación e iniciar / cortar
// la transmisión de OBS (estas tres piden confirmación con un segundo botón), estado y menús.
// Avisos automáticos: inicio / fin de la emisión, salida trabada (una pieza al aire mucho más de lo que dura),
// transmisión cortada sin que nadie la cortara y errores del horario. Configuración en remote-ntfy.json (carpeta de datos);
// PIN y token cifrados con safeStorage. IPC remote:get|set|test|newTopic; evento remote:state.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const FILE='remote-ntfy.json';
const DEFAULT_SERVER='https://ntfy.sh';
const OWN_TAG='gec';

// ---------------------------------------------------------------- órdenes
const strip=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const ALIASES=[
  [/^(pausar|pausa|pause)\b/,'pause'],
  [/^(reanudar|continuar|seguir|play|resume)\b/,'resume'],
  [/^(siguiente|pasar|saltar|next|skip)\b/,'next'],
  [/^(detener|parar|stop) (la )?(preparacion|prep|procesamiento)\b/,'prep-stop!'],
  [/^(cortar|detener|parar|stop) (la )?(transmision|youtube|obs)\b|^cortar\b|^obs off\b/,'obs-stop!'],
  [/^(iniciar|empezar|arrancar|start) (la )?(transmision|youtube|obs)\b|^transmitir\b|^obs on\b/,'obs-start!'],
  [/^(ver )?(pantalla|captura|screen)\b/,'screen'],
  [/^(estado|status|como va)\b/,'status'],
  [/^(menu|botones|ayuda|help)\b/,'menu'],
  [/^(mas|mas opciones|more)\b/,'more'],
];
const KNOWN=new Set(['pause','resume','next','prep-stop','prep-stop!','obs-stop','obs-stop!','obs-start','obs-start!','obs','screen','status','menu','more']);
// Texto escrito en la app: la orden y el PIN en cualquier parte ("pausar 1234"). Lo escrito ya es deliberado:
// detener / cortar se ejecutan sin pedir confirmación.
function parseTyped(text,pin){
  const t=strip(text);if(!t)return null;
  const words=t.split(' '),hasPin=!!pin&&words.includes(strip(pin)),rest=words.filter(w=>!pin||w!==strip(pin)).join(' ');
  for(const [rx,c] of ALIASES)if(rx.test(rest))return{c,viaPin:hasPin};
  return{c:'',viaPin:hasPin};
}
// Cuerpo de un botón: {"gec":<clave>,"c":<orden>}
function parseButton(text,key){
  try{const o=JSON.parse(String(text||''));if(o&&typeof o==='object'&&'gec' in o)return{c:String(o.c||''),valid:!!key&&String(o.gec)===String(key)};}catch{}
  return null;
}
const LABEL={pause:'Pausar',resume:'Reanudar',next:'Siguiente',more:'Más opciones','prep-stop':'Detener preparación','obs-stop':'Cortar transmisión','obs-start':'Iniciar transmisión',obs:'Transmisión',screen:'Ver pantalla',status:'Estado','prep-stop!':'Sí, detener preparación','obs-stop!':'Sí, cortar transmisión','obs-start!':'Sí, iniciar transmisión',menu:'Botones'};

// Botones según el estado (ntfy admite 3 por aviso). El botón de destino es el tema de órdenes.
// Menús: principal → [Pausar|Reanudar] [Siguiente] [Más opciones]; más → [Ver pantalla] [Transmisión] [Detener
// preparación]; transmisión → [Iniciar transmisión] [Cortar transmisión] [Estado].
function panelButtons(st,{menu='main',more=false}={}){
  if(more||menu==='more')return['screen','obs','prep-stop'];
  if(menu==='obs')return['obs-start','obs-stop','status'];
  return[st.emissionRunning&&st.emissionPaused?'resume':'pause','next','more'];
}

// ---------------------------------------------------------------- estado de la emisión
function snapshot(api){
  const a=api?.automation?.()||{},q=Array.isArray(a.queue)?a.queue:[],sched=global.__gecScheduleLab33,obs=sched?.engine?.obsState||null;
  const kind=String(a.currentKind||'none'),title=a.currentItem?.result?.title||a.currentItem?.story?.title||a.currentCanned?.name||'';
  return{emissionRunning:!!a.emissionRunning,emissionPaused:!!a.emissionPaused,processingRunning:!!a.processingRunning,processingPaused:!!a.processingPaused,
    kind,title,ready:q.filter(x=>x&&x.status==='LISTA').length,obs:obs?{connected:!!obs.connected,streaming:!!obs.streaming,error:obs.error||''}:null};
}
function describe(st){
  const em=!st.emissionRunning?'detenida':st.emissionPaused?'PAUSADA':'al aire',pr=!st.processingRunning?'detenida':st.processingPaused?'pausada':'activa';
  const kind={news:'Noticia',canned:'Contenido',ad:'Anuncio',host:'Merlín'}[st.kind]||'';
  const lines=[];
  if(st.emissionRunning&&st.title)lines.push(`${kind?kind+': ':''}${st.title}`);
  lines.push(`Emisión ${em} · Preparación ${pr} · ${st.ready} lista${st.ready===1?'':'s'}`);
  if(st.obs)lines.push(st.obs.streaming?'YouTube: EN VIVO':st.obs.connected?'YouTube: sin transmitir':`OBS: ${st.obs.error||'sin conexión'}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------- motor
class RemoteNtfy{
  constructor({api,fetchImpl=globalThis.fetch,readConfig,log=()=>{},onState=()=>{},now=()=>Date.now()}){
    Object.assign(this,{api,fetch:fetchImpl,readConfig,log,onState,now});
    this.state={connected:false,error:'',lastCommand:'',lastAt:0};this.ctrl=null;this.lastId='';this.seen=new Set();this.ownIds=new Set();this.gen=0;this.timer=null;this.prev=null;
  }
  cfg(){return this.readConfig();}
  base(c=this.cfg()){return String(c.server||DEFAULT_SERVER).replace(/\/+$/,'');}
  headers(c=this.cfg(),json=false){const h={};if(c.token)h.Authorization=`Bearer ${c.token}`;if(json)h['Content-Type']='application/json';return h;}
  setState(p){this.state={...this.state,...p};try{this.onState(this.publicState());}catch{}}
  publicState(){return{...this.state};}
  action(c,cfgv=this.cfg()){
    const a={action:'http',label:LABEL[c]||c,url:`${this.base(cfgv)}/${cfgv.topic}-cmd`,method:'POST',body:JSON.stringify({gec:cfgv.key,c}),clear:true};
    if(cfgv.token)a.headers={Authorization:`Bearer ${cfgv.token}`};
    return a;
  }
  async publish({title,message,buttons=[],priority=3,tags=[]}){
    const c=this.cfg();if(!c.topic)throw new Error('Falta el tema de ntfy');
    const body={topic:c.topic,title:String(title||'GEC'),message:String(message||''),priority,tags:[OWN_TAG,...tags],actions:buttons.slice(0,3).map(b=>this.action(b,c))};
    const r=await this.fetch(`${this.base(c)}/`,{method:'POST',headers:this.headers(c,true),body:JSON.stringify(body)});
    if(!r.ok){const t=await r.text().catch(()=>'');throw new Error(`ntfy respondió ${r.status}${t?': '+t.slice(0,160):''}`);}
    try{const j=await r.json();if(j?.id){this.ownIds.add(j.id);if(this.ownIds.size>200)this.ownIds.delete(this.ownIds.values().next().value);}}catch{}
    return true;
  }
  async panel(title,{more=false,menu='main',extra=''}={}){
    const st=snapshot(this.api);
    return this.publish({title,message:[extra,describe(st)].filter(Boolean).join('\n'),buttons:panelButtons(st,{more,menu})});
  }
  // captura de la salida como adjunto (PUT con los parámetros en la URL: admite tildes sin codificar cabeceras)
  async screenshot(){
    const f=await this.api?.monitorFrame?.();
    if(!f?.ok||!f.dataUrl)return this.panel('No se pudo capturar la pantalla',{extra:f?.error||f?.message||'La salida no respondió.'});
    const c=this.cfg(),m=String(f.dataUrl).match(/^data:image\/(png|jpe?g);base64,(.+)$/);if(!m)return this.panel('No se pudo capturar la pantalla');
    const q=new URLSearchParams({title:'📺 Al aire ahora',message:describe(snapshot(this.api)),tags:`${OWN_TAG},tv`,filename:`gec-pantalla.${m[1]==='png'?'png':'jpg'}`});
    const r=await this.fetch(`${this.base(c)}/${c.topic}?${q}`,{method:'PUT',headers:this.headers(c),body:Buffer.from(m[2],'base64')});
    if(!r.ok){const t=await r.text().catch(()=>'');throw new Error(`ntfy respondió ${r.status}${t?': '+t.slice(0,160):''}`);}
    try{const j=await r.json();if(j?.id)this.ownIds.add(j.id);}catch{}
    return true;
  }
  // ---- ejecutar una orden ya validada
  async run(c){
    const a=this.api?.automation?.();if(!a)throw new Error('La automatización no está lista');
    this.setState({lastCommand:c.replace(/!$/,''),lastAt:this.now()});this.log('REMOTE',`orden ${c}`);
    switch(c){
      case 'pause':
        if(!a.emissionRunning)return this.panel('La emisión no está iniciada');
        if(a.emissionPaused)return this.panel('La emisión ya estaba pausada');
        await a.pauseEmission();return this.panel('⏸ Emisión pausada');
      case 'resume':
        if(!a.emissionRunning)return this.panel('La emisión no está iniciada');
        try{await a.resumeEmission();}catch(e){return this.panel('No se pudo reanudar',{extra:/OUTPUT_NOT_OPEN/.test(String(e?.message))?'La ventana de salida está cerrada.':String(e?.message||e)});}
        return this.panel('▶ Emisión reanudada');
      case 'next':{
        if(!a.emissionRunning)return this.panel('La emisión no está iniciada');
        const title=a.currentItem?.result?.title||a.currentItem?.story?.title||a.currentCanned?.name||'';
        await a.skipCurrent();return this.panel('⏭ Pasando a la siguiente',{extra:title?`Se omitió: ${title}`:''});}
      case 'prep-stop':return this.publish({title:'¿Detener la preparación de noticias?',message:'Las noticias ya listas se siguen emitiendo; no se preparan nuevas.',buttons:['prep-stop!','status'],priority:4});
      case 'prep-stop!':
        if(!a.processingRunning)return this.panel('La preparación ya estaba detenida');
        await a.stopProcessing();return this.panel('⏹ Preparación detenida');
      case 'obs-start':return this.publish({title:'¿Iniciar la transmisión de YouTube?',message:'OBS empieza a transmitir con su configuración actual.',buttons:['obs-start!','status'],priority:4});
      case 'obs-start!':{
        const s=global.__gecScheduleLab33;if(!s?.obsOps)return this.panel('No se pudo iniciar',{extra:'OBS no está configurado en GEC (pestaña Salida → OBS / YouTube).'});
        let r;try{r=await s.obsOps.start();}catch(e){return this.panel('No se pudo iniciar la transmisión',{extra:String(e?.message||e)});}
        try{await s.refreshObs?.();s.push?.();}catch{}
        return this.panel(r?.alreadyStreaming?'OBS ya estaba transmitiendo':'🔴 Transmisión iniciada');}
      case 'obs':
        try{await global.__gecScheduleLab33?.refreshObs?.();}catch{}
        return this.panel('Transmisión de YouTube',{menu:'obs'});
      case 'screen':return this.screenshot();
      case 'obs-stop':return this.publish({title:'¿Cortar la transmisión de YouTube?',message:'OBS deja de transmitir. La emisión de GEC sigue igual.',buttons:['obs-stop!','status'],priority:4});
      case 'obs-stop!':{
        const s=global.__gecScheduleLab33;if(!s?.obsOps)return this.panel('No se pudo cortar',{extra:'OBS no está configurado en GEC (pestaña Salida → OBS / YouTube).'});
        let r;try{r=await s.obsOps.stop();}catch(e){return this.panel('No se pudo cortar la transmisión',{extra:String(e?.message||e)});}
        try{await s.refreshObs?.();s.push?.();}catch{}
        return this.panel(r?.notStreaming?'OBS no estaba transmitiendo':'⏹ Transmisión cortada');}
      case 'status':
        try{await global.__gecScheduleLab33?.refreshObs?.();}catch{}
        return this.panel('Estado de GEC');
      case 'more':return this.panel('Más opciones',{more:true});
      case 'menu':default:return this.panel('Control de GEC');
    }
  }
  // ---- un mensaje recibido en el stream
  async handle(msg){
    if(!msg||msg.event!=='message'||!msg.id||this.seen.has(msg.id))return;
    this.seen.add(msg.id);if(this.seen.size>500)this.seen.delete(this.seen.values().next().value);
    if(msg.id)this.lastId=msg.id;
    if(this.ownIds.has(msg.id)||(Array.isArray(msg.tags)&&msg.tags.includes(OWN_TAG)))return;
    // mensajes viejos (reconexión, reintentos de la app): no se ejecutan
    if(Number(msg.time)&&Date.now()/1000-Number(msg.time)>120)return;
    const c=this.cfg(),text=String(msg.message||'');
    const btn=parseButton(text,c.key);
    let cmd='';
    if(btn){if(!btn.valid){this.log('REMOTE','botón con clave inválida (ignorado)');return;}cmd=btn.c;}
    else{
      const t=parseTyped(text,c.pin);if(!t)return;
      if(!c.pin){this.log('REMOTE','orden escrita sin PIN configurado (ignorada)');return this.publish({title:'Configura un PIN en GEC',message:'Las órdenes escritas necesitan un PIN (pestaña Salida → Control desde el celular). Los botones funcionan igual.'}).catch(()=>{});}
      if(!t.viaPin){this.log('REMOTE','orden escrita sin PIN (ignorada)');return this.publish({title:'Falta el PIN',message:'Escribe la orden con el PIN, por ejemplo: «pausar 1234». O usa los botones.',buttons:['status']}).catch(()=>{});}
      cmd=t.c||'menu';
    }
    if(!KNOWN.has(cmd))return;
    try{await this.run(cmd);}catch(e){this.log('REMOTE_ERROR',`${cmd}: ${e?.message||e}`);this.publish({title:'No se pudo completar la orden',message:String(e?.message||e)}).catch(()=>{});}
  }
  // ---- conexión: stream JSON de los dos temas, con reconexión
  stop(){this.gen++;clearTimeout(this.timer);try{this.ctrl?.abort();}catch{}this.ctrl=null;this.setState({connected:false});}
  start(){
    this.stop();const c=this.cfg();if(!c.enabled||!c.topic)return;
    const gen=this.gen;let wait=3000;this.lastId='';
    const since=()=>this.lastId||String(Math.floor(this.now()/1000));
    const loop=async()=>{
      if(gen!==this.gen)return;
      const ctrl=new AbortController();this.ctrl=ctrl;
      try{
        const url=`${this.base(c)}/${c.topic},${c.topic}-cmd/json?since=${encodeURIComponent(since())}`;
        const r=await this.fetch(url,{headers:this.headers(c),signal:ctrl.signal});
        if(!r.ok)throw new Error(`ntfy respondió ${r.status}${r.status===401||r.status===403?' (revisa el token de acceso)':''}`);
        this.setState({connected:true,error:''});wait=3000;
        const reader=r.body.getReader(),dec=new TextDecoder();let buf='';
        for(;;){
          const {value,done}=await reader.read();if(done)break;
          buf+=dec.decode(value,{stream:true});let i;
          while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!line)continue;let m;try{m=JSON.parse(line);}catch{continue;}await this.handle(m);}
        }
        throw new Error('el servidor cerró la conexión');
      }catch(e){
        if(gen!==this.gen)return;
        this.setState({connected:false,error:String(e?.message||e)});
        this.timer=setTimeout(loop,wait);this.timer.unref?.();wait=Math.min(60000,wait*2);
      }
    };
    loop();
  }
  // ---- avisos automáticos (se llama cada 4 s)
  watch(){
    const st=snapshot(this.api),prev=this.prev;this.prev=st;const c=this.cfg();
    const fail=e=>this.log('REMOTE_ERROR',e?.message||e);
    if(!c.enabled||!c.topic){this.piece=null;return;}
    this.watchStuck(st);this.watchObs();this.watchSchedule();
    if(!prev||c.notifyStart===false)return;
    if(!prev.emissionRunning&&st.emissionRunning)this.panel('▶ Emisión iniciada').catch(fail);
    else if(prev.emissionRunning&&!st.emissionRunning)this.publish({title:'⏹ Emisión detenida',message:describe(st)}).catch(fail);
  }
  // salida trabada: la pieza al aire lleva bastante más de lo que dura (sin contar el tiempo en pausa).
  // Margen amplio: Merlín puede decir una intervención o los titulares (hasta ~60 s) antes de la noticia.
  watchStuck(st){
    const a=this.api?.automation?.()||{},now=this.now(),kind=String(a.currentKind||'none');
    if(!a.emissionRunning||!['news','canned','ad'].includes(kind)){this.piece=null;return;}
    const key=`${kind}:${a.currentItem?.id||a.currentCanned?.path||st.title}`;
    if(!this.piece||this.piece.key!==key){
      const dur=kind==='news'?Number(a.currentItem?.audio?.durationSec||a.currentItem?.result?.durationSec||0):Number(a.currentCanned?.durationSec||0);
      this.piece={key,kind,title:st.title,expected:dur,active:0,last:now,alerts:0};return;
    }
    const p=this.piece;if(!a.emissionPaused)p.active+=Math.max(0,now-p.last);p.last=now;
    if(!(p.expected>0))return;
    const limit=(p.expected*1.1+75)*1000;
    if((p.alerts===0&&p.active>limit)||(p.alerts===1&&p.active>limit+300000)){
      p.alerts++;const what={news:'La noticia',canned:'El contenido',ad:'El anuncio'}[kind];
      const mins=s=>s>=90?`${Math.round(s/60)} min`:`${Math.round(s)} s`;
      this.publish({title:'⚠ La salida parece trabada',message:`${what}${p.title?` «${p.title}»`:''} lleva ${mins(p.active/1000)} al aire y debía durar ~${mins(p.expected)}.\n${describe(st)}`,buttons:['next','screen','status'],priority:5,tags:['warning']})
        .catch(e=>this.log('REMOTE_ERROR',e?.message||e));
      this.log('REMOTE',`aviso: salida trabada (${key})`);
    }
  }
  // transmisión cortada sin que nadie la cortara (GEC, el horario o el control remoto marcan lastObsAction)
  watchObs(){
    const s=global.__gecScheduleLab33;if(!s?.engine)return;
    this.obsTick=(this.obsTick||0)+1;
    const configured=(()=>{try{return fs.existsSync(path.join(this.api.dataDir(),'obs-websocket.json'));}catch{return false;}})();
    if(configured&&this.obsTick%8===0&&s.refreshObs&&!this.obsBusy){this.obsBusy=true;Promise.resolve(s.refreshObs()).catch(()=>{}).finally(()=>{this.obsBusy=false;});}
    const o=s.engine.obsState||{},streaming=!!o.streaming,was=this.obsStreaming;this.obsStreaming=streaming;
    if(was===true&&!streaming&&this.now()-(this.lastObsAction||0)>90000){
      this.publish({title:'⚠ Se cortó la transmisión de YouTube',message:`${o.connected?'OBS dejó de transmitir sin que GEC lo pidiera.':`OBS no responde${o.error?`: ${o.error}`:''}.`}\n${describe(snapshot(this.api))}`,buttons:['obs-start','screen','status'],priority:5,tags:['warning']})
        .catch(e=>this.log('REMOTE_ERROR',e?.message||e));
      this.log('REMOTE','aviso: transmisión cortada');
    }
  }
  // errores del horario automático (por ejemplo, OBS no arrancó a la hora de emitir)
  watchSchedule(){
    const msg=String(global.__gecScheduleLab33?.engine?.message||''),was=this.schedMsg;this.schedMsg=msg;
    if(was===undefined||!msg||msg===was)return;
    const obs=/obs|transmisi|youtube/i.test(msg);
    this.publish({title:obs?'⚠ La transmisión no arrancó':'⚠ Aviso del horario',message:`${msg}\n${describe(snapshot(this.api))}`,buttons:obs?['obs-start','screen','status']:['status'],priority:obs?5:4,tags:['warning']})
      .catch(e=>this.log('REMOTE_ERROR',e?.message||e));
  }
}

// ---------------------------------------------------------------- configuración
const randomTopic=()=>`gec-${crypto.randomBytes(9).toString('hex')}`;
const randomKey=()=>crypto.randomBytes(12).toString('hex');
function readJson(f,fb){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return fb;}}
function writeJson(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});const t=`${f}.tmp-${process.pid}`;fs.writeFileSync(t,JSON.stringify(v,null,2),'utf8');fs.renameSync(t,f);}
function crypt(safeStorage){
  const enc=v=>{if(!v)return'';try{if(safeStorage?.isEncryptionAvailable?.())return'ss:'+safeStorage.encryptString(v).toString('base64');}catch{}return'b64:'+Buffer.from(v,'utf8').toString('base64');};
  const dec=v=>{const s=String(v||'');try{if(s.startsWith('ss:'))return safeStorage.decryptString(Buffer.from(s.slice(3),'base64'));if(s.startsWith('b64:'))return Buffer.from(s.slice(4),'base64').toString('utf8');}catch{}return'';};
  return{enc,dec};
}
const validServer=s=>/^https?:\/\/[^\s/]+(\/[^\s]*)?$/i.test(String(s||''));
const validTopic=s=>/^[A-Za-z0-9_-]{8,64}$/.test(String(s||''));

function installRemoteNtfyLab35({api=globalThis.__gecScheduleApi,electron=null,fetchImpl,startTimer=true}={}){
  if(!api)return null;if(global.__gecRemoteNtfyLab35)return global.__gecRemoteNtfyLab35;
  const {ipcMain,safeStorage}=electron||require('electron');const {enc,dec}=crypt(safeStorage);
  const file=()=>path.join(api.dataDir(),FILE);
  const raw=()=>readJson(file(),{})||{};
  const readConfig=()=>{const v=raw();return{enabled:v.enabled===true,server:String(v.server||DEFAULT_SERVER),topic:String(v.topic||''),key:String(v.key||''),pin:dec(v.pinEnc),token:dec(v.tokenEnc),notifyStart:v.notifyStart!==false};};
  const engine=new RemoteNtfy({api,fetchImpl,readConfig,log:(k,m)=>{try{api.log?.(k,m);}catch{}},onState:s=>{try{api.notify?.('remote:state',s);}catch{}}});
  // primera vez: tema y clave aleatorios (el tema es la "dirección" que se pone en la app ntfy)
  if(!raw().topic||!raw().key){const v=raw();writeJson(file(),{...v,topic:v.topic||randomTopic(),key:v.key||randomKey()});}
  const view=()=>{const c=readConfig();return{ok:true,enabled:c.enabled,server:c.server,topic:c.topic,hasPin:!!c.pin,hasToken:!!c.token,notifyStart:c.notifyStart,state:engine.publicState()};};
  const handle=(k,fn)=>{try{ipcMain.removeHandler(k);}catch{}ipcMain.handle(k,fn);};
  handle('remote:get',()=>view());
  handle('remote:set',async(_e,inc={})=>{
    const cur=raw(),server=String(inc.server||'').trim().replace(/\/+$/,'')||DEFAULT_SERVER,topic=String(inc.topic||cur.topic||'').trim();
    if(!validServer(server))return{ok:false,error:'El servidor debe empezar con https:// (por ejemplo https://ntfy.sh).'};
    if(!validTopic(topic))return{ok:false,error:'El tema debe tener entre 8 y 64 letras, números, guiones o guiones bajos.'};
    const pin=inc.pin==null||inc.pin===''?null:String(inc.pin).trim();
    if(pin!=null&&!/^[0-9A-Za-z]{4,12}$/.test(pin))return{ok:false,error:'El PIN debe tener entre 4 y 12 letras o números, sin espacios.'};
    const next={...cur,enabled:inc.enabled===true,server,topic,key:cur.key||randomKey(),notifyStart:inc.notifyStart!==false,
      pinEnc:inc.clearPin?'':pin!=null?enc(pin):cur.pinEnc||'',tokenEnc:inc.clearToken?'':inc.token?enc(String(inc.token).trim()):cur.tokenEnc||''};
    writeJson(file(),next);engine.start();return view();
  });
  handle('remote:newTopic',()=>{const cur=raw();writeJson(file(),{...cur,topic:randomTopic(),key:randomKey()});engine.start();return view();});
  handle('remote:test',async()=>{try{await engine.panel('✅ GEC conectado',{extra:'Los botones de abajo controlan la emisión.'});return{...view(),ok:true};}catch(e){return{...view(),ok:false,error:String(e?.message||e)};}});
  // cada inicio o corte de OBS pedido desde GEC (panel, horario o este control) no cuenta como "se cortó solo"
  const ops=global.__gecScheduleLab33?.obsOps;
  if(ops&&!ops.__gecLab35){for(const k of ['start','stop']){const base=ops[k];if(typeof base==='function')ops[k]=function(...x){engine.lastObsAction=engine.now();return base.apply(this,x);};}Object.defineProperty(ops,'__gecLab35',{value:true});}
  if(startTimer){setTimeout(()=>engine.start(),6000).unref?.();const t=setInterval(()=>{try{engine.watch();}catch{}},4000);t.unref?.();}
  global.__gecRemoteNtfyLab35={engine,readConfig};
  return global.__gecRemoteNtfyLab35;
}

module.exports={installRemoteNtfyLab35,RemoteNtfy,parseTyped,parseButton,panelButtons,describe,snapshot,validServer,validTopic,LABEL};
