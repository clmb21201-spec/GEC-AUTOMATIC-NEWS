'use strict';
// Lab.46 · cadena completa (Lab.45 dinero → Lab.46 → Lab.32 → pronunciación básica → estructural 0328 → normalizador 0326).
const path=require('path'),fs=require('fs'),assert=require('assert');
const src=path.join(__dirname,'..','src','services');
const M=require(path.join(src,'moneySpeechLab45')),N=require(path.join(src,'speechNumbersLab46')),D=require(path.join(src,'documentCodesSpeechLab32'));
const {normalizeSpeech,validateSpeech}=require(path.join(src,'speechNormalizer0326'));
const {structuralPreNormalize}=require(path.join(src,'speechRules0328'));
const {PronunciationNormalizer}=require(path.join(src,'pronunciation'));
let checks=0;const eq=(a,b,m)=>{checks++;assert.strictEqual(a,b,m);},ok=(v,m)=>{checks++;assert.ok(v,m);};
const pn=Object.create(PronunciationNormalizer.prototype);
const spoken=x=>{const a=D.speakForTts(N.speakNumbers(M.speakMoney(x).text).text,{}).text,b=pn.basic(a),pre=structuralPreNormalize(b,{rules:[]}).text,n=normalizeSpeech(pre,{enabled:true}).text;return validateSpeech(b,n).ok?n:pre;};
const cases=[
  // a. m. / p. m.: antes «ocho y treinta de la noche. en Lima» (punto en medio de la frase)
  ['La reunión será a las 8:30 p.m. en Lima.','La reunión será a las ocho y treinta de la noche en Lima.'],
  ['El evento empieza a las 10 a.m. Luego habrá un brindis.','El evento empieza a las diez de la mañana. Luego habrá un brindis.'],
  ['a las 7:00 AM del lunes','a las siete de la mañana del lunes'],
  ['a la 1 p.m. del martes','a la una de la tarde del martes'],
  ['a las 12:30 p.m. del martes','a las doce y treinta del mediodía del martes'],
  ['a las 9 p. m. del viernes','a las nueve de la noche del viernes'],
  ['a las 12 m. del sábado','a las doce del mediodía del sábado'],
  // antes «tres horas con treinta minutosde la tarde»
  ['a las 3.30 de la tarde','a las tres y treinta de la tarde'],
  ['a las 15:30 horas','a las quince horas con treinta minutos'],
  // fechas: antes «trece horas con diez minutos.dos mil veintiséis»
  ['El 13.10.2026 se votó','El trece de octubre de dos mil veintiséis se votó'],
  ['Rige desde el 01.01.2025','Rige desde el primero de enero de dos mil veinticinco'],
  // ordinales: antes «uno. º de mayo»
  ['1.º de mayo','primero de mayo'],['el 2.° piso','el segundo piso'],['la 3.ª edición','la tercera edición'],['el 1er lugar','el primer lugar'],['el 15.º aniversario','el décimo quinto aniversario'],
  ['temperaturas de 28 °C','temperaturas de veintiocho grados Celsius'],
  // femeninos: antes «mil doscientos personas»
  ['Hay 1.200 personas afectadas.','Hay mil doscientas personas afectadas.'],
  ['21 familias damnificadas y 1 persona fallecida','veintiuna familias damnificadas y una persona fallecida'],
  ['500 viviendas y 300 escuelas','quinientas viviendas y trescientas escuelas'],
  ['Duró 2 horas','Duró dos horas'],
  // decimales con punto → «punto»; con coma → «coma»
  ['La inflación subió 3.5% en septiembre.','La inflación subió tres punto cinco por ciento en septiembre.'],
  ['un sismo de magnitud 5.8','un sismo de magnitud cinco punto ocho'],
  ['mide 1.75 metros','mide uno punto setenta y cinco metros'],
  ['un aumento de 0.8 puntos','un aumento de cero punto ocho puntos'],
  ['el 50,3 % de votos','el cincuenta coma tres por ciento de votos'],
  // lo que ya estaba bien sigue igual
  ['Deuda de S/ 3.2 millones afecta educación en Piura','Deuda de tres punto dos millones de soles afecta educación en Piura'],
  ['Se registraron 12 500 casos.','Se registraron doce mil quinientos casos.'],
  ['ganó 3-1 al Cristal','ganó tres a uno al Cristal'],
  ['N° 000081-2026-PE-ONP','número ochenta y uno, dos mil veintiséis, pe e, o ene pe']
];
for(const [x,want] of cases)eq(spoken(x),want,x);
// punto final de cada locución (titulares de «Titulares de esta hora», intervenciones)
eq(N.endWithPunctuation('Deuda de S/ 3.2 millones afecta educación en Piura'),'Deuda de S/ 3.2 millones afecta educación en Piura.','titular sin punto');
eq(N.endWithPunctuation('¿Qué pasará con el dólar?'),'¿Qué pasará con el dólar?','pregunta queda igual');
eq(N.endWithPunctuation('Dijo «no habrá cambios»'),'Dijo «no habrá cambios».','punto después de la comilla de cierre');
eq(N.endWithPunctuation('Seguimos con más noticias,  '),'Seguimos con más noticias.','coma final pasa a punto');
eq(N.endWithPunctuation('Ya terminó.'),'Ya terminó.','con punto queda igual');
const boot=fs.readFileSync(path.join(__dirname,'..','src','bootstrap-v2lab.js'),'utf8');
ok(boot.indexOf('installSpeechNumbersLab46')>0&&boot.indexOf('installSpeechNumbersLab46')<boot.indexOf('installMoneySpeechLab45'),'Lab.46 se instala antes que Lab.45 (el dinero corre primero)');
const py=fs.readFileSync(path.join(__dirname,'..','src','qwen_speed_lab31.py'),'utf8');
ok(/tail_sec=0\.12/.test(py)&&/int\(sr \* tail_sec\)/.test(py),'Lab.31: al unir fragmentos se dejan 120 ms al final');
console.log(`check-speech-numbers-lab46 OK (${checks} verificaciones) · a. m./p. m. · fechas · ordinales · femeninos · decimales · punto final`);
