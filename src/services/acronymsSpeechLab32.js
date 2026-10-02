'use strict';
// Lab.32 · Diccionario de siglas para la voz.
// Las siglas sueltas quedaban a merced de la tabla fija de pronunciation.js (TV → "te uve") o de la IA local de
// pronunciación, que adivina: ONP salía "Onpe". Ahora, antes de la pronunciación, cada sigla conocida se cambia
// por su lectura: deletreada cuando así se dice en el Perú ("o ene pe", "tevé") o como palabra cuando se lee de
// corrido (Minsa, Sunat, Onpe). Las siglas desconocidas sin vocales (PNP, MTC) se deletrean; las que tienen vocales
// siguen el camino de siempre. El operador agrega o corrige siglas en el panel (Voz → Pronunciación → Siglas); se
// guardan en `pronunciation-acronyms.json` en la carpeta de datos y ganan sobre la lista incorporada.
const fs=require('fs');
const path=require('path');

const FILE_NAME='pronunciation-acronyms.json';
const LETTERS={A:'a',B:'be',C:'ce',D:'de',E:'e',F:'efe',G:'ge',H:'hache',I:'i',J:'jota',K:'ka',L:'ele',M:'eme',N:'ene','Ñ':'eñe',O:'o',P:'pe',Q:'cu',R:'erre',S:'ese',T:'te',U:'u',V:'ve',W:'doble ve',X:'equis',Y:'ye',Z:'zeta','Á':'a','É':'e','Í':'i','Ó':'o','Ú':'u'};

// Lista incorporada (prensa peruana). Solo siglas que en un texto en minúsculas no se confunden con palabras.
const BUILTIN={
  TV:'tevé',ONP:'o ene pe',ONPE:'Onpe',ONU:'Onu',OEA:'o e a',OMS:'o eme ese',OPS:'o pe ese',ONG:'o ene ge',ONGs:'o ene ges',OIT:'o i te',OCDE:'o ce de e',OTAN:'Otan',APEC:'Apec',UE:'u e',
  PNP:'pe ene pe',FAP:'fap',PCM:'pe ce eme',JNE:'jota ene e',JNJ:'jota ene jota',TC:'te ce',PJ:'pe jota',CGR:'ce ge erre',RENIEC:'Reniec',
  MEF:'mef',MTC:'eme te ce',MTPE:'eme te pe e',MINSA:'Minsa',MINEDU:'Minedu',MININTER:'Mininter',MINDEF:'Mindef',MIDIS:'Midis',MIDAGRI:'Midagri',MINAM:'Minam',MINEM:'Minem',MINJUSDH:'Minjus',MIMP:'eme i eme pe',PRODUCE:'Produce',MINCETUR:'Mincetur',MVCS:'eme ve ce ese',
  SUNAT:'Sunat',SUNARP:'Sunarp',SUNAFIL:'Sunafil',SUNEDU:'Sunedu',SUNASS:'Sunass',SUSALUD:'Susalud',SUTRAN:'Sutran',SUCAMEC:'Sucamec',SBS:'ese be ese',SMV:'ese eme ve',
  INEI:'Inei',INPE:'Inpe',INDECI:'Indeci',INDECOPI:'Indecopi',OSINERGMIN:'Osinergmin',OSIPTEL:'Osiptel',OSITRAN:'Ositran',OEFA:'Oefa',OSCE:'Osce',SENAMHI:'Senamhi',SENASA:'Senasa',SERFOR:'Serfor',SERNANP:'Sernanp',IGP:'i ge pe',ATU:'a te u',APN:'a pe ene',MML:'eme eme ele',DIRCOTE:'Dircote',DIRINCRI:'Dirincri',DEVIDA:'Devida',
  BCP:'be ce pe',BCR:'be ce erre',BCRP:'be ce erre pe',BBVA:'be be ve a',BID:'bid',FMI:'efe eme i',PBI:'pe be i',IGV:'i ge ve',ISC:'i ese ce',CTS:'ce te ese',UIT:'u i te',AFP:'a efe pe',AFPs:'a efe pes',RUC:'ruc',DNI:'de ene i',SOAT:'Soat',MYPE:'mype',MYPES:'mypes',PYME:'pyme',PYMES:'pymes',IPC:'i pe ce',
  SIS:'sis',UCI:'u ce i',VIH:'ve i hache',COVID:'cóvid',
  FIFA:'Fifa',CONMEBOL:'Conmebol',FPF:'efe pe efe',IPD:'i pe de',NBA:'ene be a',NFL:'ene efe ele',
  FBI:'efe be i',CIA:'cía',DEA:'dea',EEUU:'Estados Unidos',
  PUCP:'pe u ce pe',UNMSM:'u ene eme ese eme',UPC:'u pe ce',
  IA:'i a',GPS:'ge pe ese',SMS:'ese eme ese',PDF:'pe de efe',USB:'u ese be',HDMI:'hache de eme i',CEO:'si i ou',
};
const VOWEL_RX=/[AEIOUÁÉÍÓÚaeiouáéíóú]/;
const ROMAN_RX=/^[IVXLCDM]+$/;
const TERM_RX=/^[\p{L}\p{N}][\p{L}\p{N}.&]{0,23}$/u;

