'use strict';
// Lab.45 · cifras con dinero y con millones: cadena completa (Lab.45 → pronunciación básica → estructural 0328 →
// normalizador 0326), que es lo que llega al motor de voz.
const path=require('path'),assert=require('assert');
const src=path.join(__dirname,'..','src','services');
const M=require(path.join(src,'moneySpeechLab45'));
const {normalizeSpeech,validateSpeech}=require(path.join(src,'speechNormalizer0326'));
const {structuralPreNormalize}=require(path.join(src,'speechRules0328'));
const {PronunciationNormalizer}=require(path.join(src,'pronunciation'));
let checks=0;const eq=(a,b,m)=>{checks++;assert.strictEqual(a,b,m);},ok=(v,m)=>{checks++;assert.ok(v,m);};
const pn=Object.create(PronunciationNormalizer.prototype);
const spoken=x=>{const b=pn.basic(M.speakMoney(x).text),pre=structuralPreNormalize(b,{rules:[]}).text,n=normalizeSpeech(pre,{enabled:true}).text;return validateSpeech(b,n).ok?n:pre;};
const cases=[
  // el caso reportado
  ['Deuda de S/ 3.2 millones afecta educación en Piura','Deuda de tres punto dos millones de soles afecta educación en Piura'],
  ['Deuda de S/ 3,2 millones','Deuda de tres punto dos millones de soles'],
  ['S/3.2 millones','tres punto dos millones de soles'],
  // antes: «tres horas con veinticinco minutos»
  ['S/ 3.25 millones','tres punto veinticinco millones de soles'],
  ['costó S/ 3.20','costó tres soles con veinte céntimos'],
  // antes: «dieciocho cero soles»
  ['robo de 18 000 soles','robo de dieciocho mil soles'],
  ['S/ 18 000','dieciocho mil soles'],
  ['pagó S/ 1.500 en multas','pagó mil quinientos soles en multas'],
  ['S/ 1.500 millones','mil quinientos millones de soles'],
  ['S/ 1.234,56','mil doscientos treinta y cuatro soles con cincuenta y seis céntimos'],
  ['US$ 2.5 millones','dos punto cinco millones de dólares'],
  ['US$ 1.5 billones','uno punto cinco billones de dólares'],
  ['S/ 15.4 mil millones','quince punto cuatro mil millones de soles'],
  ['S/ 1 millón','un millón de soles'],
  ['S/ 21 millones','veintiún millones de soles'],
  ['S/ 300 mil','trescientos mil soles'],
  ['S/ 1','un sol'],
  ['S/ 0.50','cincuenta céntimos'],
  ['3.2 millones de personas','tres punto dos millones de personas'],
  ['3.2 millones de soles','tres punto dos millones de soles'],
  // lo que no es dinero no cambia
  ['en 2025 hubo 120 casos','en dos mil veinticinco hubo ciento veinte casos'],
  ['el 25 de octubre de 2026','el veinticinco de octubre de dos mil veintiséis']
];
for(const [x,want] of cases)eq(spoken(x),want,x);
eq(M.speakMoney('El año 2025 100 personas').text,'El año 2025 100 personas','un año seguido de otra cifra no se junta');
eq(M.parseAmount('1.500').int,'1500','separador con 3 cifras = miles');
eq(M.parseAmount('3.2').dec,'2','separador con 1 cifra = decimal');
(async()=>{
  // el envoltorio pasa el texto ya convertido al resto de la cadena
  const seen=[];const proto=PronunciationNormalizer.prototype,orig=proto.normalize;
  proto.normalize=async function(t){seen.push(t);return{text:t};};
  try{
    ok(M.installMoneySpeechLab45()&&!M.installMoneySpeechLab45(),'se instala una sola vez');
    const r=await pn.normalize('Deuda de S/ 3.2 millones');
    eq(seen[0],'Deuda de tres punto dos millones de soles','la pronunciación recibe la cifra en palabras');
    ok(r.speechTransforms.includes('cifras con dinero')&&r.moneySpeechVersion===M.VERSION,'el resultado marca la transformación');
    const r2=await pn.normalize('Sin cifras');ok(!r2.moneySpeechVersion,'sin cifras no marca nada');
  }finally{}
  const boot=require('fs').readFileSync(path.join(__dirname,'..','src','bootstrap-v2lab.js'),'utf8');
  ok(/moneySpeechLab45'\)\.installMoneySpeechLab45\(\)/.test(boot),'bootstrap instala Lab.45');
  void orig;
  console.log(`check-money-speech-lab45 OK (${checks} verificaciones) · punto decimal con millones · miles · céntimos`);
})().catch(e=>{console.error('check-money-speech-lab45: '+(e.stack||e.message));process.exit(1);});
