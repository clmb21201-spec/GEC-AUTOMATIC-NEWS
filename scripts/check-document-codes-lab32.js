'use strict';
// Lab.32 · los códigos de documentos oficiales se leen en palabras (sin ceros a la izquierda, siglas deletreadas).
const path=require('path'),assert=require('assert');
const src=path.join(__dirname,'..','src','services');
const lab=require(path.join(src,'documentCodesSpeechLab32'));
const {normalizeSpeech,validateSpeech}=require(path.join(src,'speechNormalizer0326'));
const {structuralPreNormalize}=require(path.join(src,'speechRules0328'));
let checks=0;
const eq=(got,want,msg)=>{checks++;assert.strictEqual(got,want,msg);};
// Cadena completa: Lab.32 → estructural 0328 → normalizador 0326 (lo que llega al TTS).
const spoken=x=>{const a=lab.speakDocumentCodes(x).text,pre=structuralPreNormalize(a,{rules:[]}).text,n=normalizeSpeech(pre,{enabled:true}).text,v=validateSpeech(a,n);return v.ok?n:pre;};

const cases=[
  // El caso reportado en Merlín
  ['Mediante Resolución Jefatural Ejecutiva N° 000081-2026-PE-ONP.','Mediante Resolución Jefatural Ejecutiva número ochenta y uno, dos mil veintiséis, pe e, o ene pe.'],
  ['el Decreto Supremo N.º 004-2025-EF','el Decreto Supremo número cuatro, dos mil veinticinco, e efe'],
  ['Resolución Ministerial Nº 123-2024-MINSA','Resolución Ministerial número ciento veintitrés, dos mil veinticuatro, Minsa'],
  ['Resolución de Superintendencia N.° 000123-2026/SUNAT','Resolución de Superintendencia número ciento veintitrés, dos mil veintiséis, Sunat'],
  ['el Oficio Nº 045-2026-MTC/01','el Oficio número cuarenta y cinco, dos mil veintiséis, eme te ce, uno'],
  ['Expediente N° 00123-2023-0-1801-JR-PE-01','Expediente número ciento veintitrés, dos mil veintitrés, cero, mil ochocientos uno, jota erre, pe e, uno'],
  ['la Ley N° 31953','la Ley número treinta y un mil novecientos cincuenta y tres'],
  ['Ley Nro. 32001','Ley número treinta y dos mil uno'],
  ['Decreto de Urgencia 012-2024','Decreto de Urgencia doce, dos mil veinticuatro'],
  ['la Resolución Directoral 0045-2026-ONPE','la Resolución Directoral cuarenta y cinco, dos mil veintiséis, Onpe'],
  ['D.S. 004-2025-EF','Decreto Supremo cuatro, dos mil veinticinco, e efe'],
  ['según la R.M. N° 0456-2026-MINSA/DM','según la Resolución Ministerial número cuatrocientos cincuenta y seis, dos mil veintiséis, Minsa, de eme'],
  ['Exp. 01234-2025-PA/TC','Expediente mil doscientos treinta y cuatro, dos mil veinticinco, pe a, te ce'],
];
for(const [input,want] of cases)eq(spoken(input),want,input);

// Sin prefijo ni tipo de documento no se toca nada (marcadores, cifras sueltas, negación).
for(const x of ['El partido terminó 2-1 en Lima','dijo que no. 45 personas','entre 2024-2025 creció','la ONP pagará'])eq(lab.speakDocumentCodes(x).text,x,x);

// Siglas: deletreadas salvo las que se dicen como palabra.
eq(lab.spellAcronym('ONP'),'o ene pe');eq(lab.spellAcronym('PE'),'pe e');eq(lab.spellAcronym('MTPE'),'eme te pe e');
eq(lab.spellAcronym('MINSA'),'Minsa');eq(lab.spellAcronym('OSCE'),'Osce');eq(lab.spellAcronym('PNP'),'pe ene pe');

// Se instala sobre PronunciationNormalizer.normalize (todos los motores y Merlín) una sola vez.
const {PronunciationNormalizer}=require(path.join(src,'pronunciation'));
const seen=[];PronunciationNormalizer.prototype.normalize=async function(t){seen.push(t);return{text:t,speechTransforms:['número']};};
lab.installDocumentCodesSpeechLab32();lab.installDocumentCodesSpeechLab32();
(async()=>{
  const out=await PronunciationNormalizer.prototype.normalize.call({},'Ejecutiva N° 000081-2026-PE-ONP.');
  eq(seen.length,1,'base llamada una vez');
  eq(seen[0],'Ejecutiva número ochenta y uno, dos mil veintiséis, pe e, o ene pe.');
  checks++;assert.ok(out.speechTransforms.includes('códigos de documento')&&out.speechTransforms.includes('número'));
  const plain=await PronunciationNormalizer.prototype.normalize.call({},'Sin códigos.');
  checks++;assert.deepStrictEqual(plain.speechTransforms,['número']);
  console.log(`OK check-document-codes-lab32 (${checks} comprobaciones)`);
})().catch(e=>{console.error(e);process.exit(1);});
