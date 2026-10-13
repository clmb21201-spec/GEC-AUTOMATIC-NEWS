'use strict';
// Lab.50 · millones con apóstrofo (S/ 3'244,426), números romanos delante de un sustantivo («III Simulacro») y
// apellidos con tilde que se leían como romanos («Cárdenas» → «cienárdenas»). Cadena completa como en Lab.46, más el
// dato grande de Noticias con movimiento.
const path=require('path'),assert=require('assert');
const src=path.join(__dirname,'..','src','services');
const M=require(path.join(src,'moneySpeechLab45')),N=require(path.join(src,'speechNumbersLab46')),D=require(path.join(src,'documentCodesSpeechLab32'));
const {normalizeSpeech,validateSpeech}=require(path.join(src,'speechNormalizer0326'));
const {structuralPreNormalize}=require(path.join(src,'speechRules0328'));
const {PronunciationNormalizer}=require(path.join(src,'pronunciation'));
const motion=require(path.join(src,'newsMotionLab37'));
let checks=0;const eq=(a,b,m)=>{checks++;assert.strictEqual(a,b,m);};
const pn=Object.create(PronunciationNormalizer.prototype);
const spoken=x=>{const a=D.speakForTts(N.speakNumbers(M.speakMoney(x).text).text,{}).text,b=pn.basic(a),pre=structuralPreNormalize(b,{rules:[]}).text,n=normalizeSpeech(pre,{enabled:true}).text;return validateSpeech(b,n).ok?n:pre;};
const voice=[
  // millones con apóstrofo: antes «tres soles» y un número suelto
  ["La deuda suma S/ 3'244,426 en total.",'La deuda suma tres millones doscientos cuarenta y cuatro mil cuatrocientos veintiséis soles en total.'],
  ['La deuda suma S/ 3’244,426 en total.','La deuda suma tres millones doscientos cuarenta y cuatro mil cuatrocientos veintiséis soles en total.'],
  ['S/ 3´244,426.50','tres millones doscientos cuarenta y cuatro mil cuatrocientos veintiséis soles con cincuenta céntimos'],
  ["US$ 1'500,000",'un millón quinientos mil dólares'],
  ["Hay 3'244,426 personas afectadas.",'Hay tres millones doscientas cuarenta y cuatro mil cuatrocientas veintiséis personas afectadas.'],
  // millones exactos: antes «un millón soles»
  ["S/ 1'000,000",'un millón de soles'],
  ['S/ 3000000','tres millones de soles'],
  ['S/ 1.500','mil quinientos soles'],
  ["O'Higgins y la calle D'Onofrio","O'Higgins y la calle D'Onofrio"],
  // romanos delante de un sustantivo: antes «III» llegaba sin convertir
  ['Hoy se realiza el III Simulacro Nacional Multipeligro.','Hoy se realiza el tercer Simulacro Nacional Multipeligro.'],
  ['III Simulacro Nacional Multipeligro','Tercer Simulacro Nacional Multipeligro'],
  ['la III Feria del Libro','la tercera Feria del Libro'],
  ['Participó en la IV edición del festival.','Participó en la cuarta edición del festival.'],
  ['el I Congreso de Periodismo','el primer Congreso de Periodismo'],
  ['los XV Juegos Panamericanos','los decimoquintos Juegos Panamericanos'],
  ['el XIV Congreso Nacional','el decimocuarto Congreso Nacional'],
  ['las II Jornadas Médicas','las segundas Jornadas Médicas'],
  ['la II Guerra Mundial','la segunda Guerra Mundial'],
  ['su III edición','su tercera edición'],
  ['el XXI Festival de Cine','el veintiún Festival de Cine'],
  ['la XXI Bienal','la veintiuna Bienal'],
  ['el V Festival de Teatro','el quinto Festival de Teatro'],
  // lo que ya estaba bien no cambia
  ['el Papa León XIV visitó Lima','el Papa León catorce visitó Lima'],
  ['Juan Pablo II fue','Juan Pablo segundo fue'],
  ['en el siglo XXI','en el siglo veintiuno'],
  ['la vitamina C y la V de victoria','la vitamina C y la V de victoria'],
  ['el canal V de cable','el canal V de cable'],
  ['la I y la II','la I y la II'],
  // apellidos y palabras con tilde que empiezan con una letra romana: antes «cienárdenas», «quintoásquez», «milédica»
  ['Atención Médica para José Cárdenas y Rosa Vásquez','Atención Médica para José Cárdenas y Rosa Vásquez'],
  ['Pedro Ángel Dávila','Pedro Ángel Dávila'],
];
for(const [inp,out] of voice)eq(spoken(inp),out,inp);
// dato grande: antes «S/ 3» y «S/ 3,200»
const big=s=>motion.extractFacts({title:'x',sentences:[s]}).map(f=>f.big)[0];
const base='La deuda con la ONP y EsSalud suma S/ X.';
for(const [x,want] of [['3’244,426','S/ 3’244,426'],["3'244,426","S/ 3'244,426"],['3´244,426.50','S/ 3´244,426.50'],['3,200,000','S/ 3,200,000'],['3.2 millones','S/ 3.2 millones'],['3.200.000','S/ 3.200.000'],['3 200 000','S/ 3 200 000']])eq(big(base.replace('X',x)),want,`dato grande ${x}`);
eq(big("Hay 3'244,426 personas afectadas en la región."),"3'244,426 personas",'dato grande sin moneda');
eq(big('Se vacunó a 3 mil 200 niños.'),'3 200 niños','«3 mil 200» sigue igual');
console.log(`check-speech-lab50 OK (${checks} verificaciones) · millones con apóstrofo · romanos delante de un sustantivo · apellidos con tilde`);
