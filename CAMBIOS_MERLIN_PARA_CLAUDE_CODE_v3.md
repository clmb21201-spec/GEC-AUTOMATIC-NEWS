# GEC Automatic News · Merlín: cambios para aplicar

Responde siempre en español. Lee primero `CLAUDE.md` e `INTEGRACION_MERLIN.md`.

Este documento deja el repo con **todo lo aprobado para Merlín** hasta hoy. Es acumulativo: incluye también lo del documento anterior (video de espera, intervenciones y detener emisión), así que puedes aplicarlo aunque ese no se haya aplicado.

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

**Por implementar (instrucciones al final, sección 6):**
- A. Que la IA editorial devuelva el **tono** de cada noticia y llegue a la salida como `p.tone`.
- B. Medir el volumen de **enlatados y anuncios** y enviarlo como `p.audioGainDb`.

## Reglas

- No modificar la salida clásica (`output.html` y sus versionados).
- Los archivos de la sección 1 son exclusivos de Merlín: **reemplázalos completos**.
- En `src/main.js`, `src/preload.js`, `src/services/outputLanServer.js` y `package.json` aplica **solo** lo indicado, sin tocar el resto.
- Trabaja en una rama y abre una pull request; al final corre las verificaciones de la sección 7.

---

## 1. Archivos para reemplazar completos

### `src/output-merlin.html`

````html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>EC Automatic News — OUTPUT</title>
  <link rel="stylesheet" href="output-merlin.css">
</head>
<body>
<div id="viewport">
  <div id="dragRegion" aria-hidden="true"></div>
  <div id="stage">
    <div class="set" id="set">
      <div class="view" id="viewBack">
        <img id="bg" alt="" src="assets/merlin/fondo.jpg">
        <div class="plane" id="framePlane"><img alt=""><i class="glare paper"></i></div>
        <img id="chair" alt="" src="assets/merlin/silla.webp" style="transform-origin:52.86% 11.51%">
      </div>
      <div class="view" id="viewFront">
        <img id="desk" alt="" src="assets/merlin/mesa.webp">
        <div class="plane" id="tabPlane"><img alt=""><i class="glare"></i></div>
        <img id="mic" alt="" src="assets/merlin/mic.webp" style="transform-origin:12.5% 70%">
        <img id="cups" alt="" src="assets/merlin/vasos.webp" style="transform-origin:49.9% 79.3%">
      </div>
      <div class="ots" id="ots"><div class="otsImg"><img alt=""></div></div>
      <div class="full" id="full"><img alt=""><div class="ecShade"></div>
        <div class="ecLower"><div class="ecMeta"><span class="ecCat" id="fCat"></span><span class="ecDate" id="fDate"></span><span class="ecExcl" id="fExcl">EXCLUSIVO</span></div>
          <div class="ecTitle" id="fTitle"></div><div class="ecSummary" id="fSummary"></div></div></div>
      <div class="lower" id="lower"><div class="lowerMeta"><span class="lCat" id="lCat"></span><span class="lExcl" id="lExcl">EXCLUSIVO</span></div><b><span id="lowerT"></span></b></div>
      <div class="subs" id="subs"></div>
      <div class="clock" id="clock"></div>
      <div class="canned" id="cannedLayer"><video id="cannedVideo" preload="auto" playsinline></video></div>
      <div class="standby on" id="standbyLayer"><video id="standbyVideo" muted loop playsinline></video></div>
      <div class="grain" id="grain"></div>
    </div>
  </div>
</div>
<audio id="audio"></audio>
<audio id="music" preload="auto"></audio>
<script src="vendor/three/three.min.js"></script>
<script src="vendor/three/GLTFLoader.js"></script>
<script src="vendor/three/RoomEnvironment.js"></script>
<script src="assets/merlin/merlin-model.js"></script>
<script src="assets/merlin/presenter-config.js"></script>
<script src="output-merlin.js"></script>
</body>
</html>
````

### `src/output-merlin-web.html`

````html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GEC Output LAN — Merlín</title>
  <link rel="stylesheet" href="output-merlin.css">
</head>
<body>
<div id="viewport">
  <div id="stage">
    <div class="set" id="set">
      <div class="view" id="viewBack">
        <img id="bg" alt="" src="assets/merlin/fondo.jpg">
        <div class="plane" id="framePlane"><img alt=""><i class="glare paper"></i></div>
        <img id="chair" alt="" src="assets/merlin/silla.webp" style="transform-origin:52.86% 11.51%">
      </div>
      <div class="view" id="viewFront">
        <img id="desk" alt="" src="assets/merlin/mesa.webp">
        <div class="plane" id="tabPlane"><img alt=""><i class="glare"></i></div>
        <img id="mic" alt="" src="assets/merlin/mic.webp" style="transform-origin:12.5% 70%">
        <img id="cups" alt="" src="assets/merlin/vasos.webp" style="transform-origin:49.9% 79.3%">
      </div>
      <div class="ots" id="ots"><div class="otsImg"><img alt=""></div></div>
      <div class="full" id="full"><img alt=""><div class="ecShade"></div>
        <div class="ecLower"><div class="ecMeta"><span class="ecCat" id="fCat"></span><span class="ecDate" id="fDate"></span><span class="ecExcl" id="fExcl">EXCLUSIVO</span></div>
          <div class="ecTitle" id="fTitle"></div><div class="ecSummary" id="fSummary"></div></div></div>
      <div class="lower" id="lower"><div class="lowerMeta"><span class="lCat" id="lCat"></span><span class="lExcl" id="lExcl">EXCLUSIVO</span></div><b><span id="lowerT"></span></b></div>
      <div class="subs" id="subs"></div>
      <div class="clock" id="clock"></div>
      <div class="canned" id="cannedLayer"><video id="cannedVideo" preload="auto" playsinline></video></div>
      <div class="standby on" id="standbyLayer"><video id="standbyVideo" muted loop playsinline></video></div>
      <div class="grain" id="grain"></div>
    </div>
  </div>
</div>
<audio id="audio"></audio>
<audio id="music" preload="auto"></audio>
<script src="output-web-adapter.js"></script>
<script src="vendor/three/three.min.js"></script>
<script src="vendor/three/GLTFLoader.js"></script>
<script src="vendor/three/RoomEnvironment.js"></script>
<script src="assets/merlin/merlin-model.js"></script>
<script src="assets/merlin/presenter-config.js"></script>
<script src="output-merlin.js"></script>
</body>
</html>
````

### `src/output-merlin.css`

````css
:root{
  --ec-font:Arial,sans-serif; --ec-summary-font:Arial,sans-serif; --ec-cat-font:Arial,sans-serif; --ec-date-font:Arial,sans-serif; --ec-excl-font:Arial,sans-serif;
  --ec-title:#FFFFFF; --ec-summary:#F3F3F3; --ec-date:#F3F3F3; --ec-cat-bg:#F7C600; --ec-cat:#000000; --ec-lower-bg:rgba(0,0,0,.88);
  --ec-title-size:70px; --ec-summary-size:34px; --ec-cat-size:28px; --ec-date-size:27px; --ec-excl-size:24px;
  --ec-title-weight:900; --ec-summary-weight:400; --ec-cat-weight:900; --ec-date-weight:500; --ec-excl-weight:800;
  --ec-excl-bg:#F7C600; --ec-excl-color:#000; --ec-excl-radius:5px;
}
*{box-sizing:border-box;cursor:none!important}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}
body{user-select:none}
#viewport{position:fixed;inset:0;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center}
#dragRegion{position:fixed;left:0;top:0;width:100%;height:18px;z-index:9999;-webkit-app-region:drag}
#stage{position:relative;flex:0 0 auto;width:1920px;height:1080px;overflow:hidden;background:#000;transform-origin:center center}
.set{position:absolute;inset:0;overflow:hidden}
.view{position:absolute;inset:0;transform-origin:0 0;will-change:transform}
.view img,.set canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.view img{pointer-events:none}

/* imagen de la nota dentro del set (cuadro de la pared y tablet) */
.plane{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden;display:none;background:#111}
.plane img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.plane .glare{position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,0) 38%,rgba(255,255,255,0) 70%,rgba(255,240,220,.08) 100%)}
.plane .glare.paper{background:linear-gradient(180deg,rgba(60,40,20,.28) 0%,rgba(60,40,20,0) 12%),linear-gradient(90deg,rgba(60,40,20,.12),rgba(0,0,0,0) 10%)}
#framePlane img{filter:sepia(.12) saturate(.9) contrast(.95) brightness(.97)}
#tabPlane img{filter:brightness(1.05) saturate(1.05)}

/* recuadro del plano medio */
.ots{position:absolute;left:5%;top:6%;width:40%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.45),0 0 0 3px rgba(255,248,238,.9);
  opacity:0;transform:translateX(30px) scale(.97);transition:opacity .45s ease,transform .45s ease;pointer-events:none}
.ots.on{opacity:1;transform:none}
.otsImg,.otsImg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

