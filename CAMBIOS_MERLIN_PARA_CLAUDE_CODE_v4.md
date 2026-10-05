# GEC Automatic News · Merlín: cambios para aplicar (v4)

Responde siempre en español. Lee primero `CLAUDE.md` e `INTEGRACION_MERLIN.md`.

Este documento deja el repo con **todo lo aprobado para Merlín** hasta hoy. Es acumulativo: reemplaza a los documentos anteriores, así que puedes aplicarlo aunque esos no se hayan aplicado o hayan quedado a medias.

## Qué incluye

**Ya implementado (este documento trae el código):**
1. **Video de espera** igual que la salida clásica.
2. **Intervenciones de Merlín** con frases fijas: presentación, pase a corte, regreso y despedida. Al **Detener emisión** con una noticia al aire, Merlín la termina, se despide y pasa a espera; con enlatado o anuncio, corta y se despide.
3. **Cintillo unificado** (plano medio y pantalla completa): pestaña con sección y exclusivo vinculada a **Diseño** de EC1 (colores, opacidad, borde, radio, tipografía, tamaño, peso, texto y visibilidad) y titular centrado. Sin bajada en pantalla completa.
4. **Subtítulos** en caja propia encima del cintillo, con el texto exacto del guion (`p.script`) y resaltado de palabras dichas.
5. **Reloj** arriba a la derecha (hora de la PC, formato `8:45 PM`), oculto en enlatados, anuncios y espera.
6. **Recuadro de imagen** en su posición configurada; sube lo justo si hay subtítulos y nunca toca el reloj. Queda debajo de la pantalla completa (no vuelve a entrar al regresar al plano medio).
7. **Plano medio** con Merlín centrado en el espacio libre a la izquierda del recuadro.
8. **Cámara**: movimiento suave al cambiar de plano a la vista; acercamiento lento dentro del plano; sin reescalado si el plano no cambia; cambios instantáneos solo con la pantalla totalmente cubierta. La noticia vuelve de pantalla completa a plano medio **2 s antes del final**, y no se abre una pantalla completa de menos de 4 s.
9. **Pausa entre noticias** de EC1: Merlín sigue en el mismo plano y el cintillo cambia el texto con un fundido.
10. **Movimiento de imágenes** igual que la salida clásica (**Diseño → Animación** y **Velocidad**).
11. **Expresión según el tono** (`p.tone`): serio, neutral o ligero; cejas opcionales (`CEJA_L`/`CEJA_R`) si el modelo las trae.
12. **Volumen normalizado** de las voces (noticias, intervenciones, titulares) con `p.audioGainDb`.
13. **Titulares periódicos** cada 25 min (configurable) con los titulares reales de las próximas noticias listas.
14. **Modelo nuevo y animación orgánica:** rig ampliado (pecho, cejas, sombrero articulado, plumas, insignia), cejas y sombrero con movimiento propio, plumas vivas, mirada y pausas naturales, **saludo con el ala** en la presentación y la despedida, **parallax** del set y párpados de color sólido. Todo está en los archivos de la sección 1.

**Por implementar (instrucciones al final, sección 6):**
- A. Que la IA editorial devuelva el **tono** de cada noticia y llegue a la salida como `p.tone`.
- B. Medir el volumen de **enlatados y anuncios** y enviarlo como `p.audioGainDb`.

## Reglas

- No modificar la salida clásica (`output.html` y sus versionados).
- Los archivos de la sección 1 son exclusivos de Merlín: **reemplázalos completos**.
- En `src/main.js`, `src/preload.js`, `src/services/outputLanServer.js` y `package.json` aplica **solo** lo indicado, sin tocar el resto.
- Trabaja en una rama y abre una pull request; al final corre las verificaciones de la sección 7.

---

## 1. Archivos de Merlín (ya subidos al repo)

