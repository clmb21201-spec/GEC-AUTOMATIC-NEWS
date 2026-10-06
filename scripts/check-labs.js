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
];
for(const args of STEPS){
  const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if(r.status!==0){console.error(`check-labs: falló "node ${args.join(' ')}"`);process.exit(r.status||1);}
}
console.log(`check-labs OK (${STEPS.length} pasos)`);