/* pantalla completa: réplica del bloque inferior de output.css / output-0324.css */
.full{position:absolute;inset:0;overflow:hidden;opacity:0;transition:opacity .5s ease;pointer-events:none;background:#000}
.full.on{opacity:1}
.full>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
/* movimiento de imagen: mismo que la salida clásica (output.css), según Diseño → animación y velocidad de EC1 */
#stage{--motion-duration:18s}
.motion-vertical{animation:vertical var(--motion-duration) ease-in-out infinite alternate}
.motion-horizontal{animation:horizontal var(--motion-duration) ease-in-out infinite alternate}
.motion-zoom{animation:zoom var(--motion-duration) ease-in-out infinite alternate}
.motion-none{animation:none;transform:scale(1.04)}
@keyframes vertical{from{transform:scale(1.13) translateY(-5%)}to{transform:scale(1.13) translateY(5%)}}
@keyframes horizontal{from{transform:scale(1.13) translateX(-5%)}to{transform:scale(1.13) translateX(5%)}}
@keyframes zoom{from{transform:scale(1.03)}to{transform:scale(1.11)}}
.paused-motion .otsImg img,.paused-motion .full>img{animation-play-state:paused}
.ecShade{position:absolute;inset:0;background:linear-gradient(transparent 42%,var(--ec-lower-bg) 100%)}
.ecLower{position:absolute;left:64px;right:64px;bottom:54px;max-height:72%;overflow:hidden;color:var(--ec-title)}
.ecMeta{display:flex;align-items:center;gap:22px;margin-bottom:15px}
.ecCat{background:var(--ec-cat-bg);color:var(--ec-cat);padding:10px 15px;font-family:var(--ec-cat-font);font-size:var(--ec-cat-size);font-weight:var(--ec-cat-weight);line-height:1}
.ecCat:empty{display:none}
.ecDate{color:var(--ec-date);font-family:var(--ec-date-font);font-size:var(--ec-date-size);font-weight:var(--ec-date-weight);letter-spacing:.02em;text-transform:uppercase;white-space:nowrap;line-height:1}
.ecExcl{display:none;align-items:center;color:var(--ec-excl-color);background:var(--ec-excl-bg);border-radius:var(--ec-excl-radius);padding:9px 13px;font-family:var(--ec-excl-font);font-size:var(--ec-excl-size);font-weight:var(--ec-excl-weight);line-height:1;white-space:nowrap}
.ecExcl.show{display:inline-flex}
.ecTitle{font-family:var(--ec-font);font-size:var(--ec-title-size);line-height:1.02;font-weight:var(--ec-title-weight);max-width:1580px}
.ecSummary{font-family:var(--ec-summary-font);font-size:var(--ec-summary-size);line-height:1.24;margin-top:14px;max-width:1500px;color:var(--ec-summary);font-weight:var(--ec-summary-weight)}
.ecSummary:empty{display:none}

/* cintillo unificado (plano medio y pantalla completa): sección + exclusivo + titular centrado */
.lower{position:absolute;left:8%;right:8%;bottom:4.5%;color:var(--ec-title);font-family:var(--ec-font);padding:0 56px 26px;
  background:linear-gradient(180deg,rgba(10,10,12,.92),rgba(10,10,12,.86));border-top:6px solid var(--ec-cat-bg);box-shadow:0 10px 30px rgba(0,0,0,.35);
  display:flex;flex-direction:column;align-items:center;opacity:0;transform:translateY(12px);transition:opacity .4s ease,transform .4s ease;pointer-events:none;z-index:2}
.lower.on{opacity:1;transform:none}
.lowerMeta{display:flex;gap:10px;justify-content:center;transform:translateY(-50%);margin-bottom:-4px;min-height:24px}
/* sección y exclusivo: colores, opacidad, borde, radio, tipografía, tamaño, peso, texto y visibilidad vienen de Diseño de EC1 */
.lCat{background:var(--l-cat-bg,#F7C600);color:var(--ec-cat);font-family:var(--ec-cat-font);font-size:var(--l-cat-size,24px);font-weight:var(--ec-cat-weight);border-radius:var(--l-cat-radius,0);line-height:1;padding:.375em .66em;letter-spacing:.04em;text-transform:uppercase}
.lCat:empty{display:none}
.lExcl{display:none;background:var(--l-excl-bg,#F7C600);color:var(--ec-excl-color);border:var(--l-excl-border-w,0) solid var(--l-excl-border,#F7C600);border-radius:var(--ec-excl-radius);font-family:var(--ec-excl-font);font-size:var(--l-excl-size,22px);font-weight:var(--ec-excl-weight);line-height:1;padding:.41em .64em;white-space:nowrap}
.lExcl.show{display:inline-block}
.lower b{display:flex;align-items:center;justify-content:center;min-height:2.24em;font-size:48px;line-height:1.12;font-weight:var(--ec-title-weight);width:100%}
.lower b span,.lowerMeta{transition:opacity .22s ease}
.lower.swap b span,.lower.swap .lowerMeta{opacity:0}
.lower b span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:center}
/* subtítulos: caja propia, centrada, encima del cintillo */
.subs{position:absolute;left:50%;bottom:7%;transform:translateX(-50%);max-width:64%;text-align:center;font-family:var(--ec-font);font-size:36px;font-weight:700;line-height:1.3;color:#fff;
  background:rgba(0,0,0,.66);padding:8px 24px;border-radius:6px;opacity:0;transition:opacity .25s ease;pointer-events:none;z-index:2}
.subs.on{opacity:1}
.subs .f{color:rgba(255,255,255,.6)}
/* en pantalla completa se usa el mismo cintillo; el bloque grande con la bajada queda oculto */
.full .ecLower{display:none}
.full .ecShade{background:linear-gradient(transparent 55%,rgba(0,0,0,.55) 100%)}

/* enlatados y anuncios */
.canned{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .7s ease-in-out;pointer-events:none}
.canned.on{opacity:1}
.canned video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}

.standby{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .7s ease-in-out;pointer-events:none;z-index:4}
.standby.on{opacity:1}
.standby video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
.clock{position:absolute;top:4%;right:4%;z-index:3;background:rgba(10,10,12,.82);color:#fff;font-family:var(--ec-font);font-size:38px;font-weight:700;line-height:1;
  padding:12px 20px 12px 17px;border-left:6px solid var(--ec-cat-bg);letter-spacing:.02em;opacity:0;transition:opacity .4s ease;pointer-events:none;font-variant-numeric:tabular-nums}
.clock.on{opacity:1}
.grain{position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;background-size:256px 256px;z-index:5}
````

### `src/output-merlin.js`

````javascript
'use strict';
/*
 * GEC Automatic News — salida "Merlín" (presentador 3D en el set).
 * Escucha los mismos eventos que output.js (output:story, output:design, output:control)
 * y reporta el fin de cada pieza con ECAPI.outputPlayback, así el motor de automatización no cambia.
 * Todos los valores de escena, cámaras, luz y animación vienen de assets/merlin/presenter-config.js.
 */
(function(){
const $ = id => document.getElementById(id);
const CFG = window.MERLIN_CONFIG || {};
const get = (path, def) => { let o = CFG; for (const k of path.split('.')) { if (o == null || !(k in o)) return def; o = o[k]; } return o == null ? def : o; };
const num = (path, def) => { const v = Number(get(path, def)); return Number.isFinite(v) ? v : def; };
const log = (...a) => { try { console.log('[merlin]', ...a); } catch {} };

// ---------------------------------------------------------------- parámetros
const P = {
  // escena
  px:num('escena.merlin.x',0.27), py:num('escena.merlin.y',-0.03), sc:num('escena.merlin.escala',1.15), rotY:num('escena.merlin.giroY',-22), look:num('escena.merlin.cabezaMiraCamara',0.6),
  camH:num('escena.camara.posicion.1',1.45) - 0.55, shadow:num('escena.sombraSilla',0.2),
  chS:num('escena.silla.escala',0.66), chX:num('escena.silla.centroX',0.59), chY:num('escena.silla.bordeSuperiorY',0.33),
  micS:num('escena.microfono.escala',0.45), micX:num('escena.microfono.baseX',0.16), micY:num('escena.microfono.baseY',0.69), micR:num('escena.microfono.rotacion',0),
  vasS:num('escena.vasos.escala',0.27), vasX:num('escena.vasos.x',0.238), vasY:num('escena.vasos.y',0.775),
  // lip sync
  maxOpen:-num('lipSync.abiertoMax',-30), gain:num('lipSync.sensibilidad',9), thresh:num('lipSync.umbralRMS',0.012), release:num('lipSync.cierrePorSegundo',12), upper:num('lipSync.picoSuperior.factor',0.35),
  // vida
  headTalk:num('cabeza.acompanaAlHablar',0), wingDrop:num('alas.bajar.ALA_SUP_L.grados',60), wingTalk:num('alas.alHablar.intensidad',0.6),
  blink:get('vida.parpadeo',true), gazeOn:get('vida.miradas',true), headOn:get('vida.balanceoCabeza',true), breath:get('vida.respiracion',true), wingsFix:get('vida.alasIndependientes',true),
  // cámaras y dirección
  // cambio de plano con la transición elegida ('smooth' = movimiento suave, 'cut' = corte); dentro del plano, acercamiento lento si está activo.
  // Con la pantalla cubierta, el cambio es instantáneo. Si el plano no cambia, la cámara no se reescala.
  medX:num('camaras.planoMedioMerlinX',0.3), altSec:num('camaras.alternanciaSeg',12), trans:String(get('camaras.transicion','smooth')), kenBurns:get('camaras.acercamientoLento',true) !== false, introSec:num('camaras.generalAlVolverSeg',4),
  // imagen de apoyo
  supFrame:get('imagenApoyo.cuadroPared.activo',true), supTab:get('imagenApoyo.tablet.activo',true), supAlt:get('imagenApoyo.alternarEnNoticias',true),
  otsSide:get('imagenApoyo.recuadro.lado','auto'), otsW:num('imagenApoyo.recuadro.anchoMax',0.4), otsX:num('imagenApoyo.recuadro.desplazX',0), otsY:num('imagenApoyo.recuadro.top',0.06),
  // integración
  envPhoto:get('integracion.entornoDesdeFoto',true), bounce:num('integracion.reboteMesa.intensidad',0.45), occ:num('integracion.sombraMesa.intensidad',0.35), deskLine:num('integracion.sombraMesa.lineaMesaPantallaY',0.63),
  feather:num('integracion.plumas.intensidad',0.35), whiteTone:num('integracion.blancoCalido',0.05), filter:String(get('integracion.filtroCSS','sepia(0.04) saturate(0.95) contrast(0.97) blur(0.4px)')), grainA:num('integracion.grano',0.16),
  // luz
  clockOn:get('reloj.activo',true) !== false, clockPos:String(get('reloj.posicion','derecha')),
  subsOn:get('subtitulos.activos',true) !== false, medAuto:get('camaras.planoMedioCentradoAuto',true) !== false,
  browAxis:String(get('expresion.cejas.eje','x')), browAmp:num('expresion.cejas.amplitud',12),
  exposure:num('iluminacion.exposicion',0.8), keyI:num('iluminacion.luzPrincipal',1), envI:num('iluminacion.reflejosEntorno',0.5), metal:num('iluminacion.metalizado',0)
};
const planes = get('camaras.planos', null);
let cams = Array.isArray(planes) && planes.length === 3 ? planes.map(p => ({z:Number(p.zoom)||1, dx:Number(p.desplazX)||0, dy:Number(p.desplazY)||0}))
  : [{z:1,dx:0,dy:0},{z:1.75,dx:-0.03,dy:-0.02},{z:2.3,dx:-0.02,dy:-0.05}];
// CEJA_L / CEJA_R son opcionales: si el modelo los trae (agregados en Blender), se usan para la expresión; si no, se ignoran.
const BONES = ['BOCA_INF','BOCA_SUP','PARPADOS_MAYA','OJO_R','OJO_L','CABEZA','COLUMNA','ALA_SUP_R','ALA_SUP_L','CEJA_L','CEJA_R'];
const manual = {}; for (const n of BONES) manual[n] = Object.assign({x:0,y:0,z:0}, get('ajusteManual.'+n, {}));

// ---------------------------------------------------------------- escenario 1920x1080 escalado (igual que fitStage de output.js)
const stageEl = $('stage'), setEl = $('set');
const W = 1920, H = 1080;
function fitStage(){ const s = Math.min(window.innerWidth / W, window.innerHeight / H); stageEl.style.transform = `scale(${Math.max(.01, s)})`; }
window.addEventListener('resize', fitStage); fitStage();

// ---------------------------------------------------------------- three.js
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true, alpha:true}); }
catch (err) { log('WebGL no disponible, se vuelve a la salida clásica', err); location.replace('output.html'); return; }
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = P.exposure;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setClearColor(0x000000, 0);
setEl.insertBefore(renderer.domElement, $('viewFront'));
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); log('contexto WebGL perdido'); });
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const roomEnv = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture; let photoEnv = null;
scene.environment = roomEnv;
const camera = new THREE.PerspectiveCamera(26, W / H, 0.01, 50);
const rig = new THREE.Group(); scene.add(rig);
scene.add(new THREE.HemisphereLight(0xffeedd, 0x4a3a2c, 0.5));
const key = new THREE.DirectionalLight(0xffe4c4, P.keyI); key.position.set(2.2, 3.2, 2.4);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.radius = 6;
Object.assign(key.shadow.camera, {left:-1.5, right:1.5, top:2, bottom:-1, near:0.1, far:10});
scene.add(key); scene.add(key.target);
const lamp = new THREE.DirectionalLight(0xffc870, 0.35); lamp.position.set(-2.5, 2.5, 1.2); scene.add(lamp);
const rim = new THREE.DirectionalLight(0xffd9a8, 0.6); rim.position.set(1.5, 1.8, -2); scene.add(rim);
const bounceL = new THREE.DirectionalLight(0xd98a45, P.bounce); bounceL.position.set(0, -1.5, 2); scene.add(bounceL);
const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({opacity:P.shadow}));
shadowPlane.receiveShadow = true; scene.add(shadowPlane);

