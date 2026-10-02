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
const {integerWords}=require('./speechRules0328');

const VERSION='lab32-document-codes-1';
const LETTERS={A:'a',B:'be',C:'ce',D:'de',E:'e',F:'efe',G:'ge',H:'hache',I:'i',J:'jota',K:'ka',L:'ele',M:'eme',N:'ene','Ñ':'eñe',O:'o',P:'pe',Q:'cu',R:'erre',S:'ese',T:'te',U:'u',V:'ve',W:'doble ve',X:'equis',Y:'ye',Z:'zeta','Á':'a','É':'e','Í':'i','Ó':'o','Ú':'u'};
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
function spellAcronym(word){
  const w=String(word||'').toUpperCase();
  if(pronounceableAcronym(w))return w[0]+w.slice(1).toLowerCase();
  return [...w].map(ch=>LETTERS[ch]||ch.toLowerCase()).join(' ');
}
function numberSegment(digits){
  const clean=String(digits||'').replace(/^0+(?=\d)/,'');
  if(clean.length>9)return [...String(digits)].map(d=>integerWords(Number(d))).join(' ');
  return integerWords(Number(clean));
}
// "000081-2026-PE-ONP" → "ochenta y uno, dos mil veintiséis, pe e, o ene pe"
function speakCode(code){
  return String(code||'').split(/\s*[-–‑/]\s*/).filter(Boolean).map(seg=>/^\d+$/.test(seg)?numberSegment(seg):spellAcronym(seg)).join(', ');
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

function speakDocumentCodes(input){
  let text=String(input??''),count=0;
  const marker=(_,code)=>{count++;return `número ${speakCode(code)}`;};
  text=text.replace(ABBR_RX,doc=>docName(doc));
  text=text.replace(MARKER_RX,marker).replace(NO_RX,marker);
  text=text.replace(DOC_RX,(_,doc,code)=>{count++;return `${docName(doc)} ${speakCode(code)}`;});
  return{text,count};
}

function installDocumentCodesSpeechLab32(){
  const {PronunciationNormalizer}=require('./pronunciation');
  const proto=PronunciationNormalizer.prototype;
  if(proto.__ecLab32DocumentCodes)return;
  Object.defineProperty(proto,'__ecLab32DocumentCodes',{value:true});
  const base=proto.normalize;
  proto.normalize=async function(script,options={}){
    let spoken=String(script??''),count=0;
    try{({text:spoken,count}=speakDocumentCodes(spoken));}catch{spoken=String(script??'');count=0;}
    const out=await base.call(this,spoken,options);
    if(!count||!out||typeof out!=='object')return out;
    return{...out,speechTransforms:[...new Set([...(out.speechTransforms||[]),'códigos de documento'])],documentCodesVersion:VERSION};
  };
}

module.exports={VERSION,speakDocumentCodes,speakCode,spellAcronym,pronounceableAcronym,installDocumentCodesSpeechLab32};
