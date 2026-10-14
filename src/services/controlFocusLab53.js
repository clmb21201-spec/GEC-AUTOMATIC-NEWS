'use strict';
// Lab.53 · El panel no dejaba escribir (por ejemplo, en «+ Añadir pronunciación») mientras la ventana OUTPUT había
// quedado con el teclado: Windows activa el panel al hacer clic, pero Electron a veces no le devuelve el teclado a la
// página. La regla de 0329 (ui:focusControl y browser-window-focus) elegía «la primera ventana que no dice OUTPUT en el
// título», que también puede ser la ventana oculta de NDI. Ahora:
//   - ui:focusControl busca el panel por su página (control.html) y le devuelve el teclado sin cambiar su tamaño;
//   - al activarse el panel se le devuelve el teclado dos veces (en el acto y 120 ms después);
//   - el panel (renderer-focus-lab53.js) lo pide solo si haces clic en una casilla sin tener el teclado.
// La ventana OUTPUT no se toca: si se la obligara a soltar el teclado, el panel saltaría encima al hacerle clic.
const {app,ipcMain,BrowserWindow}=require('electron');

const VERSION='lab53-focus-1';
const isControlPage=w=>{try{return !!w&&!w.isDestroyed()&&/control\.html/i.test(w.webContents.getURL()||'');}catch{return false;}};
function controlWindow(){return BrowserWindow.getAllWindows().find(isControlPage)||null;}
function focusControl(){
  const w=controlWindow();if(!w)return{ok:false};
  try{if(w.isMinimized())w.restore();if(!w.isVisible())w.show();w.focus();w.webContents.focus();return{ok:true};}catch{return{ok:false};}
}
function installControlFocusLab53(){
  if(global.__gecControlFocusLab53)return false;global.__gecControlFocusLab53=true;
  try{ipcMain.removeHandler('ui:focusControl');}catch{}
  ipcMain.handle('ui:focusControl',()=>focusControl());
  app.on('browser-window-focus',(_,w)=>{if(!isControlPage(w))return;const f=()=>{try{if(w.isFocused())w.webContents.focus();}catch{}};setTimeout(f,0);setTimeout(f,120);});
  return true;
}
module.exports={VERSION,isControlPage,focusControl,installControlFocusLab53};
