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
  medX:num('camaras.planoMedioMerlinX',0.3), altSec:num('camaras.alternanciaSeg',12), trans:get('camaras.transicion','cut'), kenBurns:get('camaras.acercamientoLento',true) !== false, introSec:num('camaras.generalAlVolverSeg',4),
  // imagen de apoyo
  supFrame:get('imagenApoyo.cuadroPared.activo',true), supTab:get('imagenApoyo.tablet.activo',true), supAlt:get('imagenApoyo.alternarEnNoticias',true),
  otsSide:get('imagenApoyo.recuadro.lado','auto'), otsW:num('imagenApoyo.recuadro.anchoMax',0.4), otsX:num('imagenApoyo.recuadro.desplazX',0), otsY:num('imagenApoyo.recuadro.top',0.06),
  // integración
  envPhoto:get('integracion.entornoDesdeFoto',true), bounce:num('integracion.reboteMesa.intensidad',0.45), occ:num('integracion.sombraMesa.intensidad',0.35), deskLine:num('integracion.sombraMesa.lineaMesaPantallaY',0.63),
  feather:num('integracion.plumas.intensidad',0.35), whiteTone:num('integracion.blancoCalido',0.05), filter:String(get('integracion.filtroCSS','sepia(0.04) saturate(0.95) contrast(0.97) blur(0.4px)')), grainA:num('integracion.grano',0.16),
  // luz
  exposure:num('iluminacion.exposicion',0.8), keyI:num('iluminacion.luzPrincipal',1), envI:num('iluminacion.reflejosEntorno',0.5), metal:num('iluminacion.metalizado',0)
};
const planes = get('camaras.planos', null);
let cams = Array.isArray(planes) && planes.length === 3 ? planes.map(p => ({z:Number(p.zoom)||1, dx:Number(p.desplazX)||0, dy:Number(p.desplazY)||0}))
  : [{z:1,dx:0,dy:0},{z:1.75,dx:-0.03,dy:-0.02},{z:2.3,dx:-0.02,dy:-0.05}];
const BONES = ['BOCA_INF','BOCA_SUP','PARPADOS_MAYA','OJO_R','OJO_L','CABEZA','COLUMNA','ALA_SUP_R','ALA_SUP_L'];
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
function camGoal(i){
  const c = cams[i]; let cx = 0.5 + c.dx, cy = 0.5 + c.dy;
  if (i > 0) { const h = headScreen(); cx = h.x + c.dx; cy = h.y + c.dy; if (i === 1 && newsLayout) cx = h.x + (0.5 - P.medX) / c.z; }
  const half = 0.5 / c.z;
  return { z:c.z, cx:Math.min(1-half, Math.max(half, cx)), cy:Math.min(1-half, Math.max(half, cy)) };
}
function setCam(i, instant){
  camIdx = i; camTarget = camGoal(i); kb = 0;
  if (instant || P.trans === 'cut') camNow = {...camTarget};
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
function setSupImage(src){
  supSrc = src || '';
  document.querySelectorAll('#framePlane img, #tabPlane img, #ots img, #full > img').forEach(im => { if (src) im.src = src; });
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
  const ots = $('ots'); ots.style.left = (left*100).toFixed(2)+'%'; ots.style.width = (w*100).toFixed(2)+'%'; ots.style.top = (P.otsY*100).toFixed(2)+'%';
}
function showSup(on, mode){
  supMode = mode || supMode; supShown = !!on && !!supSrc;
  if (supMode === 'ots') placeOts();
  $('ots').classList.toggle('on', supShown && supMode === 'ots');
  $('full').classList.toggle('on', supShown && supMode === 'full');
  $('lower').classList.toggle('on', !!on && activeKind === 'news' && supMode !== 'full' && !!$('lowerT').textContent);
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
  audio.volume = vol(d.voiceVolume == null ? 100 : d.voiceVolume); video.volume = vol(d.cannedVolume == null ? 100 : d.cannedVolume);
  syncCustomFonts(d.customFonts).catch(() => {});
}
function ecDate(v){ if (!v) return ''; const d = new Date(v); if (isNaN(d)) return ''; try { return new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'short',year:'numeric'}).format(d).replace(/\./g,'').toUpperCase(); } catch { return ''; } }

