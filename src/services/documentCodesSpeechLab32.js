'use strict';
// Lab.32 · Lectura de códigos de documentos oficiales.
// "Resolución Jefatural Ejecutiva N° 000081-2026-PE-ONP" llegaba al TTS como
// "número ochenta y uno-dos mil veintiséis-PE-ONP": guiones pegados, siglas en mayúsculas que cada motor lee a su
// manera y, con otros prefijos (N.º, Nro.), los ceros iniciales leídos uno por uno ("cero cero cuatro guion...").
// Ahora, antes de la pronunciación y del normalizador 0326/0328, el código completo pasa a palabras:
// "número ochenta y uno, dos mil veintiséis, pe e, o ene pe". Los números pierden los ceros a la izquierda, cada
// tramo se separa con una coma (pausa breve) y las siglas se deletrean, salvo las que se leen como palabra
// (Minsa, Sunat, Onpe). Se reconoce el código detrás de N°/Nº/N.º/Nro./Núm./No./número, o detrás del tipo de
// documento (Decreto Supremo 004-2025-EF, D.S. 004-2025-EF, Expediente 00123-2023-0-1801-JR-PE-01); sin prefijo
// se exige al menos un guion o barra para no tocar cifras sueltas. Se instala al final, envolviendo
// PronunciationNormalizer.prototype.normalize, así que vale para todos los motores de voz y para Merlín.
const path=require('path');
const {integerWords}=require('./speechRules0328');
const acr=require('./acronymsSpeechLab32');

const VERSION='lab32-document-codes-1';
const ONSETS=new Set(['bl','br','cl','cr','dr','fl','fr','gl','gr','pl','pr','tr','ch']);
const VOWELS=/[aeiouáéíóú]/;

// Sigla que se dice como palabra: 4+ letras, 2+ vocales, sin 3 consonantes seguidas y con un inicio posible en español.
function pronounceableAcronym(word){
  const w=String(word||'').toLowerCase();
  if(w.length<4)return false;
  if((w.match(/[aeiouáéíóú]/g)||[]).length<2)return false;
  if(/[^aeiouáéíóú]{3}/.test(w))return false;
  if(!VOWELS.test(w[0])&&!VOWELS.test(w[1])&&!ONSETS.has(w.slice(0,2)))return false;
  return true;
}
// Dentro de un código: primero el diccionario de siglas (incorporado + panel), después la regla general.
function spellAcronym(word,dict=acr.BUILTIN){
  if(Object.prototype.hasOwnProperty.call(dict,word))return dict[word];
  const w=String(word||'').toUpperCase();
  if(pronounceableAcronym(w))return w[0]+w.slice(1).toLowerCase();
  return acr.spellLetters(w);
}
function numberSegment(digits){
  const clean=String(digits||'').replace(/^0+(?=\d)/,'');
  if(clean.length>9)return [...String(digits)].map(d=>integerWords(Number(d))).join(' ');
  return integerWords(Number(clean));
}
// "000081-2026-PE-ONP" → "ochenta y uno, dos mil veintiséis, pe e, o ene pe"
function speakCode(code,dict=acr.BUILTIN){
  return String(code||'').split(/\s*[-–‑/]\s*/).filter(Boolean).map(seg=>/^\d+$/.test(seg)?numberSegment(seg):spellAcronym(seg,dict)).join(', ');
}

const SEG=String.raw`(?:\d{1,12}|[A-ZÁÉÍÓÚÑ]{1,12}(?![\p{Ll}\p{N}]))`;
const SEP=String.raw`\s?[-–‑/]\s?`;
const CODE_ANY=String.raw`\d{1,12}(?:${SEP}${SEG})*(?![\p{L}\p{N}])`;
const CODE_SEP=String.raw`\d{1,12}(?:${SEP}${SEG})+(?![\p{L}\p{N}])`;
// N°, Nº, N.º, N.°, Nº., Nro., Nro, Núm., Num., número
const MARKER=String.raw`(?:N\s?\.?\s?[°º]\.?|Nro\.?|Núm\.?|Num\.|[Nn]úmero|[Nn]umero)`;
const MARKER_RX=new RegExp(String.raw`(?<![\p{L}\p{N}])${MARKER}\s*(${CODE_ANY})`,'gu');
// "No." solo con un código con guion o barra ("No. 45-2024"), para no confundirlo con la negación.
const NO_RX=new RegExp(String.raw`(?<![\p{L}\p{N}])No\.\s*(${CODE_SEP})`,'gu');
const DOC=String.raw`(?:Decreto(?:\s+(?:Supremo|Legislativo|de\s+Urgencia|Regional|de\s+Alcald[ií]a|Ley))?|Resoluci[oó]n(?:\s+(?:de\s+)?\p{Lu}[\p{Ll}]+){0,4}|Ley(?:\s+Org[aá]nica)?|Proyecto\s+de\s+Ley|Expediente|Exp\.|Oficio(?:\s+M[uú]ltiple)?|Informe(?:\s+T[eé]cnico)?|Ordenanza(?:\s+Municipal|\s+Regional)?|Directiva|Casaci[oó]n|Acuerdo(?:\s+de\s+Concejo)?|Memorando|Carta|Sentencia|Acta|D\.\s?S\.|D\.\s?U\.|D\.\s?Leg\.|D\.\s?L\.|R\.\s?M\.|R\.\s?S\.|R\.\s?D\.|R\.\s?J\.|R\.\s?A\.)`;
const DOC_RX=new RegExp(String.raw`(?<![\p{L}\p{N}])(${DOC})\s+(${CODE_SEP})`,'gu');

