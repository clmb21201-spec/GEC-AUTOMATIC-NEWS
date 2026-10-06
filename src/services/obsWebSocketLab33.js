'use strict';
// Lab.33 · Cliente mínimo de obs-websocket v5 (incluido en OBS 28+): conectar, identificarse (con contraseña) y pedir
// GetStreamStatus / StartStream / StopStream. Usa el WebSocket nativo de Node (Electron 43 trae Node 24); sin dependencias.
const crypto=require('crypto');

const sha256b64=s=>crypto.createHash('sha256').update(s).digest('base64');
// autenticación de obs-websocket v5: base64(sha256(base64(sha256(password + salt)) + challenge))
function authString(password,salt,challenge){return sha256b64(sha256b64(String(password||'')+salt)+challenge);}

function friendlyError(e,url){
  const m=String(e?.message||e||'');
  if(/auth|4009|Authentication/i.test(m))return'La contraseña de OBS no es correcta (Herramientas → Configuración del servidor WebSocket → Mostrar información de conexión).';
  if(/ECONNREFUSED|connect|failed|closed before/i.test(m))return`OBS no responde en ${url}. Abre OBS y activa Herramientas → Configuración del servidor WebSocket.`;
  if(/timeout|tiempo/i.test(m))return`OBS no contestó a tiempo en ${url}.`;
  return m||'Error desconocido con OBS';
}

// Abre una sesión, ejecuta fn(request) y cierra. Cada operación es corta y no deja conexiones abiertas.
function withObs({url='ws://127.0.0.1:4455',password='',timeoutMs=6000,WebSocketImpl=globalThis.WebSocket}={},fn){
  return new Promise((resolve,reject)=>{
    if(typeof WebSocketImpl!=='function')return reject(new Error('WebSocket no disponible en este runtime'));
    let ws,done=false,seq=0;const pending=new Map();
    const finish=(err,val)=>{if(done)return;done=true;clearTimeout(timer);for(const p of pending.values())p.reject(new Error('conexión cerrada'));pending.clear();try{ws&&ws.close();}catch{}err?reject(new Error(friendlyError(err,url))):resolve(val);};
    const timer=setTimeout(()=>finish(new Error('timeout')),timeoutMs);
    try{ws=new WebSocketImpl(url,'obswebsocket.json');}catch(e){return finish(e);}
    const send=o=>ws.send(JSON.stringify(o));
    const request=(requestType,requestData)=>new Promise((res,rej)=>{const requestId=`gec-${++seq}`;pending.set(requestId,{resolve:res,reject:rej,requestType});send({op:6,d:{requestType,requestId,...(requestData?{requestData}:{})}});});
    ws.onerror=e=>finish(e?.error||e?.message?e:new Error('connect failed'));
    ws.onclose=e=>{if(!done)finish(new Error(Number(e?.code)===4009?'Authentication failed (4009)':`closed before ready (${e?.code||''})`));};
    ws.onmessage=ev=>{
      let msg;try{msg=JSON.parse(typeof ev.data==='string'?ev.data:String(ev.data));}catch{return;}
      if(msg.op===0){const a=msg.d?.authentication;send({op:1,d:{rpcVersion:1,eventSubscriptions:0,...(a?{authentication:authString(password,a.salt,a.challenge)}:{})}});}
      else if(msg.op===2){Promise.resolve().then(()=>fn(request)).then(v=>finish(null,v),e=>finish(e));}
      else if(msg.op===7){const d=msg.d||{},p=pending.get(d.requestId);if(!p)return;pending.delete(d.requestId);
        const st=d.requestStatus||{};if(st.result)p.resolve(d.responseData||{});else{const e=new Error(`${p.requestType}: ${st.comment||st.code||'falló'}`);e.code=st.code;p.reject(e);}}
    };
  });
}

// códigos de obs-websocket: 500 = la salida ya está activa, 501 = la salida no está activa (no son errores reales)
const OUTPUT_RUNNING=500,OUTPUT_NOT_RUNNING=501;
async function streamStatus(opts){return withObs(opts,async req=>{const s=await req('GetStreamStatus');let version='';try{version=(await req('GetVersion')).obsVersion||'';}catch{}return{connected:true,streaming:!!s.outputActive,reconnecting:!!s.outputReconnecting,timecode:String(s.outputTimecode||''),obsVersion:version};});}
async function startStream(opts){return withObs(opts,async req=>{const s=await req('GetStreamStatus');if(s.outputActive)return{started:false,alreadyStreaming:true};try{await req('StartStream');}catch(e){if(e.code!==OUTPUT_RUNNING)throw e;}return{started:true};});}
async function stopStream(opts){return withObs(opts,async req=>{const s=await req('GetStreamStatus');if(!s.outputActive)return{stopped:false,notStreaming:true};try{await req('StopStream');}catch(e){if(e.code!==OUTPUT_NOT_RUNNING)throw e;}return{stopped:true};});}

module.exports={withObs,streamStatus,startStream,stopStream,authString,friendlyError};