Los archivos exclusivos de Merlín ya fueron subidos completos al repo desde un ZIP, en su versión final: `src/output-merlin.html`, `src/output-merlin-web.html`, `src/output-merlin.css`, `src/output-merlin.js`, `src/renderer-merlin.js`, `src/assets/merlin/` (incluye `merlin-model.js` con el modelo nuevo, `presenter-config.js` y `presenter-phrases.json`), `src/vendor/three/`, `scripts/check-merlin-output.js`, `INTEGRACION_MERLIN.md` y `CLAUDE.md`. **No los modifiques**; solo verifica que estén. Las secciones siguientes son los cambios en archivos generales de EC1 que todavía hay que aplicar.

---

## 2. `src/main.js`

### 2a. Cargar la página según el modo (si no está hecho)

Debe existir `outputWindow.loadFile(path.join(__dirname,outputPageFile()))` en `createOutputWindow`. Si todavía dice `outputWindow.loadFile(path.join(__dirname,'output.html'))`, reemplázalo.

### 2b. Bloque "modo de salida" (si no existe)

Si en `main.js` no está el bloque que empieza con `// ---- Presentador Merlín: modo de salida`, agrégalo al final del archivo. Si ya existe, reemplázalo por este (agrega la pregeneración de frases al activar Merlín):

```javascript
// ---- Presentador Merlín: modo de salida (clásico | merlin), guardado aparte para no interferir con el formulario de diseño
function presenterFile(){try{return path.join(dataDir||portableDataDir(),'presenter.json');}catch{return path.join(app.getPath('userData'),'presenter.json');}}
function readPresenter(){try{const v=JSON.parse(fs.readFileSync(presenterFile(),'utf8'));return{mode:v&&v.mode==='merlin'?'merlin':'clasico'};}catch{return{mode:'clasico'};}}
function outputPageFile(){const d=currentDesign?.()||{};if(d.format==='9:16')return'output.html';return readPresenter().mode==='merlin'?'output-merlin.html':'output.html';}
ipcMain.handle('presenter:get',()=>readPresenter());
ipcMain.handle('presenter:set',async(_,mode)=>{const next={mode:mode==='merlin'?'merlin':'clasico'};try{fs.mkdirSync(path.dirname(presenterFile()),{recursive:true});fs.writeFileSync(presenterFile(),JSON.stringify(next,null,2),'utf8');}catch(e){logEvent('PRESENTER_SAVE',e.message||e);throw e;}
  logEvent('PRESENTER_MODE',next.mode);let reopened=false;if(next.mode==='merlin')setTimeout(()=>presenterHost.ensureClips().catch(()=>{}),1500);
  if(outputReady()){try{outputWindow.loadFile(path.join(__dirname,outputPageFile()));reopened=true;}catch(e){logEvent('PRESENTER_RELOAD',e.message||e);}}
  return{...next,reopened};});
```

### 2c. Bloque "intervenciones" (reemplazar completo)

Reemplaza **todo** desde `// ---- Presentador Merlín: intervenciones` hasta el final del archivo por el siguiente bloque (si no existe, agrégalo al final, después del 2b). Envuelve `deliverToOutput` y `controlOutput` al cargar el módulo, antes de que se construya `AutomationEngine`.