// Abreviaturas del tipo de documento que se dicen completas ("D.S. 004-2025-EF" → "Decreto Supremo cuatro, ...").
const DOC_ABBR=[[/^D\.\s?S\.$/,'Decreto Supremo'],[/^D\.\s?U\.$/,'Decreto de Urgencia'],[/^D\.\s?(?:Leg|L)\.$/,'Decreto Legislativo'],[/^R\.\s?M\.$/,'Resolución Ministerial'],[/^R\.\s?S\.$/,'Resolución Suprema'],[/^R\.\s?D\.$/,'Resolución Directoral'],[/^R\.\s?J\.$/,'Resolución Jefatural'],[/^R\.\s?A\.$/,'Resolución Administrativa'],[/^Exp\.$/,'Expediente']];
function docName(doc){for(const [rx,name] of DOC_ABBR)if(rx.test(doc))return name;return doc;}
const ABBR_RX=new RegExp(String.raw`(?<![\p{L}\p{N}])(D\.\s?S\.|D\.\s?U\.|D\.\s?Leg\.|D\.\s?L\.|R\.\s?M\.|R\.\s?S\.|R\.\s?D\.|R\.\s?J\.|R\.\s?A\.|Exp\.)(?=\s*(?:${MARKER}\s*)?\d)`,'gu');

function speakDocumentCodes(input,dict=acr.BUILTIN){
  let text=String(input??''),count=0;
  const marker=(_,code)=>{count++;return `número ${speakCode(code,dict)}`;};
  text=text.replace(ABBR_RX,doc=>docName(doc));
  text=text.replace(MARKER_RX,marker).replace(NO_RX,marker);
  text=text.replace(DOC_RX,(_,doc,code)=>{count++;return `${docName(doc)} ${speakCode(code,dict)}`;});
  return{text,count};
}

// Códigos y siglas antes de la pronunciación. La lista del panel vive en la carpeta de datos de la voz.
function speakForTts(input,userTerms={}){
  const dict=acr.dictionary(userTerms),codes=speakDocumentCodes(input,dict),acronyms=acr.speakAcronyms(codes.text,dict);
  return{text:acronyms.text,codes:codes.count,acronyms:acronyms.count};
}
function acronymsFile(dataDir){return path.join(dataDir,acr.FILE_NAME);}

function installDocumentCodesSpeechLab32({dataRoot}={}){
  const {PronunciationNormalizer}=require('./pronunciation');
  const proto=PronunciationNormalizer.prototype;
  if(proto.__ecLab32DocumentCodes)return;
  Object.defineProperty(proto,'__ecLab32DocumentCodes',{value:true});
  const rootOf=self=>{try{return typeof dataRoot==='function'?dataRoot():(self?.dataDir||'');}catch{return self?.dataDir||'';}};
  const base=proto.normalize;
  proto.normalize=async function(script,options={}){
    let spoken=String(script??''),r={codes:0,acronyms:0};
    try{const root=rootOf(this);r=speakForTts(spoken,root?acr.readUserAcronyms(acronymsFile(root)):{});spoken=r.text;}catch{spoken=String(script??'');r={codes:0,acronyms:0};}
    const out=await base.call(this,spoken,options);
    if(!(r.codes||r.acronyms)||!out||typeof out!=='object')return out;
    const extra=[...(r.codes?['códigos de documento']:[]),...(r.acronyms?['siglas']:[])];
    return{...out,speechTransforms:[...new Set([...(out.speechTransforms||[]),...extra])],documentCodesVersion:VERSION};
  };
  let ipcMain=null;try{({ipcMain}=require('electron'));}catch{}
  if(!ipcMain||typeof ipcMain.handle!=='function')return;
  const file=()=>{const root=rootOf(null);if(!root)throw new Error('Carpeta de datos no disponible');return acronymsFile(root);};
  const view=()=>({ok:true,terms:acr.readUserAcronyms(file()),builtin:acr.BUILTIN});
  try{ipcMain.removeHandler('acronyms:get');ipcMain.removeHandler('acronyms:set');ipcMain.removeHandler('acronyms:test');}catch{}
  ipcMain.handle('acronyms:get',()=>{try{return view();}catch(e){return{ok:false,error:e.message||String(e)};}});
  ipcMain.handle('acronyms:set',(_e,terms={})=>{try{acr.writeUserAcronyms(file(),terms);return view();}catch(e){return{ok:false,error:e.message||String(e)};}});
  ipcMain.handle('acronyms:test',(_e,text='')=>{try{return{ok:true,text:speakForTts(String(text||'').slice(0,2000),acr.readUserAcronyms(file())).text};}catch(e){return{ok:false,error:e.message||String(e)};}});
}

module.exports={VERSION,speakDocumentCodes,speakCode,spellAcronym,pronounceableAcronym,speakForTts,acronymsFile,installDocumentCodesSpeechLab32};