function spellLetters(word){return [...String(word||'').toUpperCase()].map(ch=>LETTERS[ch]||ch.toLowerCase()).join(' ');}
function cleanEntries(raw){
  const out={};
  const src=raw&&typeof raw==='object'?(raw.terms&&typeof raw.terms==='object'?raw.terms:raw):{};
  for(const [k,v] of Object.entries(src)){
    const term=String(k||'').trim(),say=String(v??'').replace(/\s+/g,' ').trim();
    if(!TERM_RX.test(term)||!say||say.length>80||/[<>{}]/.test(say))continue;
    out[term]=say;
  }
  return out;
}
const cache=new Map();
function readUserAcronyms(file){
  try{
    const st=fs.statSync(file),hit=cache.get(file);
    if(hit&&hit.mtimeMs===st.mtimeMs&&hit.size===st.size)return hit.terms;
    const terms=cleanEntries(JSON.parse(fs.readFileSync(file,'utf8')));
    cache.set(file,{mtimeMs:st.mtimeMs,size:st.size,terms});return terms;
  }catch{return{};}
}
function writeUserAcronyms(file,terms){
  const clean=cleanEntries(terms);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp,JSON.stringify({schemaVersion:1,updatedAt:new Date().toISOString(),terms:clean},null,2),'utf8');
  try{fs.renameSync(tmp,file);}catch{fs.copyFileSync(tmp,file);try{fs.rmSync(tmp,{force:true});}catch{}}
  cache.delete(file);
  return clean;
}
function dictionary(userTerms={}){return{...BUILTIN,...cleanEntries(userTerms)};}

const escapeRx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const rxCache=new Map();
function dictRegex(dict){
  const keys=Object.keys(dict).sort((a,b)=>b.length-a.length),sig=keys.join('|');
  let rx=rxCache.get(sig);
  if(!rx){rx=new RegExp(`(?<![\\p{L}\\p{N}])(?:${keys.map(escapeRx).join('|')})(?![\\p{L}\\p{N}])`,'gu');if(rxCache.size>8)rxCache.clear();rxCache.set(sig,rx);}
  rx.lastIndex=0;return rx;
}
// Lectura de una sigla: diccionario, o deletreada si no tiene vocales; si no, null (sigue el camino de siempre).
function acronymReading(word,dict=BUILTIN){
  const w=String(word||'');
  if(Object.prototype.hasOwnProperty.call(dict,w))return dict[w];
  if(/^[A-ZÑ]{2,6}$/.test(w)&&!VOWEL_RX.test(w)&&!ROMAN_RX.test(w))return spellLetters(w);
  return null;
}
function speakAcronyms(input,dict=BUILTIN){
  let count=0;
  let text=String(input??'').replace(dictRegex(dict),m=>{count++;return dict[m];});
  text=text.replace(/(?<![\p{L}\p{N}])[A-ZÑ]{2,6}(?![\p{L}\p{N}])/gu,m=>{const r=acronymReading(m,dict);if(r==null)return m;count++;return r;});
  return{text,count};
}

module.exports={FILE_NAME,BUILTIN,LETTERS,spellLetters,cleanEntries,readUserAcronyms,writeUserAcronyms,dictionary,acronymReading,speakAcronyms};
