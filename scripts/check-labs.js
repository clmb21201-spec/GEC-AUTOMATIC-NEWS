'use strict';
// Checks de los labs nuevos (Lab.33 en adelante). En Windows el script "check" de package.json no puede pasar de
// 8191 caracteres (límite de cmd.exe: "The command line is too long"), así que los checks nuevos se agregan aquí
// en vez de alargar package.json. Se ejecutan en orden y se detiene en el primero que falla.
const {spawnSync}=require('child_process');
const path=require('path');
const root=path.join(__dirname,'..');
const STEPS=[
  // Lab.33 · horario automático y transmisión a YouTube (OBS)
  ['--check','src/services/obsWebSocketLab33.js'],
  ['--check','src/services/broadcastScheduleLab33.js'],
  ['--check','src/renderer-schedule-lab33.js'],
  ['scripts/check-broadcast-schedule-lab33.js'],
  // Lab.34 · voz de Qwen que no se detiene (tope por texto, regenerar o recortar, control antes de emitir)
  ['--check','src/services/ttsRunawayGuardLab34.js'],
  ['scripts/check-tts-runaway-lab34.js'],
  {py:['-m','py_compile','src/qwen_runaway_lab34.py']},
  {py:['scripts/check-qwen-runaway-lab34.py']},
  // Lab.35 · control desde el celular con ntfy
  ['--check','src/services/remoteNtfyLab35.js'],
  ['--check','src/renderer-remote-ntfy-lab35.js'],
  ['scripts/check-remote-ntfy-lab35.js'],
  // Lab.36 · audios de voz para edición (.wav + .txt + .srt) y Merlín solo con su página cargada
  ['--check','src/services/voiceArchiveLab36.js'],
  ['--check','src/renderer-voice-archive-lab36.js'],
  ['scripts/check-voice-archive-lab36.js'],
  // Lab.37 · noticias con movimiento en la salida clásica (planos, datos clave, voz, ticker, golpe de marca)
  ['--check','src/services/newsMotionLab37.js'],
  ['--check','src/output-news-motion-lab37.js'],
  ['--check','src/renderer-news-motion-lab37.js'],
  ['scripts/check-news-motion-lab37.js'],
  // Lab.38 · intervenciones de la vista clásica por perfil (15 versiones, logo, fondo, frases, cierre)
  ['--check','src/services/classicHostLab38.js'],
  ['--check','src/output-classic-host-render-lab38.js'],
  ['--check','src/output-classic-host-lab38.js'],
  ['--check','src/renderer-classic-host-lab38.js'],
  ['scripts/check-classic-host-lab38.js'],
  // Lab.39 · sonidos de transición, opciones del Diseño que cambian con el movimiento y Claude Haiku 5.5
  ['--check','src/gec-sfx-lab39.js'],
  ['--check','src/output-sfx-lab39.js'],
  ['scripts/check-sfx-lab39.js'],
  // Lab.40 · vista previa de Noticias con movimiento en la ventana del panel
  ['--check','src/output-news-motion-preview-adapter.js'],
  ['scripts/check-news-motion-preview-lab40.js'],
  // Lab.41 · murmullos de Qwen antes de la primera palabra y retumbo grave en las pausas
  {py:['-m','py_compile','src/qwen_onset_lab41.py']},
  {py:['scripts/check-qwen-onset-lab41.py']},
  // Lab.42 · carpeta de datos e IAs que sobrevive a cada versión nueva del EXE
  ['--check','src/services/dataLocationLab42.js'],
  ['--check','src/renderer-data-location-lab42.js'],
  ['scripts/check-data-location-lab42.js'],
  // Lab.43 · el perfil exportado lleva movimiento, sonidos, intervenciones (logo y fondo) y horario
  ['--check','src/services/profileExtrasLab43.js'],
  ['scripts/check-profile-extras-lab43.js'],
  // Lab.44 · meta de RTF 0,65 en la voz y optimización rápida
  ['--check','src/services/optimizationQuickLab44.js'],
  ['--check','src/renderer-optimization-quick-lab44.js'],
  ['scripts/check-optimization-quick-lab44.js'],
  // Lab.45 · cifras con dinero y millones («tres punto dos millones de soles»)
  ['--check','src/services/moneySpeechLab45.js'],
  ['scripts/check-money-speech-lab45.js'],
  // Lab.46 · horas con a. m. / p. m., fechas, ordinales, decimales, femeninos y punto final de cada locución
  ['--check','src/services/speechNumbersLab46.js'],
  ['scripts/check-speech-numbers-lab46.js'],
  // Lab.47 · Generador de offs (texto completo o resumen, vista previa de la locución, audio, SRT)
  ['--check','src/services/offsLab47.js'],
  ['--check','src/renderer-offs-lab47.js'],
  ['scripts/check-offs-lab47.js'],
  // Lab.48 · la optimización guardada sigue OPTIMIZADA después de reiniciar (perfil aplicado a la IA de texto detenida)
  ['scripts/check-optimization-badge-lab48.js'],
  // Lab.49 · la optimización del fine-tuned recupera su modelo al cargar (la copia por perfil lo perdía)
  ['--check','src/services/optimizationIdentityLab49.js'],
  ['scripts/check-optimization-identity-lab49.js'],
  // Lab.50 · millones con apóstrofo (S/ 3'244,426), romanos delante de un sustantivo («III Simulacro») y apellidos con tilde
  ['scripts/check-speech-lab50.js'],
];
// Python: el mismo "python" que usa package.json (en Linux puede llamarse python3)
function runPython(args){
  for(const exe of [process.env.PYTHON,'python','python3'].filter(Boolean)){const r=spawnSync(exe,args,{cwd:root,stdio:'inherit'});if(!r.error)return{exe,r};}
  return{exe:'python',r:{status:1}};
}
for(const step of STEPS){
  const {exe,r}=Array.isArray(step)?{exe:'node',r:spawnSync(process.execPath,step,{cwd:root,stdio:'inherit'})}:runPython(step.py),args=Array.isArray(step)?step:step.py;
  if(r.status!==0){console.error(`check-labs: falló "${exe} ${args.join(' ')}"`);process.exit(r.status||1);}
}
console.log(`check-labs OK (${STEPS.length} pasos)`);