// sombra de la mesa sobre Merlín
const occU = { uDeskY:{value:0.3}, uOccH:{value:0.18}, uOcc:{value:P.occ} };
function addDeskOcclusion(m){
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, occU);
    sh.vertexShader = 'varying float vOccY;\n' + sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n vOccY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = 'varying float vOccY; uniform float uDeskY; uniform float uOccH; uniform float uOcc;\n' + sh.fragmentShader.replace('#include <output_fragment>', 'outgoingLight *= mix(1.0 - uOcc, 1.0, smoothstep(uDeskY, uDeskY + uOccH, vOccY));\n#include <output_fragment>');
  };
  m.customProgramCacheKey = () => 'deskocc';
}
// microtextura de plumas
function makeFeatherNormal(size){
  const h = new Float32Array(size*size);
  for (const [g,w] of [[8,1],[16,0.6],[32,0.35],[64,0.2]]){
    const r = new Float32Array(g*g).map(() => Math.random());
    for (let y=0;y<size;y++) for (let x=0;x<size;x++){
      const fx = x/size*g, fy = y/size*g, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx-x0, ty = fy-y0, sx = tx*tx*(3-2*tx), sy = ty*ty*(3-2*ty);
      const a = r[(y0%g)*g + x0%g], b = r[(y0%g)*g + (x0+1)%g], c = r[((y0+1)%g)*g + x0%g], d = r[((y0+1)%g)*g + (x0+1)%g];
      h[y*size+x] += w * ((a*(1-sx)+b*sx)*(1-sy) + (c*(1-sx)+d*sx)*sy);
    }
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y=0;y<size;y++) for (let x=0;x<size;x++){
    const dx = h[y*size+(x+1)%size] - h[y*size+(x-1+size)%size], dy = h[((y+1)%size)*size+x] - h[((y-1+size)%size)*size+x];
    let nx = -dx*6, ny = -dy*6, nz = 1; const l = Math.hypot(nx,ny,nz); nx/=l; ny/=l; nz/=l;
    const i = (y*size+x)*4; img.data[i]=(nx*.5+.5)*255; img.data[i+1]=(ny*.5+.5)*255; img.data[i+2]=(nz*.5+.5)*255; img.data[i+3]=255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
}
const featherTex = makeFeatherNormal(256);
// luz ambiental tomada de la foto del set (versión reducida incrustada)
if (P.envPhoto && window.MERLIN_ENV_PHOTO) {
  const im = new Image();
  im.onload = () => { try { const t = new THREE.Texture(im); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; photoEnv = pmrem.fromEquirectangular(t).texture; applyLight(); } catch (e) { log('entorno de foto', e); } };
  im.src = window.MERLIN_ENV_PHOTO;
}
// grano de cámara
(function(){
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const ctx = cv.getContext('2d'), img = ctx.createImageData(256,256);
  for (let i=0;i<img.data.length;i+=4){ const v = 128 + (Math.random()+Math.random()+Math.random()-1.5)*70; img.data[i]=img.data[i+1]=img.data[i+2]=v; img.data[i+3]=255; }
  ctx.putImageData(img,0,0); $('grain').style.backgroundImage = `url(${cv.toDataURL('image/png')})`; $('grain').style.opacity = P.grainA;
  setInterval(() => { $('grain').style.backgroundPosition = `${Math.floor(Math.random()*256)}px ${Math.floor(Math.random()*256)}px`; }, 42);
})();
renderer.domElement.style.filter = P.filter;

// ---------------------------------------------------------------- modelo
const bones = {}, rest = {}, mats = [], upgraded = new Map();
function upgradeMaterial(m){
  if (upgraded.has(m)) return upgraded.get(m);
  const n = new THREE.MeshPhysicalMaterial({ map:m.map, color:m.color.clone(), roughness:m.roughness, metalness:m.metalness, side:m.side, name:m.name });
  const name = (m.name || '').toUpperCase();
  if (name === 'MERLIN' || name === 'BLANCO') Object.assign(n, { sheen:0.5, sheenRoughness:0.7, normalMap:featherTex });
  else if (name === 'ALAS PLUMAS') Object.assign(n, { sheen:0.4, sheenRoughness:0.7, normalMap:featherTex });
  else if (name === 'SOMBRERO') Object.assign(n, { sheen:0.18, sheenRoughness:0.85 });
  else if (name === 'LENTES') Object.assign(n, { clearcoat:0.5, clearcoatRoughness:0.15 });
  else if (name === 'OJO') Object.assign(n, { clearcoat:0.6, clearcoatRoughness:0.1 });
  n.sheenColor = new THREE.Color(name === 'SOMBRERO' ? 0x8a7560 : 0xffe8cc);
  n.userData.baseColor = n.color.clone(); n.userData.isWhite = (name === 'MERLIN' || name === 'BLANCO');
  addDeskOcclusion(n); upgraded.set(m, n); return n;
}
function b64ToBuffer(b64){ const s = atob(b64), u = new Uint8Array(s.length); for (let i=0;i<s.length;i++) u[i] = s.charCodeAt(i); return u.buffer; }
let modelReady = false;
new THREE.GLTFLoader().parse(b64ToBuffer(window.MERLIN_GLB_B64 || ''), '', gltf => {
  rig.add(gltf.scene);
  gltf.scene.traverse(o => {
    if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.material = upgradeMaterial(o.material); if (!mats.includes(o.material)) mats.push(o.material); }
    if (o.isBone && BONES.includes(o.name) && !bones[o.name]) { bones[o.name] = o; rest[o.name] = o.quaternion.clone(); }
  });
  gltf.scene.updateMatrixWorld(true);
  if (P.wingsFix) setWings();
  modelReady = true; applyScene(); applyLight(); setCam(0, true);
  log('modelo listo', Object.keys(bones).length + ' huesos');
}, err => { log('no se pudo cargar el modelo, se vuelve a la salida clásica', err); location.replace('output.html'); });
function setWings(){
  const target = bones.COLUMNA; if (!target) return;
  const wings = ['ALA_SUP_R','ALA_SUP_L'].filter(n => bones[n]);
  scene.updateMatrixWorld(true);
  wings.forEach(n => { target.attach(bones[n]); rest[n] = bones[n].quaternion.clone(); });
}

// ---------------------------------------------------------------- escena y luz
function applyScene(){
  rig.position.set(P.px, P.py, 0); rig.scale.setScalar(P.sc); rig.rotation.y = P.rotY * Math.PI/180;
  camera.position.set(0, 0.55 + P.camH, 3.4); camera.lookAt(0, 0.45, 0); camera.updateProjectionMatrix();
  shadowPlane.position.set(P.px, 0.5, -0.3 * P.sc);
  key.target.position.set(P.px, P.py + 0.5, 0);
  $('mic').style.transform = `translate(${((P.micX-0.125)*100).toFixed(2)}%, ${((P.micY-0.70)*100).toFixed(2)}%) rotate(${P.micR}deg) scale(${P.micS})`;
  $('cups').style.transform = `translate(${((P.vasX-0.499)*100).toFixed(2)}%, ${((P.vasY-0.793)*100).toFixed(2)}%) scale(${P.vasS})`;
  $('chair').style.transform = `translate(${((P.chX-0.5286)*100).toFixed(2)}%, ${((P.chY-0.1151)*100).toFixed(2)}%) scale(${P.chS})`;
  layoutPlanes();
}
const _ray = new THREE.Raycaster(), _pl = new THREE.Plane(new THREE.Vector3(0,0,1), 0), _hit = new THREE.Vector3();
function applyLight(){
  renderer.toneMappingExposure = P.exposure; key.intensity = P.keyI; bounceL.intensity = P.bounce; occU.uOcc.value = P.occ;
  mats.forEach(m => {
    m.envMapIntensity = P.envI;
    if (m.userData.isWhite) { m.metalness = P.metal; m.color.copy(m.userData.baseColor).multiply(new THREE.Color(1, 1 - P.whiteTone*0.4, 1 - P.whiteTone)); }
    if (m.normalMap) m.normalScale.set(P.feather, P.feather);
    m.needsUpdate = true;
  });
  scene.environment = (P.envPhoto && photoEnv) ? photoEnv : roomEnv;
  if (bones.CABEZA) {
    camera.clearViewOffset();
    _ray.setFromCamera(new THREE.Vector2(headScreen().x*2-1, 1 - P.deskLine*2), camera);
    if (_ray.ray.intersectPlane(_pl, _hit)) occU.uDeskY.value = _hit.y;
    occU.uOccH.value = 0.2 * P.sc;
  }
}

// ---------------------------------------------------------------- cámaras virtuales
let camIdx = 0, camNow = {z:1, cx:.5, cy:.5}, camTarget = {z:1, cx:.5, cy:.5}, kb = 0, shotDur = P.altSec, newsLayout = false;
const headV = new THREE.Vector3();
function headScreen(){
  const b = bones.CABEZA; if (!b) return {x:0.55, y:0.4};
  rig.updateMatrixWorld(true); b.getWorldPosition(headV); camera.clearViewOffset(); headV.project(camera);
  return {x:(headV.x+1)/2, y:(1-headV.y)/2};
}
// posición en pantalla de la cabeza en plano medio con imagen: centrada en el espacio libre que deja el recuadro
function medTarget(){
  if (!P.medAuto) return P.medX;
  const edge = Math.min(0.96, Math.max(0.3, 0.5 + P.otsX));
  return P.otsSide === 'left' ? (edge + 1) / 2 : edge / 2;
}
function camGoal(i){
  const c = cams[i]; let cx = 0.5 + c.dx, cy = 0.5 + c.dy;
  if (i > 0) { const h = headScreen(); cx = h.x + c.dx; cy = h.y + c.dy; if (i === 1 && newsLayout) cx = h.x + (0.5 - medTarget()) / c.z; }
  const half = 0.5 / c.z;
  return { z:c.z, cx:Math.min(1-half, Math.max(half, cx)), cy:Math.min(1-half, Math.max(half, cy)) };
}
function setCam(i, instant){
  const goal = camGoal(i);
  // mismo plano y mismo encuadre (p. ej. presentación o regreso en general → noticia que abre en general): no se toca nada,
  // así el acercamiento lento sigue su curso sin reescalarse
  if (i === camIdx && Math.abs(goal.z - camTarget.z) < 1e-3 && Math.abs(goal.cx - camTarget.cx) < 2e-3 && Math.abs(goal.cy - camTarget.cy) < 2e-3) return;
  camIdx = i; camTarget = goal;
  if (instant || P.trans === 'cut') { camNow = {...goal}; kb = 0; }
  else { camNow.z *= (1 + 0.04 * kb); kb = 0; } // el movimiento suave arranca desde el encuadre que se ve (incluido el acercamiento), sin saltos
}
function updateCamera(dt){
  if (P.kenBurns) kb = Math.min(1, kb + dt / Math.max(4, shotDur));
  const k = Math.min(1, 3.2 * dt);
  camNow.z += (camTarget.z - camNow.z) * k; camNow.cx += (camTarget.cx - camNow.cx) * k; camNow.cy += (camTarget.cy - camNow.cy) * k;
  const z = camNow.z * (1 + 0.04 * kb), half = 0.5 / z;
  const cx = Math.min(1-half, Math.max(half, camNow.cx)), cy = Math.min(1-half, Math.max(half, camNow.cy));
  const tf = `translate(${((0.5 - cx*z)*100).toFixed(3)}%, ${((0.5 - cy*z)*100).toFixed(3)}%) scale(${z.toFixed(4)})`;
  $('viewBack').style.transform = tf; $('viewFront').style.transform = tf;
  camera.setViewOffset(W*z, H*z, (cx*z - 0.5)*W, (cy*z - 0.5)*H, W, H);
}