```javascript
// ---- Presentador Merlín: intervenciones con frases fijas (presentación, pase a corte, regreso y despedida).
// Solo actúa en modo Merlín y con la emisión automática; la salida clásica no recibe estas piezas (se omiten).
const presenterHost=(()=>{
  const crypto=require('crypto'),{pathToFileURL:toUrl,fileURLToPath}=require('url'),SEGS=['intro','pase','regreso','despedida'];
  let phrases=null,durations={},generating=null,lastIdx={},started=false,lastKind='none',pending=null,pendingTimer=null,farewellPending=false,stopPatched=false,stopping=false,stopTimer=null,suppressStop=false;
  function loadPhrases(){if(phrases)return phrases;try{const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'assets','merlin','presenter-phrases.json'),'utf8'));phrases={};for(const k of [...SEGS,'titulares_intro'])phrases[k]=(Array.isArray(raw[k])?raw[k]:[]).map(x=>String(x||'').trim()).filter(Boolean);}catch(e){logEvent('PRESENTER_PHRASES',e.message||e);phrases={intro:[],pase:[],regreso:[],despedida:[],titulares_intro:[]};}return phrases;}
  // ---- configuración de Merlín (mismo archivo que usa la salida)
  let cfgCache=null;
  function presenterCfg(){if(cfgCache)return cfgCache;try{const sb={window:{}};require('vm').runInNewContext(fs.readFileSync(path.join(__dirname,'assets','merlin','presenter-config.js'),'utf8'),sb);cfgCache=sb.window.MERLIN_CONFIG||{};}catch(e){logEvent('PRESENTER_CFG',e.message||e);cfgCache={};}return cfgCache;}
  // ---- WAV PCM (las voces del TTS local): medir volumen percibido y unir audios
  function readWav(file){const b=fs.readFileSync(file);if(b.length<44||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE')return null;let o=12,fmt=null,data=null;
    while(o+8<=b.length){const id=b.toString('ascii',o,o+4),sz=b.readUInt32LE(o+4),st=o+8;if(id==='fmt ')fmt={format:b.readUInt16LE(st),channels:b.readUInt16LE(st+2),rate:b.readUInt32LE(st+4),bits:b.readUInt16LE(st+14),raw:b.subarray(st,st+sz)};else if(id==='data'){data=b.subarray(st,Math.min(b.length,st+sz));break;}o=st+sz+(sz%2);}
    return fmt&&data?{fmt,data}:null;}
  const gains=new Map();
  // nivel RMS de los tramos con voz (se ignoran silencios) → ganancia para llevarlo al objetivo (dBFS), limitada a -12..+6 dB
  function gainDbFor(file){if(!file)return 0;if(gains.has(file))return gains.get(file);let g=0;try{const w=readWav(file);if(w&&w.fmt.bits===16){const d=w.data,n=Math.floor(d.length/2),block=Math.max(1,Math.floor(w.fmt.rate*w.fmt.channels*.05));let sum=0,cnt=0,bs=0,bc=0;
      for(let i=0;i<n;i++){const v=d.readInt16LE(i*2)/32768;bs+=v*v;bc++;if(bc>=block){if(Math.sqrt(bs/bc)>.01){sum+=bs;cnt+=bc;}bs=0;bc=0;}}
      if(cnt){const target=Number(presenterCfg().volumen?.objetivoDb??-20),rmsDb=20*Math.log10(Math.sqrt(sum/cnt));g=Math.max(-12,Math.min(6,target-rmsDb));}}}catch(e){logEvent('PRESENTER_GAIN',e.message||e);}
    g=Math.round(g*10)/10;gains.set(file,g);if(gains.size>400)gains.delete(gains.keys().next().value);return g;}
  const fileOf=url=>{try{return String(url||'').startsWith('file:')?fileURLToPath(url):'';}catch{return '';}};
  function concatWavs(files,out){const ws=files.map(readWav);if(ws.some(w=>!w))throw new Error('audio no es WAV PCM');const f=ws[0].fmt;
    if(ws.some(w=>w.fmt.rate!==f.rate||w.fmt.channels!==f.channels||w.fmt.bits!==f.bits))throw new Error('formatos de WAV distintos');
    const bps=f.rate*f.channels*f.bits/8,starts=[];let acc=0;for(const w of ws){starts.push(acc/bps);acc+=w.data.length;}starts.push(acc/bps);
    const head=Buffer.alloc(12+8+f.raw.length+8);head.write('RIFF',0,'ascii');head.writeUInt32LE(4+8+f.raw.length+8+acc,4);head.write('WAVE',8,'ascii');head.write('fmt ',12,'ascii');head.writeUInt32LE(f.raw.length,16);f.raw.copy(head,20);head.write('data',20+f.raw.length,'ascii');head.writeUInt32LE(acc,24+f.raw.length);
    fs.writeFileSync(out,Buffer.concat([head,...ws.map(w=>w.data)]));return starts;}
  // ---- titulares periódicos: entrada fija + titulares reales de las próximas noticias listas en la cola
  let lastTit=0,titPrep=null,titReady=null;
  const titEveryMs=()=>Math.max(0,Number(presenterCfg().titulares?.cadaMinutos??25))*60000,titCount=()=>Math.max(2,Math.min(5,Number(presenterCfg().titulares?.cantidad??3)));
  function upcoming(){return (automation?.queue||[]).filter(x=>x.status==='LISTA'&&x.result?.title).slice(0,titCount()).map(x=>({title:x.result.title,category:x.result.category||x.story?.category||'',isExclusive:!!(x.result?.isExclusive||x.isExclusive),image:x.image||x.fallback||''}));}
  function pickText(key){const list=loadPhrases()[key]||[];return list.length?list[Math.floor(Math.random()*list.length)]:'';}
  function prepareTitulares(){if(titPrep)return titPrep;titPrep=(async()=>{const items=upcoming();if(items.length<2)return null;const s=settingsStore.load(),texts=[pickText('titulares_intro')||'Estos son los titulares de esta hora.',...items.map(x=>x.title)],parts=[];
      for(const t of texts){let spoken=t;try{const loc=await pronunciation?.normalize?.(t,{smart:s.tts?.pronunciationSmart!==false});if(loc?.text)spoken=loc.text;}catch{}const a=await kokoro.generate(spoken,{voice:s.tts.voice,speed:s.tts.speed});if(!a?.path)throw new Error('el TTS no devolvió audio');parts.push(a.path);}
      fs.mkdirSync(cacheDir(),{recursive:true});const out=path.join(cacheDir(),`titulares-${Date.now()}.wav`),starts=concatWavs(parts,out);try{for(const f of fs.readdirSync(cacheDir()))if(/^titulares-\d+\.wav$/.test(f)&&path.join(cacheDir(),f)!==out&&path.join(cacheDir(),f)!==titReady?.file)fs.unlinkSync(path.join(cacheDir(),f));}catch{}for(const p of parts)try{kokoro.cleanupAudio?.(p);}catch{}gains.delete(out);
      titReady={file:out,items,text:texts.join(' '),introSec:starts[1],marks:starts.slice(1,-1),durationSec:starts[starts.length-1],at:Date.now()};return titReady;
    })().catch(e=>{logEvent('PRESENTER_TITULARES',e.message||e);return null;}).finally(()=>{titPrep=null;});return titPrep;}
  function cacheDir(){try{return path.join(dataDir||portableDataDir(),'presenter-voice');}catch{return path.join(app.getPath('userData'),'presenter-voice');}}
  function voiceKey(){const s=settingsStore?.load?.()||{};return JSON.stringify({voice:s.tts?.voice||'',speed:s.tts?.speed||1,engine:s.tts?.engine||s.tts?.primaryEngine||''});}
  function fileFor(text){return path.join(cacheDir(),crypto.createHash('sha1').update(voiceKey()+'|'+text).digest('hex').slice(0,16)+'.wav');}
  const ready=f=>{try{return fs.statSync(f).size>1000;}catch{return false;}};
  const active=()=>{try{return readPresenter().mode==='merlin'&&(currentDesign?.()||{}).format!=='9:16';}catch{return false;}};
  async function ensureClips(){if(generating)return generating;if(!kokoro||!settingsStore)return;generating=(async()=>{const ph=loadPhrases();fs.mkdirSync(cacheDir(),{recursive:true});
    for(const seg of SEGS)for(const text of ph[seg]){const f=fileFor(text);if(ready(f))continue;
      try{const s=settingsStore.load(),a=await kokoro.generate(text,{voice:s.tts.voice,speed:s.tts.speed});if(a?.path&&fs.existsSync(a.path)){fs.copyFileSync(a.path,f);durations[f]=Number(a.durationSec)||0;try{kokoro.cleanupAudio?.(a.path);}catch{}}}
      catch(e){logEvent('PRESENTER_TTS',`${seg}: ${e.message||e}`);}}
  })().finally(()=>{generating=null;});return generating;}
  function pick(seg){const list=(loadPhrases()[seg]||[]).map((text,i)=>({text,i,file:fileFor(text)})).filter(x=>ready(x.file));if(!list.length)return null;
    let opts=list.filter(x=>x.i!==lastIdx[seg]);if(!opts.length)opts=list;const c=opts[Math.floor(Math.random()*opts.length)];lastIdx[seg]=c.i;return{...c,durationSec:durations[c.file]||0};}
  function clearPending(){clearTimeout(pendingTimer);pendingTimer=null;const p=pending;pending=null;return p;}
  function finish(reason){const p=clearPending();if(p?.after)try{p.after(reason);}catch(e){logEvent('PRESENTER_AFTER',e.message||e);}}
  function playHost(seg,origDeliver,after){const clip=pick(seg);if(!clip){ensureClips().catch(()=>{});return false;}
    const ok=origDeliver({kind:'host',segment:seg,title:'',summary:'',audioUrl:toUrl(clip.file).href,audioDurationSec:clip.durationSec,hostText:clip.text,audioGainDb:gainDbFor(clip.file)},'automatic',false);
    if(!ok)return false;pending={after};pendingTimer=setTimeout(()=>finish('timeout'),Math.min(16000,Math.max(5000,((clip.durationSec||9)+4)*1000)));logEvent('PRESENTER_HOST',`${seg}: ${clip.text}`);return true;}
  function notice(text){try{automation?.state?.({notice:text});}catch{}}
  function farewell(origDeliver,origControl){stopping=false;clearTimeout(stopTimer);stopTimer=null;started=false;lastKind='none';
    if(!playHost('despedida',origDeliver,()=>origControl('stop')))origControl('stop');}
  // Detener emisión en modo Merlín: si hay una noticia al aire, termina de contarla, se despide y pasa al video de espera.
  // Si hay un enlatado o anuncio (o una intervención en curso), se corta y se despide de inmediato.
  function patchStop(origDeliver,origControl){if(stopPatched||!automation||typeof automation.stopEmission!=='function')return;stopPatched=true;
    const origStop=automation.stopEmission.bind(automation),origStart=typeof automation.startEmission==='function'?automation.startEmission.bind(automation):null;
    automation.stopEmission=function(...args){
      if(!active()||!started||stopping)return origStop(...args);
      const newsOnAir=automation.currentKind==='news'&&!pending;
      if(newsOnAir){stopping=true;suppressStop=true;let r;try{r=origStop(...args);}finally{suppressStop=false;}
        const prog=currentOutputProgram||{},left=Math.max(0,(Number(prog.durationSec)||0)-(Number(prog.currentSec)||0));
        clearTimeout(stopTimer);stopTimer=setTimeout(()=>{if(stopping)farewell(origDeliver,origControl);},Math.min(5*60000,Math.max(20000,(left||120)*1000+10000)));
        logEvent('PRESENTER_STOP','esperando el final de la noticia actual');setTimeout(()=>notice('Deteniendo: Merlín termina la noticia actual y se despide.'),50);return r;}
      if(pending)clearPending();farewellPending=true;const r=origStop(...args);
      if(farewellPending){farewellPending=false;farewell(origDeliver,origControl);}return r;};
    if(origStart)automation.startEmission=function(...args){if(stopping){stopping=false;clearTimeout(stopTimer);stopTimer=null;logEvent('PRESENTER_STOP','cancelado: la emisión se reanudó');}return origStart(...args);};
    ipcMain.on('output:playback',(_,ev)=>{if(stopping&&ev&&(ev.type==='ended'||ev.type==='error'))farewell(origDeliver,origControl);});}
  function deliver(payload,source,autoOpen,origDeliver,origControl){
    if(source!=='automatic'||!active()||payload?.kind==='host')return origDeliver(payload,source,autoOpen);
    patchStop(origDeliver,origControl);if(pending)finish('superseded');
    const kind=payload?.mediaRole==='ad'?'ad':(payload?.kind==='canned'?'canned':'news');
    if(kind==='news'&&payload?.audioUrl&&payload.audioGainDb==null)payload={...payload,audioGainDb:gainDbFor(fileOf(payload.audioUrl))};
    let seg=null;if(!started)seg='intro';else if((kind==='canned'||kind==='ad')&&lastKind==='news')seg='pase';else if(kind==='news'&&(lastKind==='canned'||lastKind==='ad'))seg='regreso';
    if(!started)lastTit=Date.now();started=true;lastKind=kind;
    // titulares: se preparan ~90 s antes de tocar y salen antes de una noticia (nunca junto con otra intervención)
    const every=titEveryMs();
    if(every&&kind==='news'){const since=Date.now()-lastTit;
      if(since>=every-90000&&!titReady&&!titPrep)prepareTitulares();
      if(!seg&&since>=every&&titReady&&Date.now()-titReady.at<10*60000){const t=titReady;titReady=null;lastTit=Date.now();
        const ok=origDeliver({kind:'host',segment:'titulares',title:'',summary:'',audioUrl:toUrl(t.file).href,audioDurationSec:t.durationSec,hostText:t.text,headlines:t.items,headlinesIntroSec:t.introSec,headlineMarks:t.marks,audioGainDb:gainDbFor(t.file)},'automatic',false);
        if(ok){pending={after:()=>origDeliver(payload,source,autoOpen)};pendingTimer=setTimeout(()=>finish('timeout'),Math.min(60000,(t.durationSec+5)*1000));logEvent('PRESENTER_HOST',`titulares: ${t.items.length}`);return true;}}}
    if(seg&&playHost(seg,origDeliver,()=>origDeliver(payload,source,autoOpen)))return true;
    return origDeliver(payload,source,autoOpen);}
  function control(action,origControl,origDeliver){const a=String(action||'');
    if(a==='stop'&&suppressStop)return true;
    if(a==='stop'&&farewellPending){farewellPending=false;if(pending)clearPending();farewell(origDeliver,origControl);return true;}
    if(a==='stop'&&stopping){stopping=false;clearTimeout(stopTimer);stopTimer=null;started=false;lastKind='none';}
    if(a==='stop'&&pending)clearPending();return origControl(action);}
  ipcMain.on('presenter:hostPlayback',(_,ev)=>{if(ev&&(ev.type==='ended'||ev.type==='error'))finish(ev.type);});
  // genera (una sola vez, con caché en disco) los audios de las frases cuando el modo Merlín está activo
  app.whenReady().then(()=>{const t=setInterval(()=>{if(!kokoro||!settingsStore)return;clearInterval(t);if(active())setTimeout(()=>ensureClips().catch(()=>{}),20000);},2000);}).catch(()=>{});
  // titularesNow(): hace que los titulares salgan en la próxima noticia (útil para probar o para un botón manual)
  return{deliver,control,ensureClips,titularesNow:()=>{lastTit=Date.now()-titEveryMs()-1000;prepareTitulares();},state:()=>({started,lastKind,pending:!!pending,titReady:!!titReady})};
})();
{const __origDeliverToOutput=deliverToOutput,__origControlOutput=controlOutput;
 deliverToOutput=function(payload,source,autoOpen=false){return presenterHost.deliver(payload,source,autoOpen,__origDeliverToOutput,__origControlOutput);};
 controlOutput=function(action){return presenterHost.control(action,__origControlOutput,__origDeliverToOutput);};}
```