// ---------------------------------------------------------------- audio y lip sync
const audio = $('audio'), music = $('music'), video = $('cannedVideo');
let actx = null, analyser = null, buf = new Float32Array(1024), tainted = false, silentFrames = 0, synthT = 0;
function ensureAudioGraph(){
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 1024;
    actx.createMediaElementSource(audio).connect(analyser); analyser.connect(actx.destination);
  } catch (e) { log('Web Audio no disponible, se usa lip sync sintético', e); tainted = true; }
}
function readLevel(dt){
  if (!analyser || audio.paused || audio.ended || activeKind !== 'news') { silentFrames = 0; return 0; }
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

// ---------------------------------------------------------------- flujo de historias (mismo contrato que output.js)
let activeKind = 'none', source = 'none', serial = 0, afterBreak = true, altT = 0, introTimer = null, renderPaused = false;
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
async function showNews(p, my){
  clearTimeout(introTimer);
  const img = p.image || p.fallbackImage || '';
  let ok = await waitImage(img);
  let src = ok ? img : '';
  if (!ok && p.fallbackImage && p.fallbackImage !== img) { ok = await waitImage(p.fallbackImage); src = ok ? p.fallbackImage : ''; }
  if (my !== serial) return;
  if (p.preloadImage) { const pre = new Image(); pre.src = p.preloadImage; }
  // textos generados por la IA local de EC1
  $('lowerT').textContent = p.title || '';
  $('fTitle').textContent = p.title || ''; $('fSummary').textContent = p.summary || '';
  $('fCat').textContent = String(p.category || 'ACTUALIDAD').toUpperCase(); $('fDate').textContent = ecDate(p.pubDate || p.date || '');
  $('fExcl').classList.toggle('show', !!p.isExclusive && design.exclusiveEnabled !== false);
  const wasBreak = afterBreak; afterBreak = false;
  activeKind = 'news'; hideCanned(); showSup(false);
  setSupImage(src);
  // dirección: tras una pausa (inicio, enlatado o anuncio) abre en plano general; luego plano medio con la imagen
  const toNews = () => { if (my !== serial) return; newsLayout = true; setCam(1); shotDur = P.altSec; altT = 0; showSup(true, 'ots'); };
  if (wasBreak) { newsLayout = false; setCam(0); introTimer = setTimeout(toNews, P.introSec * 1000); } else toNews();
  startMusic().catch(() => {});
  ensureAudioGraph(); if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  synthT = 0; silentFrames = 0;
  audio.volume = vol(design.voiceVolume == null ? 100 : design.voiceVolume);
  if (p.audioUrl) { audio.src = p.audioUrl; audio.currentTime = 0; audio.play().catch(e => playback('error', e.message || 'No se pudo iniciar el audio')); }
  else playback('ended');
}
async function showCanned(p, my){
  clearTimeout(introTimer); audio.pause();
  activeKind = 'canned'; afterBreak = true; showSup(false); $('lower').classList.remove('on');
  try { await (async () => { if (!music.paused) music.pause(); })(); } catch {}
  video.src = p.videoUrl || ''; video.volume = vol(design.cannedVolume == null ? 100 : design.cannedVolume); video.load();
  if (my !== serial) return;
  $('cannedLayer').classList.add('on');
  setTimeout(() => { if (activeKind === 'canned') renderPaused = true; }, 800);
  video.play().catch(e => playback('error', e.message || 'No se pudo reproducir el video'));
}
audio.addEventListener('ended', () => { if (activeKind === 'news') playback('ended'); });
audio.addEventListener('error', () => { if (activeKind === 'news' && audio.src) playback('error', 'No se pudo cargar el audio'); });
video.addEventListener('ended', () => { if (activeKind === 'canned') playback('ended'); });
video.addEventListener('error', () => { if (activeKind === 'canned' && video.getAttribute('src')) playback('error', 'No se pudo cargar el video'); });

const api = window.ECAPI;
if (api) {
  api.on('output:design', d => applyDesign(d || {}));
  api.on('output:story', p => {
    p = p || {}; source = p.source || 'none'; if (p.design) applyDesign(p.design);
    const my = ++serial;
    if ((p.kind || 'news') === 'canned') showCanned(p, my).catch(e => playback('error', e.message || String(e)));
    else showNews(p, my).catch(e => playback('error', e.message || String(e)));
  });
  api.on('output:control', a => {
    if (a === 'play') { if (activeKind === 'canned') video.play().catch(() => {}); else { audio.play().catch(() => {}); startMusic().catch(() => {}); } }
    if (a === 'pause') { if (activeKind === 'canned') video.pause(); else audio.pause(); music.pause(); }
    if (a === 'stop') { audio.pause(); try { audio.currentTime = 0; } catch {} video.pause(); music.pause(); clearTimeout(introTimer); showSup(false); hideCanned(); activeKind = 'none'; afterBreak = true; newsLayout = false; setCam(0); }
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
  if (activeKind === 'news' && newsLayout && supSrc && P.supAlt && !audio.paused) {
    altT += dt;
    if (altT >= P.altSec) {
      altT = 0; const next = supMode === 'ots' ? 'full' : 'ots'; showSup(true, next);
      if (next === 'full') setTimeout(() => { if (supMode === 'full' && supShown) kb = 0; }, 700);
    }
  }
  const lvl = readLevel(dt);
  mouth += (lvl - mouth) * Math.min(1, (lvl > mouth ? 35 : P.release) * dt);
  const open = mouth * P.maxOpen;
  setBone('BOCA_INF', -open, 0, 0); setBone('BOCA_SUP', open * P.upper, 0, 0);
  let lid = 0;
  if (P.blink) { blinkT += dt; if (blinkT >= nextBlink) { lid = blinkCurve(blinkT - nextBlink); if (blinkT - nextBlink > .16) { blinkT = 0; nextBlink = 3 + Math.random()*3; } } }
  setBone('PARPADOS_MAYA', lid * 121, 0, 0);
  if (P.gazeOn) { nextGaze -= dt; if (nextGaze <= 0) { const away = Math.random() < .3; gazeTarget = away ? {x:(Math.random()*2-1)*4, z:(Math.random()*2-1)*9} : {x:0, z:0}; nextGaze = away ? .6 + Math.random()*.8 : 2 + Math.random()*3; } }
  gaze.x += (gazeTarget.x - gaze.x) * Math.min(1, 14*dt); gaze.z += (gazeTarget.z - gaze.z) * Math.min(1, 14*dt);
  setBone('OJO_R', gaze.x, 0, gaze.z); setBone('OJO_L', gaze.x, 0, gaze.z);
  let hx = 0, hy = 0, hz = 0;
  if (P.headOn) { const talk = 1 + mouth*1.5*P.headTalk; hx = Math.sin(t*.9)*1.2*talk + mouth*3*P.headTalk; hy = Math.sin(t*.45 + 1)*3*talk; hz = Math.sin(t*.6 + 2)*2*talk; }
  setBone('CABEZA', hx, hy - P.rotY * P.look, hz);
  const br = P.breath ? Math.sin(t*Math.PI*2/4) : 0;
  setBone('COLUMNA', br*1.2, 0, 0);
  const wd = P.wingDrop + br*1.5, targetE = Math.min(1, mouth*1.6);
  talkE += (targetE - talkE) * Math.min(1, (targetE > talkE ? 2.5 : .8) * dt);
  if (lvl > .75 && prevLvl < .45 && gestT <= 0 && Math.random() < .35) { gestSide = Math.random() < .5 ? 'R' : 'L'; gestT = 1; }
  prevLvl = lvl; gestT = Math.max(0, gestT - dt*1.4);
  const g = Math.sin(Math.PI*gestT) * P.wingTalk, en = talkE * P.wingTalk;
  const liftR = en*(5 + 3*Math.sin(t*1.3 + .5) + 2*Math.sin(t*2.3)) + (gestSide === 'R' ? g*12 : 0);
  const liftL = en*(5 + 3*Math.sin(t*1.1 + 2.1) + 2*Math.sin(t*2.7 + 1)) + (gestSide === 'L' ? g*12 : 0);
  const fwdR = en*(4 + 3*Math.sin(t*.9 + 1.2)) + (gestSide === 'R' ? g*10 : 0), fwdL = en*(4 + 3*Math.sin(t*.8 + 3)) + (gestSide === 'L' ? g*10 : 0);
  setBone('ALA_SUP_R', fwdR, 0, -(wd - liftR)); setBone('ALA_SUP_L', fwdL, 0, wd - liftL);
  updateCamera(dt);
  renderer.render(scene, camera);
}
applyScene();
requestAnimationFrame(tick);
window.__merlinOutput = { P, cams, setCam, showSup, state:() => ({activeKind, camIdx, supMode, supShown, newsLayout, tainted}) };
})();