// ---------------------------------------------------------------- imagen de apoyo
const QUADS = {
  framePlane: { pts:[[0.7602,0.2000],[0.9025,0.2063],[0.8984,0.3914],[0.7548,0.3799]], w:1400, h:1000 },
  tabPlane:   { pts:[[0.8194,0.5395],[0.8678,0.4951],[0.9087,0.6382],[0.8585,0.6908]], w:580,  h:1000 }
};
function adj(m){ return [m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4], m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5], m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3]]; }
function mm(a,b){ const c=[]; for(let i=0;i<3;i++) for(let j=0;j<3;j++){ let v=0; for(let k=0;k<3;k++) v+=a[3*i+k]*b[3*k+j]; c[3*i+j]=v; } return c; }
function mv(m,v){ return [m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]]; }
function basis(p){ const m=[p[0][0],p[1][0],p[2][0], p[0][1],p[1][1],p[2][1], 1,1,1]; const v=mv(adj(m),[p[3][0],p[3][1],1]); return mm(m,[v[0],0,0, 0,v[1],0, 0,0,v[2]]); }
function quadMatrix(w, h, dst){
  const s = basis([[0,0],[w,0],[0,h],[w,h]]), d = basis([dst[0],dst[1],dst[3],dst[2]]);
  let t = mm(d, adj(s)); t = t.map(x => x / t[8]);
  return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`;
}
function layoutPlanes(){ for (const id in QUADS){ const q = QUADS[id], el = $(id); el.style.width = q.w+'px'; el.style.height = q.h+'px'; el.style.transform = quadMatrix(q.w, q.h, q.pts.map(([x,y]) => [x*W, y*H])); } }
let supSrc = '', supShown = false, supMode = 'ots';
// mismo criterio que applyMotion() de output.js: modo según Diseño (auto | zoom | vertical | horizontal | none) y velocidad (slow | normal | fast)
function applyMotion(img){
  if (!img) return;
  let mode = design.animation || 'auto';
  if (mode === 'auto') { const ar = (img.naturalWidth || 16) / (img.naturalHeight || 9); mode = ar < 1 ? 'vertical' : ar > 1.9 ? 'horizontal' : 'zoom'; }
  img.classList.remove('motion-vertical','motion-horizontal','motion-zoom','motion-none'); void img.offsetWidth;
  img.classList.add({vertical:'motion-vertical', horizontal:'motion-horizontal', zoom:'motion-zoom', none:'motion-none'}[mode] || 'motion-zoom');
  stageEl.style.setProperty('--motion-duration', ({slow:26, normal:18, fast:11}[design.motionSpeed] || 18) + 's');
}
function restartMotion(){ document.querySelectorAll('#ots img, #full > img').forEach(applyMotion); }
const END_MARGIN = 2, MIN_FULL = 4;
function setSupImage(src, immediate){
  supSrc = src || '';
  // si la pantalla completa todavía se está retirando, su imagen se cambia cuando ya no se ve (evita ver la nueva imagen un instante)
  const fullImg = $('full').querySelector('img'), fullBusy = !immediate && ($('full').classList.contains('on') || performance.now() - fullOffAt < 650);
  document.querySelectorAll('#framePlane img, #tabPlane img, #ots img').forEach(im => { if (src) im.src = src; });
  if (src) { if (fullBusy) setTimeout(() => { if (supSrc === src && !$('full').classList.contains('on')) { fullImg.src = src; applyMotion(fullImg); } }, 650); else fullImg.src = src; }
  if (src) { const imgs = document.querySelectorAll('#ots img, #full > img'); imgs.forEach(im => { if (im.complete) applyMotion(im); else im.onload = () => applyMotion(im); }); }
  $('framePlane').style.display = P.supFrame && supSrc ? 'block' : 'none';
  $('tabPlane').style.display = P.supTab && supSrc ? 'block' : 'none';
}
function placeOts(){
  const hs = headScreen(), ct = camTarget;
  const hx = (hs.x - ct.cx) * ct.z + 0.5, gap = 0.13 * P.sc * ct.z, maxW = P.otsW, m = 0.04;
  let side = P.otsSide; if (side === 'auto') side = hx < 0.5 ? 'right' : 'left';
  let left, w;
  if (side === 'right') { left = Math.max(hx + gap, 0.5); w = Math.min(maxW, 1 - m - left); if (w < 0.22) { w = 0.22; left = 1 - m - w; } }
  else { const right = Math.min(hx - gap, 0.5); w = Math.min(maxW, right - m); if (w < 0.22) w = 0.22; left = Math.max(m, right - w); }
  left = Math.min(1 - w, Math.max(0, left + P.otsX));
  let topPx = P.otsY * H; const hPx = w * W * 9 / 16;
  if (P.subsOn) { const subsTop = H - (H*0.045 + ($('lower').offsetHeight || 150) + 44 + 110); if (topPx + hPx > subsTop - 16) topPx = Math.max(H*0.03, subsTop - 16 - hPx); }
  if (P.clockOn && ((side === 'right') !== (P.clockPos === 'izquierda'))) { const c = $('clock'), minTop = H*0.04 + (c.offsetHeight || 50) + 18; if (topPx < minTop) topPx = minTop; }
  const ots = $('ots'); ots.style.left = (left*100).toFixed(2)+'%'; ots.style.width = (w*100).toFixed(2)+'%'; ots.style.top = (topPx/H*100).toFixed(2)+'%';
}
// momento en que cada cobertura (pantalla completa, enlatado, espera) empezó a aparecer, para saber si ya es opaca
let fullOffAt = -1e9;
const coverSince = {full:0, canned:0, standby:0}, COVER_FADE = {full:550, canned:750, standby:750};
const coverOn = () => ['full','cannedLayer','standbyLayer'].some(id => $(id).classList.contains('on'));
function coverWaitMs(){
  const now = performance.now(), on = {full:$('full').classList.contains('on'), canned:$('cannedLayer').classList.contains('on'), standby:$('standbyLayer').classList.contains('on')};
  let w = 0; for (const k in on) if (on[k]) w = Math.max(w, COVER_FADE[k] - (now - coverSince[k])); return Math.max(0, w);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// titular, sección y exclusivo del cintillo: si ya está visible, el texto cambia con un fundido corto en vez de ocultar y volver a mostrar el cintillo
// visibilidad según Diseño de EC1: sección (categoryVisible / visibility.category) y exclusivo (exclusiveEnabled / exclusiveBadgeVisible / visibility.exclusive)
const catVisible = () => design.categoryVisible !== false && (design.visibility || {}).category !== false;
const exclVisible = () => design.exclusiveEnabled !== false && design.exclusiveBadgeVisible !== false && (design.visibility || {}).exclusive !== false;
let lowerExcl = false;
function refreshLowerFlags(){ $('lCat').style.display = catVisible() ? '' : 'none'; $('lExcl').classList.toggle('show', lowerExcl && exclVisible()); }
function setLower(title, cat, excl){
  const apply = () => { $('lowerT').textContent = title || ''; $('lCat').textContent = String(cat || '').toUpperCase(); lowerExcl = !!excl; refreshLowerFlags(); };
  const l = $('lower'); clearTimeout(setLower.t);
  if (l.classList.contains('on') && $('lowerT').textContent && $('lowerT').textContent !== title) { l.classList.add('swap'); setLower.t = setTimeout(() => { apply(); l.classList.remove('swap'); }, 230); }
  else { l.classList.remove('swap'); apply(); }
}
function showSup(on, mode, keepLower){
  supMode = mode || supMode; supShown = !!on && !!supSrc;
  if (supShown && supMode === 'full' && !$('full').classList.contains('on')) coverSince.full = performance.now();
  if (!(supShown && supMode === 'full') && $('full').classList.contains('on')) fullOffAt = performance.now();
  if (supMode === 'ots') placeOts();
  // en la noticia, el recuadro se queda puesto debajo de la pantalla completa: al volver al plano medio ya está en su lugar
  // (antes salía al pasar a pantalla completa y volvía a entrar deslizándose mientras la imagen se desvanecía)
  $('ots').classList.toggle('on', supShown && (supMode === 'ots' || (supMode === 'full' && activeKind === 'news' && newsLayout)));
  $('full').classList.toggle('on', supShown && supMode === 'full');
  if (!keepLower) $('lower').classList.toggle('on', !!on && (activeKind === 'news' || (activeKind === 'host' && hlIdx >= 0)) && !!$('lowerT').textContent);
}

// ---------------------------------------------------------------- diseño de EC1 (output:design)
let design = {voiceVolume:100, cannedVolume:100, musicVolume:20, musicEnabled:false, musicLoop:true, exclusiveEnabled:true};
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const vol = v => clamp(v, 0, 100) / 100;
function rgba(hex, a){ const m = String(hex||'#000').replace('#',''), h = m.length === 3 ? m.split('').map(x => x+x).join('') : m, n = parseInt(h, 16); return Number.isNaN(n) ? `rgba(0,0,0,${a})` : `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
const fam = f => f ? `"${String(f).replace(/"/g,'')}",Arial,sans-serif` : 'Arial,sans-serif';
let fontSig = '', ownedFaces = [];
async function syncCustomFonts(list){
  const rows = Array.isArray(list) ? list.filter(x => x && x.family && x.url) : [], sig = rows.map(x => x.family+'|'+x.url).join('||');
  if (sig === fontSig) return; fontSig = sig;
  for (const f of ownedFaces) try { document.fonts.delete(f); } catch {}
  ownedFaces = [];
  for (const x of rows) try { const url = String(x.url).split('#')[0]; const f = new FontFace(x.family, `url("${url.replace(/"/g,'%22')}")`); await f.load(); document.fonts.add(f); ownedFaces.push(f); } catch {}
}
function applyDesign(next = {}){
  design = {...design, ...next};
  const r = document.documentElement.style, d = design, set = (k, v) => r.setProperty(k, v);
  set('--ec-font', fam(d.titleFontFamily || d.fontFamily)); set('--ec-summary-font', fam(d.summaryFontFamily || d.fontFamily));
  set('--ec-cat-font', fam(d.categoryFontFamily || d.fontFamily)); set('--ec-date-font', fam(d.dateFontFamily || d.fontFamily)); set('--ec-excl-font', fam(d.exclusiveFontFamily || d.fontFamily));
  if (d.titleColor) set('--ec-title', d.titleColor); if (d.summaryColor) set('--ec-summary', d.summaryColor); set('--ec-date', d.dateColor || d.summaryColor || '#F3F3F3');
  if (d.categoryBgColor) set('--ec-cat-bg', d.categoryBgColor); if (d.categoryTextColor) set('--ec-cat', d.categoryTextColor);
  set('--ec-lower-bg', rgba(d.lowerBgColor || '#000000', d.lowerOpacity == null ? .88 : Number(d.lowerOpacity)));
  const px = (v, def, a, b) => clamp(v == null ? def : v, a, b) + 'px';
  set('--ec-title-size', px(d.titleFontSize, 70, 20, 120)); set('--ec-summary-size', px(d.summaryFontSize, 34, 12, 72));
  set('--ec-cat-size', px(d.categoryFontSize, 28, 10, 48)); set('--ec-date-size', px(d.dateFontSize, 27, 10, 48)); set('--ec-excl-size', px(d.exclusiveFontSize, 24, 10, 48));
  const wt = (v, def) => String(clamp(v == null ? def : v, 100, 900));
  set('--ec-title-weight', wt(d.titleFontWeight, 900)); set('--ec-summary-weight', wt(d.summaryFontWeight, 400)); set('--ec-cat-weight', wt(d.categoryFontWeight, 900));
  set('--ec-date-weight', wt(d.dateFontWeight, 500)); set('--ec-excl-weight', wt(d.exclusiveFontWeight, 800));
  set('--ec-excl-bg', d.exclusiveBgColor || '#F7C600'); set('--ec-excl-color', d.exclusiveTextColor || '#000000'); set('--ec-excl-radius', px(d.exclusiveRadius, 5, 0, 30));
  $('fExcl').textContent = String(d.exclusiveText || 'EXCLUSIVO').slice(0, 32);
  // cintillo: sección y exclusivo con las mismas opciones de Diseño de EC1 (tamaños proporcionales al cintillo)
  const op = (v, def) => v == null ? def : Math.max(0, Math.min(1, Number(v)));
  set('--l-cat-bg', rgba(d.categoryBgColor || '#F7C600', op(d.categoryBgOpacity, 1)));
  set('--l-cat-radius', clamp(d.categoryRadius, 0, 40) + 'px');
  set('--l-cat-size', Math.round(clamp(d.categoryFontSize == null ? 28 : d.categoryFontSize, 10, 48) * .86) + 'px');
  set('--l-excl-bg', rgba(d.exclusiveBgColor || '#F7C600', op(d.exclusiveBgOpacity, 1)));
  set('--l-excl-border', d.exclusiveBorderColor || d.exclusiveBgColor || '#F7C600'); set('--l-excl-border-w', clamp(d.exclusiveBorderWidth, 0, 8) + 'px');
  set('--l-excl-size', Math.round(clamp(d.exclusiveFontSize == null ? 24 : d.exclusiveFontSize, 10, 48) * .9) + 'px');
  $('lExcl').textContent = String(d.exclusiveText || 'EXCLUSIVO').slice(0, 32);
  if (typeof refreshLowerFlags === 'function') refreshLowerFlags();
  audio.volume = vol(d.voiceVolume == null ? 100 : d.voiceVolume); video.volume = vol(d.cannedVolume == null ? 100 : d.cannedVolume);
  syncCustomFonts(d.customFonts).catch(() => {});
  if (typeof setStandbySource === 'function') { setStandbySource(); standbyMusic(); }
  if (supSrc) restartMotion();
}
function ecDate(v){ if (!v) return ''; const d = new Date(v); if (isNaN(d)) return ''; try { return new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'short',year:'numeric'}).format(d).replace(/\./g,'').toUpperCase(); } catch { return ''; } }

// ---------------------------------------------------------------- audio y lip sync
const audio = $('audio'), music = $('music'), video = $('cannedVideo');
let actx = null, analyser = null, buf = new Float32Array(1024), tainted = false, silentFrames = 0, synthT = 0;
let voiceSrc = null;
function ensureAudioGraph(){
  if (actx) return;
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); analyser = actx.createAnalyser(); analyser.fftSize = 1024; }
  catch (e) { log('Web Audio no disponible, se usa lip sync sintético', e); tainted = true; }
}
// El audio suena directo desde el elemento <audio>; Web Audio solo "escucha" una copia (captureStream) para mover el pico.
// Así, aunque el análisis quede bloqueado, la voz siempre se oye.
audio.addEventListener('playing', () => {
  if (!actx || tainted) return;
  try {
    if (voiceSrc) { try { voiceSrc.disconnect(); } catch {} voiceSrc = null; }
    const st = (audio.captureStream || audio.mozCaptureStream).call(audio);
    if (st && st.getAudioTracks().length) { voiceSrc = actx.createMediaStreamSource(st); voiceSrc.connect(analyser); }
  } catch (e) { log('captureStream no disponible; lip sync sintético', e); tainted = true; }
});
// normalización de volumen: EC1 manda p.audioGainDb medido al generar o importar cada audio
const dbGain = db => Math.pow(10, (Number(db) || 0) / 20);
function readLevel(dt){
  if (!analyser || audio.paused || audio.ended || (activeKind !== 'news' && activeKind !== 'host')) { silentFrames = 0; return 0; }
  if (tainted) return synthLevel(dt);
  analyser.getFloatTimeDomainData(buf);
  let s = 0, peak = 0; for (let i=0;i<buf.length;i++) { s += buf[i]*buf[i]; peak = Math.max(peak, Math.abs(buf[i])); }
  // si el audio suena pero el analizador entrega silencio absoluto (origen bloqueado), usar un envolvente sintético
  if (peak === 0 && audio.currentTime > 1.2) { if (++silentFrames > 90) { tainted = true; log('análisis de audio bloqueado; lip sync sintético'); } } else silentFrames = 0;
  return Math.min(1, Math.max(0, (Math.sqrt(s / buf.length) - P.thresh) * P.gain));
}
function synthLevel(dt){
  synthT += dt; const t = synthT;
  const phrase = (t % 2.8) < 2.3 ? 1 : 0, syl = Math.max(0, Math.sin(t*Math.PI*2*4.8 + Math.sin(t*3.1)*2)), accent = 0.55 + 0.45*Math.abs(Math.sin(t*1.7));
  return phrase * Math.pow(syl, 0.7) * accent;
}

