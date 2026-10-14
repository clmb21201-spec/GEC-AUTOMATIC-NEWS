'use strict';
// Lab.53 · el panel recupera el teclado aunque la ventana OUTPUT (u otra) haya quedado activa.
const Module=require('module'),path=require('path'),fs=require('fs'),assert=require('assert');
let checks=0;const ok=(v,m)=>{checks++;assert.ok(v,m);};
const handlers=new Map(),appEvents={};
function win(url,title){const w={url,title,focused:false,visible:true,minimized:false,calls:[],destroyed:false,
  isDestroyed(){return this.destroyed;},getTitle(){return this.title;},isFocused(){return this.focused;},isVisible(){return this.visible;},isMinimized(){return this.minimized;},
  restore(){this.minimized=false;this.calls.push('restore');},show(){this.visible=true;this.calls.push('show');},focus(){this.focused=true;this.calls.push('focus');},
  webContents:{getURL:()=>url,focus(){w.calls.push('wc.focus');}}};return w;}
const ndi=win('file:///app/src/output-ndi.html',''),control=win('file:///app/src/control.html','EC Automatic News'),output=win('file:///app/src/output.html','EC Automatic News — OUTPUT');
const windows=[ndi,output,control];
const base=Module._load;
Module._load=function(r,p,m){if(r==='electron')return{app:{on:(e,f)=>(appEvents[e]=appEvents[e]||[]).push(f)},ipcMain:{handle:(k,f)=>handlers.set(k,f),removeHandler:k=>handlers.delete(k)},BrowserWindow:{getAllWindows:()=>windows}};return base.call(this,r,p,m);};
const F=require(path.join(__dirname,'..','src','services','controlFocusLab53'));
(async()=>{
  ok(F.installControlFocusLab53()&&!F.installControlFocusLab53(),'se instala una sola vez');
  // la ventana oculta de NDI no dice OUTPUT en el título: antes podía tomarse por el panel
  control.minimized=true;const r=await handlers.get('ui:focusControl')();
  ok(r.ok&&control.calls.join(',')==='restore,focus,wc.focus','devuelve el teclado al panel (control.html), no a NDI');
  ok(ndi.calls.length===0&&output.calls.length===0,'NDI y OUTPUT no se tocan');
  // al activarse el panel: teclado a la página, en el acto y 120 ms después
  control.calls=[];control.focused=true;for(const f of appEvents['browser-window-focus'])f({},control);
  await new Promise(r=>setTimeout(r,200));ok(control.calls.filter(x=>x==='wc.focus').length===2,'al activarse el panel, dos veces');
  output.focused=true;for(const f of appEvents['browser-window-focus'])f({},output);await new Promise(r=>setTimeout(r,200));ok(output.calls.length===0,'la ventana OUTPUT no se toca');
  // panel: inyectado y con la condición correcta
  const src=path.join(__dirname,'..','src'),pre=fs.readFileSync(path.join(src,'preload.js'),'utf8'),rd=fs.readFileSync(path.join(src,'renderer-focus-lab53.js'),'utf8');
  ok(/injectAsset\('script',\{src:'renderer-focus-lab53\.js'\}\)/.test(pre),'preload inyecta el script del panel');
  ok(/document\.hasFocus\(\)/.test(rd)&&/api\.focusControl\(\)/.test(rd)&&/'pointerdown'/.test(rd),'al hacer clic en una casilla sin teclado lo pide');
  ok(/controlFocusLab53'\)\.installControlFocusLab53\(\)/.test(fs.readFileSync(path.join(src,'bootstrap-v2lab.js'),'utf8')),'bootstrap instala Lab.53');
  console.log(`check-control-focus-lab53 OK (${checks} verificaciones) · teclado al panel con la salida activa`);
})().catch(e=>{console.error('check-control-focus-lab53: '+(e.stack||e.message));process.exit(1);});
