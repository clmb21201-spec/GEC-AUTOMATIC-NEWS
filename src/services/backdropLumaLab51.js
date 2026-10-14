'use strict';
// Lab.51 · Qué tan clara es la foto de cada nota, para que la salida oscurezca el fondo lo justo y el texto se lea
// (Noticias con movimiento, «Oscurecer fondo» en automático). La salida no puede leer los píxeles de una foto de otro
// sitio (CORS), así que se la pide al proceso principal: IPC output:imageLuma(url) → {all, left, bottom} en 0–1
// (luminancia de toda la foto, de la mitad izquierda donde va el texto del plano con recuadro, y del tercio inferior).
// Descarga con 4 s de espera y hasta 15 MB; caché de 200 fotos. Si no se puede (formato raro, sin red) → null y la
// salida usa un oscurecimiento seguro.
const fs=require('fs');
const {fileURLToPath}=require('url');

const VERSION='lab51-backdrop-1';
const cache=new Map();
const MAX_BYTES=15*1024*1024;

// bitmap BGRA (nativeImage.toBitmap) → luminancias promedio
function lumaFromBitmap(buf,w,h){
  if(!buf||!w||!h)return null;
  const zone=(x0,x1,y0,y1)=>{let t=0,n=0;for(let y=Math.floor(y0*h);y<Math.ceil(y1*h);y++)for(let x=Math.floor(x0*w);x<Math.ceil(x1*w);x++){const i=(y*w+x)*4;if(i+2>=buf.length)continue;const b=buf[i],g=buf[i+1],r=buf[i+2];t+=(0.2126*r+0.7152*g+0.0722*b)/255;n++;}return n?+(t/n).toFixed(3):null;};
  return{all:zone(0,1,0,1),left:zone(0,.55,0,1),bottom:zone(0,1,.6,1)};
}
async function readBuffer(url){
  const u=String(url||'');
  if(/^data:/i.test(u)){const m=u.match(/^data:[^;,]*(;base64)?,(.*)$/s);if(!m)return null;return m[1]?Buffer.from(m[2],'base64'):Buffer.from(decodeURIComponent(m[2]));}
  if(/^file:/i.test(u))return fs.promises.readFile(fileURLToPath(u));
  if(!/^https?:/i.test(u))return null;
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),4000);
  try{
    const r=await fetch(u,{signal:ctl.signal,headers:{'user-agent':'Mozilla/5.0 GEC'}});if(!r.ok)return null;
    const len=Number(r.headers.get('content-length')||0);if(len>MAX_BYTES)return null;
    const ab=await r.arrayBuffer();return ab.byteLength>MAX_BYTES?null:Buffer.from(ab);
  }finally{clearTimeout(t);}
}
async function measure(url,{nativeImage}={}){
  const key=String(url||'');if(!key)return null;
  if(cache.has(key))return cache.get(key);
  const job=(async()=>{
    try{
      const buf=await readBuffer(key);if(!buf||!nativeImage)return null;
      const img=nativeImage.createFromBuffer(buf);if(!img||img.isEmpty())return null;
      const sm=img.resize({width:48,quality:'good'}),{width,height}=sm.getSize();
      return lumaFromBitmap(sm.toBitmap(),width,height);
    }catch{return null;}
  })();
  cache.set(key,job);if(cache.size>200)cache.delete(cache.keys().next().value);
  return job;
}
function installBackdropLumaLab51({electron=null}={}){
  if(global.__gecBackdropLumaLab51)return false;global.__gecBackdropLumaLab51=true;
  const {ipcMain,nativeImage}=electron||require('electron');
  try{ipcMain.removeHandler('output:imageLuma');}catch{}
  ipcMain.handle('output:imageLuma',(_e,url)=>measure(url,{nativeImage}));
  return true;
}
module.exports={VERSION,lumaFromBitmap,measure,installBackdropLumaLab51};