// ---------------------------------------------------------------- reloj (hora local del equipo, formato 8:45 PM)
function clockText(d = new Date()){ let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${m} ${ap}`; }
function updateClock(){
  const el = $('clock');
  if (P.clockPos === 'izquierda') { el.style.left = '4%'; el.style.right = 'auto'; }
  const show = P.clockOn && !standbyOn && activeKind !== 'canned';
  if (show) { const t = clockText(); if (el.textContent !== t) el.textContent = t; }
  el.classList.toggle('on', show);
}
setInterval(updateClock, 1000);

// ---------------------------------------------------------------- subtítulos (texto exacto del guion, tiempos estimados)
let subsChunks = [], subsKey = '';
function buildSubs(text){
  const clean = String(text || '').replace(/\s+/g, ' ').trim(); subsChunks = []; subsKey = '';
  if (!clean) return;
  const sentences = clean.split(/(?<=[.!?;:])\s+/);
  for (const sen of sentences) {
    const words = sen.split(' '); let cur = [];
    for (const w of words) { cur.push(w); if (cur.join(' ').length >= 58 || cur.length >= 11) { subsChunks.push(cur); cur = []; } }
    if (cur.length) { if (cur.length <= 2 && subsChunks.length && subsChunks[subsChunks.length-1].length < 13) subsChunks[subsChunks.length-1].push(...cur); else subsChunks.push(cur); }
  }
  let acc = 0; subsChunks = subsChunks.map(words => { const weight = words.join(' ').length + 6; const c = {words, start:acc, weight}; acc += weight; return c; });
  subsChunks.total = acc;
}
function updateSubs(){
  const el = $('subs');
  const live = P.subsOn && subsChunks.length && (activeKind === 'news' || activeKind === 'host') && !audio.paused && !audio.ended && audio.duration > 0;
  if (!live) { el.classList.remove('on'); return; }
  const pos = Math.min(1, audio.currentTime / audio.duration) * subsChunks.total;
  let c = subsChunks[subsChunks.length - 1]; for (const x of subsChunks) { if (pos < x.start + x.weight) { c = x; break; } }
  const inner = Math.max(0, Math.min(1, (pos - c.start) / c.weight)), n = c.words.length, said = Math.min(n, Math.floor(inner * (n + 1)));
  const key = subsChunks.indexOf(c) + ':' + said;
  if (key !== subsKey) {
    subsKey = key;
    const esc = t => t.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]);
    el.innerHTML = esc(c.words.slice(0, said).join(' ')) + (said < n ? ' <span class="f">' + esc(c.words.slice(said).join(' ')) + '</span>' : '');
  }
  const lower = $('lower');
  el.style.bottom = lower.classList.contains('on') ? (H*0.045 + lower.offsetHeight + 44) + 'px' : '7%';
  el.classList.add('on');
}

// ---------------------------------------------------------------- expresión según el tono de la noticia (p.tone: serio | neutral | ligero)
const TONES = { serio:{sway:.35, wings:.25, lid:14, blinkMin:4, blinkMax:7, gazeAway:.12, brow:-1}, neutral:{sway:1, wings:1, lid:0, blinkMin:3, blinkMax:6, gazeAway:.3, brow:0}, ligero:{sway:1.4, wings:1.4, lid:0, blinkMin:2.5, blinkMax:5, gazeAway:.35, brow:1} };
let toneName = 'neutral'; const toneNow = {...TONES.neutral};
function setTone(t){ toneName = TONES[t] ? t : 'neutral'; }

// ---------------------------------------------------------------- flujo de historias (mismo contrato que output.js)
let hlIdx = -1, headlines = [], hlIntroSec = 4, activeKind = 'none', source = 'none', serial = 0, afterBreak = true, altT = 0, introTimer = null, renderPaused = false;
function playback(type, message = ''){ try { window.ECAPI.outputPlayback({type, source, kind:activeKind, message}); } catch {} }
function waitImage(src, timeout = 2500){
  return new Promise(res => { if (!src) return res(false); const im = new Image(); let done = false; const fin = ok => { if (!done) { done = true; clearTimeout(t); res(ok); } };
    const t = setTimeout(() => fin(false), timeout); im.onload = () => fin(true); im.onerror = () => fin(false); im.src = src; });
}
async function startMusic(){
  const url = String(design.musicUrl || ''); if (!design.musicEnabled || !url) { music.pause(); return; }
  if ((music.getAttribute('src') || '') !== url) { music.src = url; music.load(); }
  music.loop = design.musicLoop !== false; music.volume = vol(design.musicVolume == null ? 20 : design.musicVolume);
  if (music.paused) try { await music.play(); } catch {}
}
function hideCanned(){
  const layer = $('cannedLayer'); if (!layer.classList.contains('on')) return;
  renderPaused = false; layer.classList.remove('on');
  setTimeout(() => { if (activeKind === 'news') { try { video.pause(); video.removeAttribute('src'); video.load(); } catch {} } }, 800);
}
// ---- video de espera (standby), igual que output-0331.js: al abrir la salida y tras 'stop'
const standbyEl = $('standbyLayer'), standbyVideo = $('standbyVideo');
let standbyOn = true, standbyTimer = null;
function setStandbySource(){
  const url = String(design.standbyVideoUrl || '');
  if (!url) { standbyVideo.pause(); standbyVideo.removeAttribute('src'); try { standbyVideo.load(); } catch {} return; }
  if (standbyVideo.getAttribute('src') !== url) { standbyVideo.src = url; standbyVideo.loop = true; standbyVideo.muted = true; standbyVideo.load(); }
  if (standbyOn) standbyVideo.play().catch(() => {});
}
function standbyMusic(){
  const url = String(design.musicUrl || '');
  if (!standbyOn || !design.musicEnabled || !url) return;
  if ((music.getAttribute('src') || '') !== url) { music.src = url; music.load(); }
  music.loop = design.musicLoop !== false; music.volume = vol(design.musicVolume == null ? 20 : design.musicVolume);
  if (music.paused) music.play().catch(() => {});
}
function showStandby(){
  standbyOn = true; clearTimeout(standbyTimer); clearTimeout(introTimer);
  audio.pause(); video.pause(); showSup(false); $('lower').classList.remove('on');
  activeKind = 'none'; afterBreak = true; newsLayout = false;
  renderPaused = false; if (!standbyEl.classList.contains('on')) coverSince.standby = performance.now(); standbyEl.classList.add('on');
  if (standbyVideo.getAttribute('src')) standbyVideo.play().catch(() => {});
  standbyMusic();
  standbyTimer = setTimeout(() => { if (standbyOn) { renderPaused = true; setCam(0, true); } }, 800);
}
function hideStandby(){
  if (!standbyOn) return;
  standbyOn = false; clearTimeout(standbyTimer); renderPaused = false;
  standbyEl.classList.remove('on');
  standbyTimer = setTimeout(() => { if (!standbyOn) standbyVideo.pause(); }, 800);
}
async function showNews(p, my){
  clearTimeout(introTimer);
  const img = p.image || p.fallbackImage || '';
  let ok = await waitImage(img);
  let src = ok ? img : '';
  if (!ok && p.fallbackImage && p.fallbackImage !== img) { ok = await waitImage(p.fallbackImage); src = ok ? p.fallbackImage : ''; }
  if (my !== serial) return;
  if (p.preloadImage) { const pre = new Image(); pre.src = p.preloadImage; }
  // textos generados por la IA local de EC1
  const lowerWasOn = $('lower').classList.contains('on') && activeKind === 'news';
  setLower(p.title, p.category || 'ACTUALIDAD', !!p.isExclusive);
  buildSubs(p.script || p.summary || ''); setTone(p.tone); hlIdx = -1;
  $('fTitle').textContent = p.title || ''; $('fSummary').textContent = p.summary || '';
  $('fCat').textContent = String(p.category || 'ACTUALIDAD').toUpperCase(); $('fDate').textContent = ecDate(p.pubDate || p.date || '');
  $('fExcl').classList.toggle('show', !!p.isExclusive && design.exclusiveEnabled !== false);
  const wasBreak = afterBreak; afterBreak = false;
  // el corte de cámara se hace con la pantalla totalmente cubierta (si hay una cobertura apareciendo, se espera a que sea opaca);
  // si la nota anterior ya estaba en el mismo plano, la cámara no se toca
  const w = coverWaitMs(); if (w) { await sleep(w); if (my !== serial) return; }
  const sameShot = !wasBreak && newsLayout && camIdx === 1;
  newsLayout = !wasBreak; if (!sameShot) setCam(wasBreak ? 0 : 1, coverOn());
  activeKind = 'news'; hideStandby(); hideCanned(); showSup(false, null, lowerWasOn && !wasBreak);
  setSupImage(src);
  // dirección: tras una pausa (inicio, enlatado o anuncio) abre en plano general; luego plano medio con la imagen
  const toNews = () => { if (my !== serial) return; if (!(newsLayout && camIdx === 1)) setCam(1, coverOn()); newsLayout = true; shotDur = P.altSec; altT = 0; showSup(true, 'ots'); };
  if (wasBreak) introTimer = setTimeout(toNews, P.introSec * 1000); else toNews();
  startMusic().catch(() => {});
  ensureAudioGraph(); if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  synthT = 0; silentFrames = 0;
  audio.volume = Math.min(1, vol(design.voiceVolume == null ? 100 : design.voiceVolume) * dbGain(p.audioGainDb));
  if (p.audioUrl) { audio.src = p.audioUrl; audio.currentTime = 0; audio.play().catch(e => { if (my === serial && e && e.name !== 'AbortError') playback('error', e.message || 'No se pudo iniciar el audio'); }); }
  else playback('ended');
}
// intervenciones de Merlín (presentación, pase, regreso, despedida): solo voz, sin imagen ni zócalos
let hostSegment = '';
function hostReport(type, message = ''){ try { window.ECAPI.presenterHostPlayback && window.ECAPI.presenterHostPlayback({type, segment:hostSegment, message}); } catch {} }
async function showHost(p, my){
  clearTimeout(introTimer); hostSegment = String(p.segment || '');
  buildSubs(p.hostText || ''); setTone(hostSegment === 'despedida' ? 'neutral' : 'ligero');
  headlines = Array.isArray(p.headlines) ? p.headlines.slice(0, 6) : []; hlIdx = -1; hlIntroSec = Number(p.headlinesIntroSec) || 4; if (Array.isArray(p.headlineMarks)) headlines.marks = p.headlineMarks.map(Number);
  { const w = coverWaitMs(); if (w) { await sleep(w); if (my !== serial) return; } }
  newsLayout = false;
  if (hostSegment === 'pase' || hostSegment === 'despedida') setCam(2, coverOn()); else { setCam(0, coverOn()); if (hostSegment !== 'titulares') afterBreak = false; }
  activeKind = 'host'; hideStandby(); hideCanned(); showSup(false); $('lower').classList.remove('on');
  ensureAudioGraph(); if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  synthT = 0; silentFrames = 0; audio.volume = Math.min(1, vol(design.voiceVolume == null ? 100 : design.voiceVolume) * dbGain(p.audioGainDb));
  if (my !== serial) return;
  if (p.audioUrl) { audio.src = p.audioUrl; audio.currentTime = 0; audio.play().catch(e => { if (my === serial && e && e.name !== 'AbortError') hostReport('error', e.message || 'No se pudo iniciar el audio'); }); }
  else hostReport('ended');
}
async function showCanned(p, my){
  clearTimeout(introTimer); audio.pause();
  activeKind = 'canned'; afterBreak = true; hideStandby(); showSup(false); $('lower').classList.remove('on');
  try { await (async () => { if (!music.paused) music.pause(); })(); } catch {}
  video.src = p.videoUrl || ''; video.volume = Math.min(1, vol(design.cannedVolume == null ? 100 : design.cannedVolume) * dbGain(p.audioGainDb)); video.load();
  if (my !== serial) return;
  if (!$('cannedLayer').classList.contains('on')) coverSince.canned = performance.now();
  $('cannedLayer').classList.add('on');
  setTimeout(() => { if (activeKind === 'canned') renderPaused = true; }, 800);
  video.play().catch(e => playback('error', e.message || 'No se pudo reproducir el video'));
}
audio.addEventListener('ended', () => { if (activeKind === 'news') playback('ended'); else if (activeKind === 'host') hostReport('ended'); });
audio.addEventListener('error', () => { if (!audio.src) return; if (activeKind === 'news') playback('error', 'No se pudo cargar el audio'); else if (activeKind === 'host') hostReport('error', 'No se pudo cargar el audio'); });
video.addEventListener('ended', () => { if (activeKind === 'canned') playback('ended'); });
video.addEventListener('error', () => { if (activeKind === 'canned' && video.getAttribute('src')) playback('error', 'No se pudo cargar el video'); });

const api = window.ECAPI;
if (api) {
  api.on('output:design', d => applyDesign(d || {}));
  api.on('output:story', p => {
    p = p || {}; source = p.source || 'none'; if (p.design) applyDesign(p.design);
    const my = ++serial;
    if (p.kind === 'host') showHost(p, my).catch(e => hostReport('error', e.message || String(e)));
    else if ((p.kind || 'news') === 'canned') showCanned(p, my).catch(e => playback('error', e.message || String(e)));
    else showNews(p, my).catch(e => playback('error', e.message || String(e)));
  });
  api.on('output:control', a => {
    if (a === 'play') { if (activeKind === 'canned') video.play().catch(() => {}); else { audio.play().catch(() => {}); startMusic().catch(() => {}); } }
    if (a === 'pause') { if (activeKind === 'canned') video.pause(); else audio.pause(); music.pause(); stageEl.classList.add('paused-motion'); }
    if (a === 'play' || a === 'stop') stageEl.classList.remove('paused-motion');
    if (a === 'stop') { try { audio.currentTime = 0; } catch {} music.pause(); hideCanned(); showStandby(); }
    if (a === 'play' && standbyOn) { standbyVideo.play().catch(() => {}); standbyMusic(); }
    if (a === 'pause' && standbyOn) standbyVideo.pause();
  });
  (async () => { try { const s = await api.getSettings(); applyDesign((s && s.visual && s.visual.output) || {}); } catch { applyDesign({}); } })();
} else log('ECAPI no disponible');

// ---------------------------------------------------------------- animación
const clock = new THREE.Clock(), eul = new THREE.Euler(), quat = new THREE.Quaternion(), D = Math.PI/180;
let mouth = 0, talkE = 0, prevLvl = 0, gestT = 0, gestSide = 'R', blinkT = 0, nextBlink = 2 + Math.random()*3;
let gaze = {x:0, z:0}, gazeTarget = {x:0, z:0}, nextGaze = 2;
function setBone(name, x, y, z){ const b = bones[name]; if (!b) return; const m = manual[name]; eul.set((x+m.x)*D, (y+m.y)*D, (z+m.z)*D, 'ZYX'); b.quaternion.copy(rest[name]).multiply(quat.setFromEuler(eul)); }
function blinkCurve(t){ if (t < .06) return t/.06; if (t < .09) return 1; if (t < .16) return 1 - (t-.09)/.07; return 0; }
function tick(){
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (!modelReady || renderPaused) return;
  // alternancia recuadro ↔ pantalla completa durante la noticia
  // la noticia siempre termina en plano medio: se vuelve de la pantalla completa 2 s antes del final,
  // y no se abre una pantalla completa que no alcance a durar al menos 4 s antes de ese margen
  if (activeKind === 'news' && newsLayout && supSrc && P.supAlt && !audio.paused) {
    altT += dt;
    const left = audio.duration > 0 ? audio.duration - audio.currentTime : Infinity;
    if (supMode === 'full' && left <= END_MARGIN) { altT = 0; showSup(true, 'ots'); }
    else if (altT >= P.altSec) {
      const next = supMode === 'ots' ? 'full' : 'ots';
      if (next === 'ots' || left > END_MARGIN + MIN_FULL) { altT = 0; showSup(true, next); }
    }
  }
  // titulares: tras la entrada, cada titular aparece a pantalla completa con su imagen y el cintillo
  if (activeKind === 'host' && hostSegment === 'titulares' && headlines.length && audio.duration > 0 && !audio.paused) {
    // cada titular dura en proporción a su largo (igual que los subtítulos), o según p.headlineMarks si EC1 los envía
    const marks = Array.isArray(headlines.marks) ? headlines.marks : null;
    let idx = -1;
    if (marks) { for (let i = 0; i < marks.length; i++) if (audio.currentTime >= marks[i]) idx = i; }
    else if (audio.currentTime >= hlIntroSec) {
      const ws = headlines.map(h => String(h.title || '').length + 6), tot = ws.reduce((a, b) => a + b, 0) || 1, pos = (audio.currentTime - hlIntroSec) / Math.max(1, audio.duration - hlIntroSec) * tot;
      let acc = 0; idx = headlines.length - 1; for (let i = 0; i < ws.length; i++) { acc += ws[i]; if (pos < acc) { idx = i; break; } }
    }
    if (idx !== hlIdx) { hlIdx = idx; if (idx >= 0) { const h = headlines[idx]; setSupImage(h.image || '', true); $('lowerT').textContent = h.title || ''; $('lCat').textContent = String(h.category || '').toUpperCase(); lowerExcl = !!h.isExclusive; refreshLowerFlags(); showSup(true, 'full'); $('lower').classList.toggle('on', !!h.title); } }
  }
  updateSubs();
  for (const k in toneNow) toneNow[k] += (TONES[toneName][k] - toneNow[k]) * Math.min(1, 1.5 * dt);
  const lvl = readLevel(dt);
  mouth += (lvl - mouth) * Math.min(1, (lvl > mouth ? 35 : P.release) * dt);
  const open = mouth * P.maxOpen;
  setBone('BOCA_INF', -open, 0, 0); setBone('BOCA_SUP', open * P.upper, 0, 0);
  let lid = 0;
  if (P.blink) { blinkT += dt; if (blinkT >= nextBlink) { lid = blinkCurve(blinkT - nextBlink); if (blinkT - nextBlink > .16) { blinkT = 0; nextBlink = toneNow.blinkMin + Math.random()*(toneNow.blinkMax - toneNow.blinkMin); } } }
  setBone('PARPADOS_MAYA', Math.max(toneNow.lid, lid * 121), 0, 0);
  { const bv = toneNow.brow * P.browAmp, bx = P.browAxis === 'x' ? bv : 0, by = P.browAxis === 'y' ? bv : 0, bz = P.browAxis === 'z' ? bv : 0; setBone('CEJA_L', bx, by, bz); setBone('CEJA_R', bx, by, P.browAxis === 'z' ? -bz : bz); }
  if (P.gazeOn) { nextGaze -= dt; if (nextGaze <= 0) { const away = Math.random() < toneNow.gazeAway; gazeTarget = away ? {x:(Math.random()*2-1)*4, z:(Math.random()*2-1)*9} : {x:0, z:0}; nextGaze = away ? .6 + Math.random()*.8 : 2 + Math.random()*3; } }
  gaze.x += (gazeTarget.x - gaze.x) * Math.min(1, 14*dt); gaze.z += (gazeTarget.z - gaze.z) * Math.min(1, 14*dt);
  setBone('OJO_R', gaze.x, 0, gaze.z); setBone('OJO_L', gaze.x, 0, gaze.z);
  let hx = 0, hy = 0, hz = 0;
  if (P.headOn) { const talk = (1 + mouth*1.5*P.headTalk) * toneNow.sway; hx = Math.sin(t*.9)*1.2*talk + mouth*3*P.headTalk; hy = Math.sin(t*.45 + 1)*3*talk; hz = Math.sin(t*.6 + 2)*2*talk; }
  setBone('CABEZA', hx, hy - P.rotY * P.look, hz);
  const br = P.breath ? Math.sin(t*Math.PI*2/4) : 0;
  setBone('COLUMNA', br*1.2, 0, 0);
  const wd = P.wingDrop + br*1.5, targetE = Math.min(1, mouth*1.6);
  talkE += (targetE - talkE) * Math.min(1, (targetE > talkE ? 2.5 : .8) * dt);
  if (lvl > .75 && prevLvl < .45 && gestT <= 0 && Math.random() < .35) { gestSide = Math.random() < .5 ? 'R' : 'L'; gestT = 1; }
  prevLvl = lvl; gestT = Math.max(0, gestT - dt*1.4);
  const g = Math.sin(Math.PI*gestT) * P.wingTalk * toneNow.wings, en = talkE * P.wingTalk * toneNow.wings;
  const liftR = en*(5 + 3*Math.sin(t*1.3 + .5) + 2*Math.sin(t*2.3)) + (gestSide === 'R' ? g*12 : 0);
  const liftL = en*(5 + 3*Math.sin(t*1.1 + 2.1) + 2*Math.sin(t*2.7 + 1)) + (gestSide === 'L' ? g*12 : 0);
  const fwdR = en*(4 + 3*Math.sin(t*.9 + 1.2)) + (gestSide === 'R' ? g*10 : 0), fwdL = en*(4 + 3*Math.sin(t*.8 + 3)) + (gestSide === 'L' ? g*10 : 0);
  setBone('ALA_SUP_R', fwdR, 0, -(wd - liftR)); setBone('ALA_SUP_L', fwdL, 0, wd - liftL);
  updateCamera(dt);
  renderer.render(scene, camera);
}
applyScene();
requestAnimationFrame(tick);
showStandby();
window.__merlinOutput = { P, cams, setCam, showSup, state:() => ({activeKind, camIdx, supMode, supShown, newsLayout, tainted, toneName, hlIdx, subs:$('subs').textContent}) };
})();
````

### `src/renderer-merlin.js`

````javascript
'use strict';
// Selector del modo de salida: clásico (placa de EC1) o Merlín (presentador 3D en el set).
// Lab29 reconstruye la pestaña Emisión (renderer-emission-design-v2.js) y oculta la vista previa antigua,
// así que la tarjeta se ubica junto a la vista previa nueva (#ecEmissionV2PreviewCard) y se reubica si la interfaz cambia.
(function installMerlinMode(){
  if (window.__merlinModeInstalled) return; window.__merlinModeInstalled = true;
  const api = window.ECAPI;
  let card = null, sel = null, note = null, started = Date.now();
  function build(){
    card = document.createElement('div');
    card.id = 'merlinPresenterCard'; card.className = 'card top-gap';
    card.innerHTML = '<div class="section-head"><div><h3>Modo de salida</h3><p class="note">Presentador</p></div><span class="mini-pill">MERLÍN</span></div>'
      + '<label>Salida<select id="presenterMode"><option value="clasico">Clásica (imagen con titular y bajada)</option><option value="merlin">Merlín en el set (presentador 3D)</option></select></label>'
      + '<p class="note" id="presenterModeNote">Merlín usa el mismo audio, imagen, titular y bajada de cada noticia. Al cambiar el modo, la ventana de salida se recarga.</p>';
    sel = card.querySelector('#presenterMode'); note = card.querySelector('#presenterModeNote');
    api.presenterGet().then(r => { sel.value = (r && r.mode) === 'merlin' ? 'merlin' : 'clasico'; }).catch(() => {});
    sel.addEventListener('change', async () => {
      sel.disabled = true;
      try { const r = await api.presenterSet(sel.value); note.textContent = r && r.reopened ? 'Listo: la ventana de salida se recargó con el nuevo modo.' : 'Listo: el modo se usará la próxima vez que abras la salida.'; }
      catch (e) { note.textContent = 'No se pudo cambiar el modo: ' + (e && e.message || e); }
      finally { sel.disabled = false; }
    });
  }
  const visible = el => !!el && !el.closest('.ec-v2-legacy-hidden') && getComputedStyle(el).display !== 'none';
  function anchor(){
    const v2 = document.getElementById('ecEmissionV2PreviewCard');
    if (v2) return v2;
    // sin el diseño v2 (o mientras se construye) se espera unos segundos antes de usar la vista previa clásica
    if (Date.now() - started < 8000) return null;
    const old = document.querySelector('#tab-emission .preview-card') || document.querySelector('.preview-card');
    return visible(old) ? old : null;
  }
  function place(){
    if (!api || typeof api.presenterGet !== 'function') return;
    const a = anchor(); if (!a) return;
    if (!card) build();
    if (card.previousElementSibling !== a || !card.isConnected) a.insertAdjacentElement('afterend', card);
  }
  const timer = setInterval(() => { place(); if (card && card.isConnected && Date.now() - started > 15000) clearInterval(timer); }, 500);
  new MutationObserver(() => { if (card && (!card.isConnected || card.previousElementSibling !== anchor())) place(); })
    .observe(document.documentElement, {childList:true, subtree:true});
})();
````

### `src/assets/merlin/presenter-phrases.json`

````json
{
  "_nota": "Frases fijas de Merlín. Rotan al azar sin repetir la última. Se pueden editar; al cambiar un texto, su audio se vuelve a generar con la voz configurada. 'titulares_intro' abre el segmento de titulares (seguido de los titulares reales de la cola).",
  "intro": [
    "Hola, soy Merlín y te acompaño con las noticias de El Comercio. Empezamos.",
    "Bienvenidos. Soy Merlín y estas son las noticias más importantes del momento.",
    "Hola, qué gusto tenerte por aquí. Soy Merlín, y arrancamos con la actualidad.",
    "Muy buenas. Soy Merlín, de El Comercio, y te cuento lo que está pasando.",
    "Hola de nuevo. Soy Merlín y comenzamos con las noticias del día."
  ],
  "pase": [
    "Vamos a una pausa. No te vayas, volvemos enseguida.",
    "Hacemos una breve pausa y regresamos con más noticias.",
    "Ahora te dejo con este contenido. En un momento seguimos.",
    "Una pausa y volvemos. Quédate con nosotros.",
    "Mira esto y enseguida continuamos con la actualidad."
  ],
  "regreso": [
    "Estamos de vuelta. Seguimos con más noticias.",
    "Ya regresamos. Continuamos con la actualidad.",
    "Aquí estamos otra vez. Vamos con la siguiente noticia.",
    "De vuelta con ustedes. Seguimos informando.",
    "Volvimos. Esto es lo que tienes que saber."
  ],
  "despedida": [
    "Eso es todo por ahora. Soy Merlín, gracias por acompañarnos. Hasta la próxima.",
    "Aquí terminamos. Gracias por estar con nosotros, nos vemos pronto.",
    "Hasta aquí las noticias. Soy Merlín y te espero en la próxima edición.",
    "Gracias por acompañarnos. Me despido, hasta pronto."
  ],
  "titulares_intro": [
    "Estos son los titulares de esta hora.",
    "Repasamos lo más importante del momento.",
    "Te cuento los titulares de esta hora."
  ]
}
````

### `src/assets/merlin/presenter-config.js`

````javascript
'use strict';
// Configuración del presentador Merlín (exportada desde la página "Merlín en el set" y ampliada).
// Si vuelves a pegar el texto de "Valores para Claude Code", conserva las secciones subtitulos, reloj, titulares, volumen y expresion.
// Debe quedar: window.MERLIN_CONFIG = { ... };
window.MERLIN_CONFIG = {
  "modelo": "MERLIN1_CORREGIDO.glb (pesos del pico/ojos en CUERPO pasados a CABEZA)",
  "rotacion": "grados, relativos a la pose de reposo: bone.quaternion = rest * Euler(x,y,z, orden ZYX)",
  "lipSync": {
    "hueso": "BOCA_INF",
    "eje": "x",
    "cerrado": 0,
    "abiertoMax": -30,
    "sensibilidad": 11.5,
    "umbralRMS": 0.012,
    "cierrePorSegundo": 12,
    "aperturaPorSegundo": 35,
    "picoSuperior": {
      "hueso": "BOCA_SUP",
      "eje": "x",
      "factor": 0.35,
      "signo": "+"
    }
  },
  "parpadeo": {
    "hueso": "PARPADOS_MAYA",
    "eje": "x",
    "abierto": 0,
    "cerrado": 121,
    "cadaSegundos": [
      3,
      6
    ],
    "duracionMs": 160
  },
  "ojos": {
    "huesos": [
      "OJO_R",
      "OJO_L"
    ],
    "ejeVertical": "x (+ abajo)",
    "ejeHorizontal": "z"
  },
  "cabeza": {
    "hueso": "CABEZA",
    "asentir": "x",
    "girar": "y",
    "inclinar": "z",
    "acompanaAlHablar": 0
  },
  "columna": {
    "hueso": "COLUMNA",
    "respiracion": "x"
  },
  "alas": {
    "alHablar": {
      "intensidad": 1.15,
      "subir": "hasta ~10° + gesto de 12° en acentos (35% de probabilidad)",
      "adelante": "eje X +, hasta ~7° + gesto 10°",
      "energia": "mouth suavizado (sube 2.5/s, baja 0.8/s)"
    },
    "nota": "reparentar ALA_SUP_R y ALA_SUP_L a COLUMNA con attach() al cargar y recapturar su rotación de reposo",
    "bajar": {
      "ALA_SUP_R": {
        "eje": "z",
        "grados": -60
      },
      "ALA_SUP_L": {
        "eje": "z",
        "grados": 60
      }
    }
  },
  "escena": {
    "capas": [
      "FONDO_SET",
      "SILLA",
      "Merlín (canvas transparente)",
      "MESA",
      "MICROFONO",
      "vasos"
    ],
    "camara": {
      "fov": 26,
      "posicion": [
        0,
        1.4,
        3.4
      ],
      "mira": [
        0,
        0.45,
        0
      ]
    },
    "merlin": {
      "x": -0.17,
      "y": 0.07,
      "escala": 1.07,
      "giroY": 33,
      "cabezaMiraCamara": 0.75
    },
    "sombraSilla": 0.2,
    "silla": {
      "escala": 0.52,
      "centroX": 0.43,
      "bordeSuperiorY": 0.35,
      "nota": "fracciones del ancho/alto del cuadro; capa original centro X 0.5286, borde superior 0.1151"
    },
    "microfono": {
      "escala": 0.46,
      "baseX": 0.146,
      "baseY": 0.716,
      "rotacion": -0.5,
      "nota": "ancla = base del brazo, en la capa en (0.125, 0.70)"
    },
    "vasos": {
      "escala": 0.27,
      "x": 0.206,
      "y": 0.83,
      "nota": "ancla = centro inferior, en la capa en (0.499, 0.793)"
    }
  },
  "camaras": {
    "planos": [
      {
        "nombre": "General",
        "zoom": 1.1,
        "desplazX": -0.07,
        "desplazY": -0.03,
        "centradoEnCabeza": false
      },
      {
        "nombre": "Medio",
        "zoom": 1.45,
        "desplazX": 0.11,
        "desplazY": -0.03,
        "centradoEnCabeza": true
      },
      {
        "nombre": "Primer plano",
        "zoom": 2.2,
        "desplazX": 0,
        "desplazY": -0.07,
        "centradoEnCabeza": true
      }
    ],
    "direccionAutomatica": true,
    "alternanciaSeg": 12,
    "planoMedioMerlinX": 0.3,
    "usoPorSegmento": {
      "presentacion": "General",
      "regresoDeEnlatadoOAnuncio": "General",
      "noticia": "Medio con Merlín a la izquierda (x en pantalla 0.3) y recuadro de imagen a la derecha; alterna recuadro y pantalla completa cada 12 s",
      "despedidaOPaseACorte": "Primer plano"
    },
    "nota": "EC1 debe enviar con cada audio el tipo de segmento: intro | news | return | outro, más la imagen y el titular en las noticias",
    "transicion": "smooth",
    "acercamientoLento": "+4% durante el plano",
    "metodo": "CSS transform (translate+scale) en las capas de atrás y de adelante; el 3D usa camera.setViewOffset con el mismo recorte",
    "planoMedioCentradoAuto": true
  },
  "imagenApoyo": {
    "cuadroPared": {
      "activo": false,
      "esquinas": [
        [
          0.7602,
          0.2
        ],
        [
          0.9025,
          0.2063
        ],
        [
          0.8984,
          0.3914
        ],
        [
          0.7548,
          0.3799
        ]
      ],
      "capa": "detrás de la silla, se mueve con las cámaras"
    },
    "tablet": {
      "activo": false,
      "esquinas": [
        [
          0.8194,
          0.5395
        ],
        [
          0.8678,
          0.4951
        ],
        [
          0.9087,
          0.6382
        ],
        [
          0.8585,
          0.6908
        ]
      ],
      "capa": "sobre la mesa"
    },
    "grande": "ots",
    "recuadro": {
      "lado": "right",
      "anchoMax": 0.44,
      "desplazX": -0.01,
      "top": 0.235,
      "aspecto": "16:9",
      "regla": "se ubica en el lado opuesto a la cabeza de Merlín (proyección del hueso CABEZA), separado 0.13×escala; ancho mínimo 22%",
      "animacion": "entra deslizándose + zoom lento"
    },
    "pantallaCompleta": "fundido + zoom lento",
    "zocalo": {
      "planoMedio": "solo p.title en cintillo centrado de 90% de ancho (left/right 5%, bottom 6%), alto fijo de 2 renglones, padding 28/48px, máx. 2 líneas (50px@1920, peso 900, fondo lowerBg, borde izquierdo categoryBg)",
      "pantallaCompleta": "réplica del #lower de EC1: shade + metaRow (p.category, p.pubDate, p.isExclusive) + p.title 70px + p.summary 34px, colores y tipografías de design"
    },
    "datosDeEC1": {
      "evento": "output:story",
      "kind": "news | canned | ad",
      "campos": {
        "imagen": "p.image || p.fallbackImage",
        "titular": "p.title",
        "bajada": "p.summary",
        "categoria": "p.category",
        "fecha": "p.pubDate || p.date",
        "exclusivo": "p.isExclusive",
        "audio": "p.audioUrl"
      },
      "diseno": "output:design (fontFamily, titleColor, summaryColor, dateColor, categoryBgColor, categoryTextColor, lowerBgColor, lowerOpacity, tamaños y pesos de output-0324)",
      "segmentos": "EC1 hoy solo tiene news, canned y ad. Presentación y despedida serían tipos nuevos; el regreso se detecta cuando llega una news después de un canned o ad (plano general al inicio).",
      "conexion": "la página puede escuchar el mismo EventSource /events del servidor LAN de EC1 (output-web-adapter.js), igual que output-web.html"
    },
    "ejemplo": {
      "titular": "Golpe de estado hemor perdido la autonomía del poder",
      "bajada": "ES HORA DE REZAR POQUE DE AQUI EN ADELANTE YA NO HABRÁ SALVACIÓN",
      "categoria": "ACTUALIDAD",
      "fecha": "",
      "exclusivo": true
    },
    "alternarEnNoticias": true,
    "nota": "mapeo en perspectiva con CSS matrix3d desde 4 esquinas; EC1 enviaría la URL de la imagen y el titular de cada noticia por WebSocket"
  },
  "vida": {
    "parpadeo": true,
    "miradas": true,
    "balanceoCabeza": true,
    "respiracion": true,
    "alasIndependientes": true
  },
  "integracion": {
    "entornoDesdeFoto": true,
    "reboteMesa": {
      "color": "#d98a45",
      "intensidad": 0.9,
      "desde": [
        0,
        -1.5,
        2
      ]
    },
    "sombraMesa": {
      "intensidad": 0.48,
      "lineaMesaPantallaY": 0.64,
      "nota": "oscurece fragmentos con Y de mundo cerca del borde de la mesa (onBeforeCompile)"
    },
    "plumas": {
      "normalMapRuido": true,
      "repeticion": 10,
      "intensidad": 0.15
    },
    "blancoCalido": 0.2,
    "filtroCSS": "sepia(0.08) saturate(0.84) contrast(1.08) blur(0.4px)",
    "grano": 0.02,
    "materiales": "MeshPhysicalMaterial respetando rugosidad/metalizado de Blender; MERLIN y ALAS PLUMAS: sheen 0.5/0.4 + normal de plumas; SOMBRERO sheen 0.4; LENTES y OJO clearcoat; metalizado del cuerpo = slider"
  },
  "iluminacion": {
    "toneMapping": "ACESFilmic",
    "exposicion": 0.8,
    "luzPrincipal": 1.15,
    "colorPrincipal": "#ffe4c4 desde arriba-derecha",
    "lampara": "#ffc870 0.35 desde izquierda",
    "relleno": 0.5,
    "contraluz": 0.6,
    "reflejosEntorno": 0.8,
    "metalizado": 0.3
  },
  "ajusteManual": {
    "BOCA_INF": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "BOCA_SUP": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "PARPADOS_MAYA": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "OJO_R": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "OJO_L": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "CABEZA": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "COLUMNA": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "ALA_SUP_R": {
      "x": 0,
      "y": 0,
      "z": 0
    },
    "ALA_SUP_L": {
      "x": 0,
      "y": 0,
      "z": 0
    }
  },
  "subtitulos": {
    "activos": true,
    "nota": "texto exacto del guion (p.script); tiempos estimados por largo de frase"
  },
  "reloj": {
    "activo": true,
    "posicion": "derecha"
  },
  "titulares": {
    "cadaMinutos": 25,
    "cantidad": 3
  },
  "volumen": {
    "objetivoDb": -20,
    "nota": "nivel RMS de la voz (tramos con voz) al que se normaliza; ganancia limitada a -12..+6 dB"
  },
  "expresion": {
    "cejas": {
      "eje": "x",
      "amplitud": 12,
      "nota": "solo si el modelo trae los huesos CEJA_L y CEJA_R"
    }
  }
};
````

### `scripts/check-merlin-output.js`

````javascript
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
````

### `INTEGRACION_MERLIN.md`

````markdown
# Salida "Merlín" (presentador 3D) en GEC Automatic News

Merlín es un modo de salida alternativo. Usa exactamente los mismos datos que la salida clásica: el audio del TTS local mueve el pico, la imagen extraída de la nota se usa como apoyo, y el titular y la bajada son los que genera la IA local de texto. El motor de automatización no cambia.

## Cómo activarlo

1. Abre EC Automatic News.
2. En el panel de control, junto a la **Vista previa de emisión**, aparece la tarjeta **Modo de salida**.
3. Elige **Merlín en el set (presentador 3D)**. Si la ventana de salida está abierta, se recarga sola con Merlín.

El modo se guarda en `data/presenter.json`. En formato vertical 9:16 se usa siempre la salida clásica.

## Cómo se comporta

| Situación | Qué se ve |
|---|---|
| Primera noticia, o noticia justo después de un enlatado o anuncio | Plano general unos 4 s y luego plano medio |
| Noticia | Plano medio con Merlín a la izquierda, la imagen de la nota en un recuadro a la derecha y el titular en el cintillo. Alterna con la imagen a pantalla completa (titular, bajada, categoría, fecha y exclusivo con el diseño de EC1) |
| Noticia sin imagen | Plano medio sin recuadro |
| Enlatado o anuncio | Video a pantalla completa, igual que la salida clásica |

La imagen de la nota también aparece en el cuadro de la pared y en la tablet del set.

Colores, tipografías (incluidas las importadas), tamaños y pesos del titular, bajada, categoría, fecha y exclusivo se toman del diseño configurado en EC1. El volumen de voz, de enlatados y la música también.

## Tus ajustes del prototipo

`src/assets/merlin/presenter-config.js` trae los valores por defecto. Para usar los tuyos:

1. Abre la página **Merlín en el set** y copia todo el texto de **Valores para Claude Code**.
2. Abre `src/assets/merlin/presenter-config.js` y reemplaza el objeto después de `window.MERLIN_CONFIG =` (desde la primera `{` hasta la última `}`), dejando el `;` final.

Opcional: `camaras.generalAlVolverSeg` (segundos de plano general al volver de una pausa, por defecto 4).

## Salida por red local (OBS)

Con la salida LAN activada, Merlín está en `http://IP-DEL-PC:PUERTO/merlin?k=CLAVE` (misma IP, puerto y clave que la salida web actual). En OBS: fuente de navegador de 1920×1080 con "Controlar audio mediante OBS".

## Archivos

Nuevos:
- `src/output-merlin.html`, `src/output-merlin.js`, `src/output-merlin.css` — la salida.
- `src/output-merlin-web.html` — la misma salida para la red local.
- `src/renderer-merlin.js` — tarjeta "Modo de salida" en el panel de control.
- `src/assets/merlin/` — capas del set, modelo (`merlin-model.js`, con las texturas y los pesos corregidos) y `presenter-config.js`.
- `src/vendor/three/` — three.js r147 para funcionar sin internet.
- `scripts/check-merlin-output.js` — verificación incluida en `npm run check`.

Modificados:
- `src/main.js` — `createOutputWindow` carga `output-merlin.html` o `output.html` según el modo; IPC `presenter:get` / `presenter:set`.
- `src/preload.js` — expone la API de salida a `output-merlin.html`, agrega `presenterGet` / `presenterSet` al panel e inyecta `renderer-merlin.js`.
- `src/services/outputLanServer.js` — sirve los archivos de Merlín y la ruta `/merlin`.
- `package.json` — agrega los checks de Merlín.

## Respaldos automáticos

- Si WebGL o el modelo fallan al cargar, la ventana vuelve sola a `output.html`.
- Si el análisis del audio queda bloqueado (silencio absoluto con el audio sonando), el pico usa un movimiento sintético para no quedarse quieto. Se registra en la consola como `[merlin] análisis de audio bloqueado`.

## Video de espera

Igual que la salida clásica: al abrir la salida y al detener la emisión se ve el video de espera configurado (con su música si está activada). Al llegar la primera pieza, se desvanece y aparece Merlín.

## Intervenciones de Merlín

Solo en modo Merlín y en la emisión automática (en la salida clásica se omiten):

| Momento | Segmento | Plano |
|---|---|---|
| Primera pieza de la emisión | `intro` (presentación) | General |
| Antes de un enlatado o anuncio que sigue a una noticia | `pase` | Primer plano |
| Primera noticia después de un enlatado o anuncio | `regreso` | General |
| Al pulsar Detener emisión | `despedida` | Primer plano, luego video de espera |

**Detener emisión en modo Merlín:** si hay una noticia al aire, Merlín la termina de contar, se despide y pasa al video de espera (el panel avisa "Deteniendo…"; tope de espera de 5 minutos). Si hay un enlatado o anuncio, se corta y se despide de inmediato. Si se reanuda la emisión antes de que termine la noticia, la despedida se cancela.

- Las frases son fijas y rotan al azar sin repetir la última: `src/assets/merlin/presenter-phrases.json` (se pueden editar).
- Su audio se genera una sola vez con la voz configurada en EC1 y queda en caché en `data/presenter-voice/`. Si cambias la voz o el texto, se regenera solo. La generación empieza al activar el modo Merlín y unos segundos después de abrir la app.
- Si el audio de una frase aún no está listo, esa intervención se salta para no frenar la emisión.
- Implementación: `presenterHost` al final de `src/main.js` envuelve `deliverToOutput` y `controlOutput`; la salida responde con `ECAPI.presenterHostPlayback` (no con `outputPlayback`, para no interferir con el motor de automatización).

## Diseño en pantalla (versión con subtítulos)

- **Cintillo unificado** en plano medio y pantalla completa: pestaña con sección y exclusivo (colores, opacidad, borde, radio, tipografía, tamaño, peso, texto y visibilidad de **Diseño** de EC1) y titular centrado de dos renglones. En pantalla completa ya no se muestra la bajada.
- **Subtítulos**: caja propia, centrada, encima del cintillo; texto exacto del guion (`p.script`, o `hostText` en las intervenciones) con tiempos estimados por largo de frase y resaltado de las palabras ya dichas. Se activan con `subtitulos.activos` en `presenter-config.js`.
- **Recuadro de la imagen**: respeta la posición configurada y sube lo justo si hay subtítulos, sin tocar el reloj.
- **Plano medio**: la cámara centra a Merlín en el espacio libre a la izquierda del recuadro (`camaras.planoMedioCentradoAuto`).
- **Reloj** arriba a la derecha (hora de la PC, formato `8:45 PM`); se oculta en enlatados, anuncios y espera (`reloj.activo`, `reloj.posicion`).
- **Imágenes**: mismo movimiento que la salida clásica, según **Diseño → Animación** y **Velocidad**.

## Cámara

- Solo cortes de plano a plano: sin acercamiento lento ni deslizamientos.
- Si hay que cambiar de plano y la pantalla está cubierta (pantalla completa, enlatado, espera), el corte se hace cuando la cobertura ya es opaca y recién después se destapa.
- Entre noticias consecutivas en el mismo plano (incluida la **Pausa entre noticias** de EC1) la cámara no se mueve y el cintillo cambia el texto con un fundido corto.

## Expresión según el tono

`p.tone` (`serio` | `neutral` | `ligero`) ajusta balanceo de cabeza, gestos de alas, parpadeo, párpados y miradas. Si el modelo trae los huesos `CEJA_L` y `CEJA_R`, también mueve las cejas (`expresion.cejas.eje` y `amplitud`); si no, se ignoran.

## Volumen normalizado

`presenterHost` mide el nivel de cada voz (WAV del TTS: noticias, intervenciones y titulares) y envía `p.audioGainDb` para llevarlo a `volumen.objetivoDb` (por defecto −20 dBFS RMS, ajuste entre −12 y +6 dB). La salida lo aplica al volumen del elemento (tope 100 %). Enlatados y anuncios también usan `p.audioGainDb` si EC1 lo envía.

## Titulares periódicos

Cada `titulares.cadaMinutos` (25 por defecto), antes de una noticia, Merlín dice una entrada fija (`titulares_intro` en `presenter-phrases.json`) y los titulares reales de las próximas `titulares.cantidad` noticias listas de la cola; cada titular aparece a pantalla completa con su imagen y el cintillo, sincronizado con `headlineMarks`. El audio se prepara unos 90 s antes; si no está listo, se salta y se intenta en la siguiente noticia. `presenterHost.titularesNow()` los fuerza en la próxima noticia.
````

### `CLAUDE.md`

````markdown
Responde siempre en español.

# GEC Automatic News (V2.0 TTS Lab)

App de escritorio Electron (Windows, portable) que arma una emisión automática de noticias: lee RSS, extrae la nota y su imagen, una IA local escribe titular, bajada y guion, un TTS local genera la voz, y la ventana de salida lo emite. Hay también enlatados (videos) y anuncios. La interfaz y los mensajes están en español.

## Cómo se trabaja en este repo

- La app se compila **solo en GitHub Actions** (`.github/workflows/build-windows.yml`, en `windows-latest`) con cada push a `main`. El artefacto es un EXE portable.
- Antes de hacer commit: `npm run check` (checks estáticos y de regresión; exige Node 22 y Python 3.12). Si algo falla, explicar la causa antes de cambiar código.
- El proyecto crece por **archivos versionados** que parchean a los anteriores (`renderer-0324.js` … `renderer-0332.js`, `output-0324.js` … `output-0331.js`, `services/*0329.js`, etc.). No reescribir ni borrar los anteriores: agregar comportamiento nuevo en archivos nuevos o en puntos acotados, y sumar su `node --check` al script `check` de `package.json`.
- `src/preload.js` inyecta los scripts versionados según la página (`control.html`, `output.html`) y expone `window.ECAPI` (API de salida para las páginas de output, API de control para el panel).
- Entrada: `src/bootstrap-v2lab.js` → cadena de bootstraps → `src/main.js`.

## Contrato de la ventana de salida

La salida escucha, vía `window.ECAPI.on`:
- `output:story` → `p.kind` (`news` | `canned`; los anuncios llegan como canned con `p.mediaRole === 'ad'`). Noticia: `p.title` (titular de la IA), `p.summary` (bajada de la IA), `p.category`, `p.pubDate`, `p.isExclusive`, `p.image` / `p.fallbackImage` / `p.preloadImage`, `p.audioUrl` (WAV del TTS, `file://`). Enlatado: `p.videoUrl`.
- `output:design` → colores, tipografías, tamaños, volúmenes, música (ver `output-0324.js` / `output-0325.js`).
- `output:control` → `play` | `pause` | `stop`.

Y **debe** responder `ECAPI.outputPlayback({type:'ended'|'error', source, kind, message})` al terminar o fallar cada pieza; sin eso la automatización no avanza.

La salida también se publica en red local (`services/outputLanServer.js`, EventSource `/events`) para OBS.

## Salida "Merlín" (presentador 3D)

Ver `INTEGRACION_MERLIN.md`. Resumen:
- Archivos: `src/output-merlin.html|js|css`, `src/output-merlin-web.html` (LAN, ruta `/merlin`), `src/renderer-merlin.js` (tarjeta "Modo de salida" en el panel), `src/assets/merlin/` (capas del set, `merlin-model.js` con el GLB incrustado, `presenter-config.js`), `src/vendor/three/` (three.js r147 UMD, sin CDN).
- El modo (`clasico` | `merlin`) se guarda en `data/presenter.json` vía IPC `presenter:get` / `presenter:set` en `main.js`; `createOutputWindow` carga la página según el modo. En 9:16 siempre es la clásica.
- **No modificar la salida clásica** (`output.html` y sus versionados) al trabajar en Merlín.
- `presenter-config.js` contiene `window.MERLIN_CONFIG`, el JSON exportado desde el prototipo web "Merlín en el set" (posiciones, cámaras, luz, lip sync, imagen de apoyo). Los valores de animación y escena salen de ahí, no se hardcodean.
- Dirección de cámaras: plano general al inicio y al volver de un enlatado o anuncio (~4 s), plano medio con la imagen de la nota en recuadro a la derecha y cintillo con solo el titular, alternando con pantalla completa (titular, bajada, categoría, fecha, exclusivo con el diseño de EC1). Primer plano reservado para despedida o pase a corte.
- Huesos usados: `BOCA_INF` (abre en X negativo), `BOCA_SUP` (X positivo), `PARPADOS_MAYA` (X: 0 abierto, 121 cerrado), `OJO_R`/`OJO_L`, `CABEZA`, `COLUMNA`, `ALA_SUP_R`/`ALA_SUP_L` (se reparentan a `COLUMNA` al cargar). Rotaciones relativas a la pose de reposo.
- Respaldos: si WebGL o el modelo fallan, vuelve a `output.html`; si el análisis de audio queda bloqueado, lip sync sintético.

## Intervenciones de Merlín (hechas)

Presentación, pase a corte, regreso y despedida con frases fijas (`src/assets/merlin/presenter-phrases.json`), audio generado con el TTS local y cacheado en `data/presenter-voice/`. Lógica en `presenterHost` (final de `src/main.js`); la salida maneja `p.kind === 'host'` y avisa el fin con `ECAPI.presenterHostPlayback`. En la salida clásica se omiten. Ver `INTEGRACION_MERLIN.md`.

## Merlín: subtítulos, cintillo, reloj, cámara, expresión, volumen y titulares (hechos)

Ver `INTEGRACION_MERLIN.md` (secciones "Diseño en pantalla", "Cámara", "Expresión", "Volumen normalizado" y "Titulares periódicos"). Opciones nuevas en `presenter-config.js`: `subtitulos`, `reloj`, `titulares`, `volumen`, `expresion`, `camaras.planoMedioCentradoAuto`.

## Pendiente

- Integrar en modo Merlín la promo de YouTube y el envío por NDI, que hoy solo están en la salida clásica.
````

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
4. Commit: "Merlín: cintillo, subtítulos, reloj, cámara, expresión, volumen y titulares", push a la rama y abre la pull request.
