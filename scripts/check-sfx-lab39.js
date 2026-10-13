'use strict';
// Lab.39 · sonidos de transición (motor Web Audio, reglas, configuración por perfil, ganchos en la salida y el panel),
// opciones del Diseño que cambian con Noticias con movimiento y Claude Haiku 5.5.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),src=f=>fs.readFileSync(path.join(root,'src',f),'utf8');
let checks=0;const ok=(c,m)=>{checks++;if(!c){console.error('check-sfx-lab39: '+m);process.exit(1);}};

// ---- configuración (news-motion.json, por perfil)
const nm=require('../src/services/newsMotionLab37.js');
const d=nm.normalizeConfig({}).sfx;
ok(d.enabled===true&&d.style==='normal'&&d.volume===45,'valores por defecto de los sonidos');
ok(d.events.sting&&d.events.plane&&d.events.dato&&d.events.ex&&d.events.host&&d.events.card===false,'eventos por defecto (datos clave apagado)');
const c=nm.normalizeConfig({sfx:{enabled:false,style:'raro',volume:180,events:{card:true,sting:false,otro:true}}}).sfx;
ok(c.enabled===false&&c.style==='normal'&&c.volume===100&&c.events.card===true&&c.events.sting===false&&!('otro' in c.events),'normaliza estilo, volumen y eventos');
ok(nm.normalizeConfig({sfx:{volume:-4}}).sfx.volume===0&&nm.normalizeConfig({sfx:{volume:'x'}}).sfx.volume===45,'volumen fuera de rango');

// ---- motor: Web Audio simulado, cuenta cuántas fuentes de sonido se programan
let T=0,sources=0;const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}});
const node=extra=>Object.assign({connect(){},disconnect(){},start(){sources++;},stop(){},gain:param(),frequency:param(),Q:param(),pan:param(),detune:param(),threshold:param(),ratio:param(),attack:param(),release:param()},extra||{});
class FakeCtx{constructor(){this.state='running';this.currentTime=0;this.sampleRate=8000;this.destination=node();}resume(){return Promise.resolve();}
  createGain(){return node();}createDynamicsCompressor(){return node();}createBiquadFilter(){return node();}createStereoPanner(){return node();}createOscillator(){return node();}createBufferSource(){return node();}createConvolver(){return node();}
  createBuffer(ch,len){return{getChannelData:()=>new Float32Array(len)};}}
const ctxWin={performance:{now:()=>T*1000},Math,Number,Set,Object,Float32Array,Promise};ctxWin.window=ctxWin;ctxWin.AudioContext=FakeCtx;
vm.createContext(ctxWin);vm.runInContext(src('gec-sfx-lab39.js'),ctxWin);
ok(ctxWin.GECSfx&&typeof ctxWin.GECSfx.create==='function','GECSfx.create');
const e=ctxWin.GECSfx.create();const cfg=nm.normalizeConfig({}).sfx;e.setConfig(cfg);
const play=(k,o,t)=>{T=t;const b=sources;const r=e.play(k,o||{});return r&&sources>b;};
ok(play('sting',{},0),'golpe de marca suena');
ok(!play('plane',{wipe:true},1.5),'cambio de plano justo después del golpe de marca no suena');
ok(play('plane',{wipe:true},2.5),'cambio de plano con barrido suena');
ok(!play('plane',{wipe:true},4),'el mismo efecto no se repite antes de 3 s');
ok(play('dato',{},4),'efectos de tipos distintos suenan juntos');
ok(!play('plane',{wipe:false},9),'con fundido el cambio de plano no suena');
ok(!play('card',{},9),'datos clave apagado por defecto');
ok(play('ex',{delay:.6},9)&&play('host',{},9),'exclusivo e intervención suenan');
e.setConfig({...cfg,enabled:false});ok(!play('sting',{},30),'apagado no suena');
ok(e.test('card')===true,'«Probar» suena aunque esté apagado');
e.setConfig({...cfg,events:{...cfg.events,card:true}});ok(play('card',{},40),'datos clave activado suena');

