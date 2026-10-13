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
  ['N° 000081-2026-PE-ONP','número ochenta y uno, dos mil veintiséis, pe e, o ene pe'],
  // femenino por terminación (no solo la lista), millones y coma de miles
  ['Se entregaron 3.200 computadoras.','Se entregaron tres mil doscientas computadoras.'],
  ['Se entregaron 3 200 computadoras.','Se entregaron tres mil doscientas computadoras.'],
  ['Se vendieron 3,200 entradas.','Se vendieron tres mil doscientas entradas.'],
  ['Se vendieron 3,200 autos.','Se vendieron tres mil doscientos autos.'],
  ['Llegaron 1 500 000 personas.','Llegaron un millón quinientas mil personas.'],
  ['Llegaron 2 000 000 personas.','Llegaron dos millones de personas.'],
  ['Unos 3 mil 200 personas.','Unos tres mil doscientas personas.'],
  ['300 mil personas','trescientas mil personas'],
  ['Hubo 200 intervenciones y 21 detenciones.','Hubo doscientas intervenciones y veintiuna detenciones.'],
  ['200 nuevas viviendas','doscientas nuevas viviendas'],
  ['1 ley y 2 leyes','una ley y dos leyes'],
  // lo masculino o de género común queda igual
  ['Llegaron 3 200 turistas.','Llegaron tres mil doscientos turistas.'],
  ['200 programas sociales','doscientos programas sociales'],
  ['Duró 3 días.','Duró tres días.'],
  ['dio 200 para cada familia','dio doscientos para cada familia'],
  ['1 500 000 soles','un millón quinientos mil soles'],
  // carpeta / expediente / caso con número y año (Lab.32)
  ['La Fiscalía abrió la carpeta 17-2026 contra el alcalde.','La Fiscalía abrió la carpeta diecisiete, dos mil veintiséis contra el alcalde.'],
  ['la carpeta fiscal 506-2025-MP-FN','la carpeta fiscal quinientos seis, dos mil veinticinco, eme pe, efe ene'],
  ['el expediente 17-2026','el expediente diecisiete, dos mil veintiséis'],
  ['en ese caso 2-1 en el marcador','en ese caso dos a uno en el marcador']
];
for(const [x,want] of cases)eq(spoken(x),want,x);
// punto final de cada locución (titulares de «Titulares de esta hora», intervenciones)
eq(N.endWithPunctuation('Deuda de S/ 3.2 millones afecta educación en Piura'),'Deuda de S/ 3.2 millones afecta educación en Piura.','titular sin punto');
eq(N.endWithPunctuation('¿Qué pasará con el dólar?'),'¿Qué pasará con el dólar?','pregunta queda igual');
eq(N.endWithPunctuation('Dijo «no habrá cambios»'),'Dijo «no habrá cambios».','punto después de la comilla de cierre');
eq(N.endWithPunctuation('Seguimos con más noticias,  '),'Seguimos con más noticias.','coma final pasa a punto');
eq(N.endWithPunctuation('Ya terminó.'),'Ya terminó.','con punto queda igual');
// dato grande de Noticias con movimiento (Lab.37)
const NM=require(path.join(src,'newsMotionLab37'));
const big=x=>NM.factsInSentence(x).map(f=>f.big);
eq(JSON.stringify(big('Unos 3 mil 200 personas.')),'["3 200 personas"]','«3 mil 200» es una sola cifra');
eq(JSON.stringify(big('Unos 3 200 turistas llegaron.')),'["3 200 turistas"]','cifra con un sustantivo fuera de la lista');
eq(JSON.stringify(big('Se entregaron 3.200 computadoras a colegios.')),'["3.200 computadoras"]','computadoras');
eq(JSON.stringify(big('En 2025 durante el verano')),'[]','un año suelto no es dato');
eq(JSON.stringify(big('Tiene 25 años de experiencia.')),'[]','años no es dato');
eq(JSON.stringify(NM.extractFacts({title:'x',summary:'',sentences:NM.sentencesOf('Llegaron 3 200 turistas, informó el 3 de octubre.'),firstScript:0}).map(f=>f.big)),'["3 200 turistas"]','la cifra gana a la fecha en la misma oración');
const boot=fs.readFileSync(path.join(__dirname,'..','src','bootstrap-v2lab.js'),'utf8');
ok(boot.indexOf('installSpeechNumbersLab46')>0&&boot.indexOf('installSpeechNumbersLab46')<boot.indexOf('installMoneySpeechLab45'),'Lab.46 se instala antes que Lab.45 (el dinero corre primero)');
const py=fs.readFileSync(path.join(__dirname,'..','src','qwen_speed_lab31.py'),'utf8');
ok(/tail_sec=0\.12/.test(py)&&/int\(sr \* tail_sec\)/.test(py),'Lab.31: al unir fragmentos se dejan 120 ms al final');
console.log(`check-speech-numbers-lab46 OK (${checks} verificaciones) · a. m./p. m. · fechas · ordinales · femeninos · decimales · punto final`);