---

## 3. `src/preload.js` (verificar y completar)

Deben existir estas cuatro piezas; agrega la que falte sin tocar nada más:

1. En `exposeInMainWorld`: `page==='output-merlin.html'?outputApi:page==='output.html'?outputApi:controlApi` (una prueba antigua exige que siga presente el texto `page==='output.html'?outputApi:controlApi`).
2. En `controlApi`: `presenterGet:()=>invoke('presenter:get'),presenterSet:mode=>invoke('presenter:set',mode),` (después de `saveSettings`).
3. En `outputApi`, al inicio del objeto: `presenterHostPlayback:e=>{if(!isNdiMirror)ipcRenderer.send('presenter:hostPlayback',e);},`
4. En las inyecciones de `control.html`: `injectAsset('script',{src:'renderer-merlin.js'});` justo después de `renderer-lan-output.js`.

---

## 4. `src/services/outputLanServer.js` (verificar)

`STATIC_FILES` debe incluir estas entradas (agrega las que falten al final de la lista):

```javascript
  'output-merlin-web.html','output-merlin.js','output-merlin.css',
  'vendor/three/three.min.js','vendor/three/GLTFLoader.js','vendor/three/RoomEnvironment.js',
  'assets/merlin/merlin-model.js','assets/merlin/presenter-config.js','assets/merlin/fondo.jpg','assets/merlin/silla.webp','assets/merlin/mesa.webp','assets/merlin/mic.webp','assets/merlin/vasos.webp'
]);
```