// ---- salida: ganchos, carga y NDI
const out=src('output-news-motion-lab37.js');
ok(/sfx\('sting',\{ex:exclusiveOn\(p\)\}\)/.test(out),'golpe de marca llama al sonido');
ok(/sfx\(pl\.type==='dato'\?'dato':'plane',\{wipe:lvl\(\)\.wipe\}\)/.test(out)&&/sfx\('ex',\{delay:\.6\}\)/.test(out)&&/if\(on\)sfx\('card'\)/.test(out),'planos, dato, exclusivo y datos clave llaman al sonido');
ok(/window\.__gecSfx\?\.play\('host'/.test(src('output-classic-host-lab38.js')),'intervenciones llaman al sonido');
ok(/window\.__GEC_NDI_AUDIO__=\{ctx,mix\}/.test(src('output-ndi-audio.js'))&&/__GEC_NDI_AUDIO__/.test(src('output-sfx-lab39.js')),'en NDI el sonido va a la mezcla que se envía');
ok(/design\.newsMotion\.sfx/.test(src('output-sfx-lab39.js')),'la salida toma la configuración del Diseño');
const pre=src('preload.js');
ok(/output-classic-host-lab38\.js'\}\);injectAsset\('script',\{src:'gec-sfx-lab39\.js'\}\);injectAsset\('script',\{src:'output-sfx-lab39\.js'\}\)/.test(pre),'preload inyecta los sonidos en output.html');
ok(/gec-sfx-lab39\.js'\}\);injectAsset\('script',\{src:'renderer-news-motion-lab37\.js'\}\)/.test(pre),'preload carga el motor en el panel (Probar)');
ok(/gec-sfx-lab39\.js/.test(src('output-web.html'))&&/output-sfx-lab39\.js/.test(src('output-web.html'))&&/'gec-sfx-lab39\.js','output-sfx-lab39\.js'/.test(src('services/outputLanServer.js')),'salida LAN (OBS) con sonidos');

// ---- panel
const r=src('renderer-news-motion-lab37.js');
ok(/\$\('#cannedVolume'\)/.test(r)&&/Volumen efectos de transición/.test(r)&&/id="gecNmSfxVol"/.test(r),'volumen de efectos en Música y mezcla, junto a los otros volúmenes');
ok(/data-e="sting"/.test(r)&&/data-e="host"/.test(r)&&/data-e="card"/.test(r)&&/id="gecNmSfxStyle"/.test(r)&&/data-try=/.test(r),'sección Sonidos en la ventana del movimiento');
ok(/next\.sfx = \{\.\.\.\(cfg\.sfx \|\| \{\}\), enabled:/.test(r),'guardar conserva el volumen elegido en Música y mezcla');
ok(/Se aplica entre noticias y contenidos o anuncios\./.test(r),'texto del fundido corregido');
ok(/gecNmObsAnim/.test(r)&&/solo se aplican a Merlín/.test(r),'nota en Animación de imagen y Velocidad');
ok(/gecNmObsPrev/.test(r)&&/\$\('#designPreview'\)/.test(r),'nota en la Vista previa de emisión');
ok(/Colores, ticker y sonidos…/.test(r),'botón renombrado');

// ---- Claude Haiku 5.5
const prov=require('../src/services/providers.js');// settings.js necesita electron: se revisa como texto
ok(prov.DEFAULT_CLAUDE_MODEL==='claude-haiku-5-5'&&/const DEFAULT_CLAUDE_MODEL='claude-haiku-5-5';/.test(src('services/settings.js')),'modelo de Claude: Haiku 5.5');
const body=prov.claudeBody('claude-haiku-5-5',650,[{role:'user',content:'x'}]);
ok(body.thinking?.type==='disabled'&&body.max_tokens===845&&!('temperature' in body),'Haiku 5.5: sin pensamiento, tope ~30 % mayor, sin temperature');
ok(/value="claude-haiku-5-5"/.test(src('control.html'))&&/<h3>Claude Haiku 5\.5<\/h3>/.test(src('control.html'))&&!/haiku-4-5/.test(src('renderer-ui.js')+src('renderer.js')),'panel con Haiku 5.5');
ok(/\/\^claude-haiku-4-5\/\.test/.test(src('services/settings.js'))&&/\/\^claude-haiku-4-5\/\.test/.test(src('services/profileSettingsValidation0329.js')),'ajustes guardados con Haiku 4.5 pasan a 5.5');

console.log(`check-sfx-lab39 OK (${checks} verificaciones) · motor · reglas · salida · NDI · LAN · panel · Haiku 5.5`);
