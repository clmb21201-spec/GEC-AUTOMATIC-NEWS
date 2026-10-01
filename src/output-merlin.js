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