Y la ruta, junto a la de `/output`:

```javascript
    if(u.pathname==='/merlin')return this.serveStatic('output-merlin-web.html',res);
```

---

## 5. `package.json` (verificar)

El script `check` debe incluir, después de `node --check src/output-web-mode.js && `:

```
node --check src/output-merlin.js && node --check src/renderer-merlin.js && node scripts/check-merlin-output.js && node scripts/check-gpu-profile.js &&
```

(`check-gpu-profile.js` ya existe en el repo por la corrección de las RTX serie 50.)

---

## 6. Por implementar

### A. Tono de cada noticia (`p.tone`)

1. En `src/services/editorial.js`, agrega al JSON que devuelve la IA local un campo `tone` con uno de tres valores: `serio` (tragedias, delitos, desastres, temas graves), `ligero` (deportes, espectáculos, curiosidades, buenas noticias) o `neutral` (el resto). Normalízalo: cualquier otro valor o ausencia → `neutral`. No cambies los demás campos ni sus reglas.
2. Guárdalo en `item.result.tone` y agrégalo como `tone` en **todos** los lugares donde se arma el payload de noticia para la salida (busca los objetos con `kind:'news'` que se pasan a `sendAutomaticOutput` en los archivos de automatización, incluidos los versionados).
3. La salida clásica lo ignora; Merlín lo usa.

