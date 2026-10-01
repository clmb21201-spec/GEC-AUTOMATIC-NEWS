'use strict';
// Verifica que la salida de Merlín esté completa y respete el contrato de output.js.
const fs=require('fs'),path=require('path'),src=path.join(__dirname,'..','src');
const must=['assets/merlin/presenter-phrases.json','output-merlin.html','output-merlin-web.html','output-merlin.js','output-merlin.css','renderer-merlin.js','vendor/three/three.min.js','vendor/three/GLTFLoader.js','vendor/three/RoomEnvironment.js','assets/merlin/merlin-model.js','assets/merlin/presenter-config.js','assets/merlin/fondo.jpg','assets/merlin/silla.webp','assets/merlin/mesa.webp','assets/merlin/mic.webp','assets/merlin/vasos.webp'];
for(const f of must)if(!fs.existsSync(path.join(src,f)))throw new Error('Falta '+f);
const js=fs.readFileSync(path.join(src,'output-merlin.js'),'utf8');
for(const k of ["'output:story'","'output:design'","'output:control'","outputPlayback","p.audioUrl","p.title","p.summary","p.image","p.videoUrl"])if(!js.includes(k))throw new Error('output-merlin.js no maneja '+k);
const main=fs.readFileSync(path.join(src,'main.js'),'utf8');if(!main.includes('outputPageFile()')||!main.includes("'presenter:set'"))throw new Error('main.js sin selector de presentador');
const pre=fs.readFileSync(path.join(src,'preload.js'),'utf8');if(!pre.includes("page==='output-merlin.html'"))throw new Error('preload.js no expone ECAPI a output-merlin.html');
const lan=fs.readFileSync(path.join(src,'services','outputLanServer.js'),'utf8');if(!lan.includes("'/merlin'"))throw new Error('outputLanServer.js sin ruta /merlin');
const cfg=fs.readFileSync(path.join(src,'assets','merlin','presenter-config.js'),'utf8');const sandbox={window:{}};try{require('vm').runInNewContext(cfg,sandbox);}catch(e){throw new Error('presenter-config.js tiene un error de sintaxis (¿llaves de más al pegar?): '+e.message);}const mc=sandbox.window.MERLIN_CONFIG;if(!mc||typeof mc!=='object'||!mc.escena||!mc.camaras)throw new Error('presenter-config.js no define MERLIN_CONFIG con escena y camaras');
const ph=JSON.parse(fs.readFileSync(path.join(src,'assets','merlin','presenter-phrases.json'),'utf8'));for(const k of ['intro','pase','regreso','despedida'])if(!Array.isArray(ph[k])||!ph[k].length)throw new Error('presenter-phrases.json sin frases de '+k);
if(!main.includes("ipcMain.on('presenter:hostPlayback'")||!main.includes('presenterHost.deliver'))throw new Error('main.js sin director de intervenciones de Merlín');
if(!js.includes("p.kind === 'host'")||!js.includes('presenterHostPlayback'))throw new Error('output-merlin.js no maneja intervenciones (host)');
if(!pre.includes("presenterHostPlayback"))throw new Error('preload.js sin presenterHostPlayback');
if(!js.includes('standbyVideoUrl'))throw new Error('output-merlin.js sin video de espera');
console.log('check-merlin-output OK · salida · selector · LAN · config · espera · intervenciones');