### B. Volumen de enlatados y anuncios (`p.audioGainDb`)

1. Al importar un enlatado o anuncio (o la primera vez que se use, si ya existía), mide su nivel en el panel de control con Web Audio: `decodeAudioData` del archivo, RMS en bloques de 50 ms ignorando los bloques por debajo de −40 dBFS, y `gainDb = clamp(objetivo − rmsDb, −12, +6)` con objetivo **−20 dBFS** (el mismo que `volumen.objetivoDb` de `presenter-config.js`).
2. Guárdalo en los metadatos del enlatado o anuncio y envíalo como `audioGainDb` en el payload `kind:'canned'`.
3. Si no se puede medir (formato no decodificable), no envíes el campo: la salida usa 0 dB.
4. Opcional: aplicarlo también en la salida clásica (`output.js` usa `video.volume`; multiplícalo por `10^(gainDb/20)` con tope 1).

---

## 7. Verificación

1. `node scripts/check-merlin-output.js` → `check-merlin-output OK · salida · selector · LAN · config · espera · intervenciones`.
2. `npm run check` sin errores (en Linux, solo para correrlo local, puede hacer falta `python3` en vez de `python`; **no** cambies `package.json` por eso).
3. Prueba con stubs del bloque `presenterHost` (carga el bloque 2c en un `vm` con `deliverToOutput`, `controlOutput`, `automation`, `kokoro`, `settingsStore`, `ipcMain` simulados):
   - `news, news, canned, ad, news, news` → `HOST:intro, news, news, HOST:pase, canned, ad, HOST:regreso, news, news`.
   - Detener con noticia al aire: no se envía `stop` hasta un `output:playback` con `ended`; luego `HOST:despedida` y `stop`.
   - Detener con enlatado al aire: `HOST:despedida` inmediato y `stop`.
   - Detener y reanudar antes del final: sin despedida ni `stop`.
   - `titularesNow()` y luego una noticia → `HOST:titulares` con `headlines`, `headlineMarks` y `headlinesIntroSec`, y después la noticia.
   - Una voz fuerte recibe `audioGainDb` negativo y una suave positivo (tope +6).
4. Commit: "Merlín v4: modelo nuevo, animación, saludo, parallax, cintillo, subtítulos, reloj, volumen y titulares", push a la rama y abre la pull request.
