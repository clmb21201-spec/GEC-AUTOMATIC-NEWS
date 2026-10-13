'use strict';
// Lab.46 · Horas con a. m. / p. m., ordinales, decimales, cifras con sustantivo femenino y el final de cada locución.
// Antes:
//   «8:30 p.m. en Lima» → «ocho y treinta de la noche. en Lima» (el punto de «p.m.» cortaba la frase a la mitad);
//   «10 a.m.» → «diez a. m.»; «2:13 PM» → «dos horas con trece minutospe eme»;
//   «3.30 de la tarde» → «tres horas con treinta minutosde la tarde»;
//   «1.º de mayo» → «uno. º de mayo»; «1.200 personas» → «mil doscientos personas»;
//   «3.5%» → «tres coma cinco» (en la nota dice 3.5: se lee «tres punto cinco»; «3,5» sigue siendo «coma»);
//   los titulares de «Titulares de esta hora» se generaban sin punto final y Qwen no cerraba la entonación.
// speakNumbers corre antes de la pronunciación (dentro de Lab.45, que va primero para que «S/ 3.2 millones» llegue
// intacto a su regla). endWithPunctuation envuelve KokoroTTS.prototype.generate (todas las voces: noticias,
// intervenciones, titulares, Merlín): si el texto no termina en . ! ? … agrega un punto.
const {integerWords,romanToInt}=require('./speechRules0328');
const {ordinalWords}=require('./speechNormalizer0326');

const VERSION='lab46-numbers-1';
const L='(?<![\\p{L}\\p{N}])',R='(?![\\p{L}\\p{N}])';
const words=n=>integerWords(Number(n));
const hourWord=h=>h===1?'una':words(h);
const minuteWords=m=>m===0?'':m===15?' y cuarto':m===30?' y treinta':` y ${words(m)}`;
// período del día para un reloj de 12 horas
function dayPart(h12,pm){
  if(!pm)return h12===12?'de la noche':h12<6?'de la madrugada':'de la mañana';
  return h12===12?'del mediodía':h12<7?'de la tarde':'de la noche';
}
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const AMPM='(a|p)\\.?\\s?m\\.?';

// cifra con «personas», «víctimas», «viviendas»…: «mil doscientas personas», «una persona», «veintiuna familias»
const FEM=['persona','víctima','familia','vivienda','casa','tonelada','hectárea','escuela','empresa','institución','mujer','niña','muerte','vida','unidad','denuncia','llamada','vacuna','dosis','cama','plaza','cuadra','calle','región','provincia','comunidad','semana','cabeza','especie','ciudad','obra','vez','prueba','hora','entrada','firma','embarcación','vía','línea','comisaría','sede','plataforma','universidad','institución educativa','madre','trabajadora','agencia','tienda','mina','central','planta','zona','localidad','oficina','muestra','fecha','jornada','etapa','fase','pista','carretera','obra pública','acción','operación','intervención','detención','solicitud','queja','multa','sanción','licencia','postulación','candidatura','lista','mesa','cédula','urna','encuesta','pregunta','respuesta'];
const FEM_RX=FEM.map(w=>w.replace(/ /g,'\\s+')).sort((a,b)=>b.length-a.length).map(w=>`${w}(?:s|es)?`).join('|');
function feminine(digits){
  const n=Number(digits);if(!Number.isSafeInteger(n)||n<1||n>=1e12)return null;
  const w=words(n);
  // con millones: «dos millones de personas»; «un millón quinientas mil personas» (solo lo que va después del millón)
  if(n>=1e6){
    if(n%1e6===0)return `${w} de`;
    const m=w.match(/^(.*\bmill(?:ón|ones))\s+(.*)$/);if(!m)return w;
    return `${m[1]} ${fem(m[2])}`;
  }
  return fem(w);
}
function fem(w){
  return String(w).replace(/ientos(?=\s|$)/g,'ientas').replace(/(^|\s)uno$/,'$1una').replace(/veintiuno$/,'veintiuna').replace(/(^|\s)un mil(?=\s|$)/,'$1mil');
}
// ¿sustantivo femenino? lista + terminaciones (-as, -a, -ción, -sión, -dad, -tad, -tud, -umbre), menos las excepciones
const MASC=new Set(['días','día','problemas','problema','programas','programa','sistemas','sistema','temas','tema','mapas','mapa','climas','clima','idiomas','idioma','planetas','planeta','poemas','poema','dramas','drama','cometas','esquemas','esquema','dilemas','dilema','fantasmas','pijamas','diplomas','diploma','gramos','kilogramos','más','atlas','gas','papás','sofás','sofá','lemas','lema','enigmas','emblemas','teoremas','dogmas','aromas','prismas','síntomas','síntoma','panoramas','crucigramas','sismas']);
// palabras que siguen a una cifra y no son sustantivos («200 para cada familia», «3 200 hasta mayo»)
const NOT_NOUN=new Set(['para','contra','hasta','nada','cada','ahora','esa','esas','esta','estas','otra','otras','toda','todas','sola','solas','apenas','fuera','era','eran','sería','había','tenía','estaba','quedaba','llegaba','ya','pasa','queda','llega','resta','falta','sobra','suma','alcanza','supera','más','menos']);
const COMMON=/(?:istas?|etas?|cidas?|iatras?)$/; // turistas, atletas, homicidas, pediatras: género común → masculino genérico
const FEM_ONLY=new RegExp(`^(?:${FEM_RX})$`,'iu');
function isFeminineNoun(w){
  const x=String(w||'').toLowerCase();
  if(x.length<3||MASC.has(x)||COMMON.test(x)||NOT_NOUN.has(x)||/(?:aba|ía|ra|ase|mente)$/.test(x)&&!FEM_ONLY.test(x)&&!/(?:ura|era|ora|ería|ría)s?$/.test(x))return false;
  if(FEM_ONLY.test(x)||/^(?:leyes|ley|mujeres|veces|redes|red|sedes|naves|nave|llaves|calles|noches|noche|tardes|clases|clase|partes|parte|muertes|madres|gente)$/.test(x))return true;
  return x.length>=4&&/(?:as|a|ción|ciones|sión|siones|dad|dades|tad|tades|tud|tudes|umbre|umbres)$/.test(x);
}

function speakNumbers(input){
  let s=String(input??''),count=0;const hit=v=>{count++;return v;};
  // 0) fechas con punto, barra o guion: 13.10.2026 → trece de octubre de dos mil veintiséis (antes se leía como hora)
  s=s.replace(/(?<![\d.,/:-])(\d{1,2})([./-])(\d{1,2})\2(\d{4})(?![\d])/g,(m,d,_sep,mo,y)=>{
    const dd=Number(d),mm=Number(mo);if(dd<1||dd>31||mm<1||mm>12)return m;
    return hit(`${dd===1?'primero':words(dd)} de ${MONTHS[mm-1]} de ${words(y)}`);
  });
  // 12 m. = mediodía
  s=s.replace(new RegExp(`${L}12\\s?m\\.(?!\\p{L})`,'gu'),()=>hit('doce del mediodía'));
  // 1) horas con a. m. / p. m. (8:30 p.m., 10 a.m., 2:13 PM, 9 p. m.). Si la abreviatura cerraba la oración, el punto se conserva.
  s=s.replace(new RegExp(`${L}(\\d{1,2})(?:[:.](\\d{2}))?\\s?${AMPM}(?![\\p{L}])(\\.?)(\\s*)(?=(.?))`,'giu'),(m,hh,mm,ap,dot,sp,next)=>{
    const h=Number(hh),mi=Number(mm||0);if(h<1||h>12||mi>59)return m;
    const pm=String(ap).toLowerCase()==='p',ends=/\.$/.test(m.replace(/\s+$/,''))&&(next===''||/[\p{Lu}\n]/u.test(next));
    return hit(`${hourWord(h)}${minuteWords(mi)} ${dayPart(h,pm)}${ends?'.':''}${sp}`);
  });
  // 2) hora seguida del período del día (3.30 de la tarde, 8:00 de la noche, 12:15 del mediodía)
  s=s.replace(new RegExp(`${L}(\\d{1,2})[:.](\\d{2})(\\s+(?:de\\s+la\\s+(?:mañana|tarde|noche|madrugada)|del\\s+mediodía))${R}`,'giu'),(m,hh,mm,rest)=>{
    const h=Number(hh),mi=Number(mm);if(h>23||mi>59)return m;const h12=h>12?h-12:h===0?12:h;
    return hit(`${hourWord(h12)}${minuteWords(mi)}${rest}`);
  });
  // 3) ordinales: 1.º de mayo → primero de mayo; 2.° piso → segundo piso; 3.ª edición → tercera edición; 1er → primer
  s=s.replace(new RegExp(`${L}(\\d{1,3})\\.?\\s?([ºª°]|er|ra|ro|do|da|to|ta)${R}(\\s+(?=(\\p{L}+)))?`,'giu'),(m,num,mark,gap,nextWord)=>{
    const n=Number(num);if(n<1||n>100)return m;
    if(/^°$/.test(mark)&&/^(c|f|celsius|fahrenheit)$/i.test(nextWord||''))return m;
    const female=/^(ª|ra|da|ta)$/i.test(mark),beforeNoun=!!nextWord&&!/^(de|del|y|o|a|en)$/i.test(nextWord);
    let w=ordinalWords(n,{female});
    if(!female&&beforeNoun)w=w.replace(/primero$/,'primer').replace(/tercero$/,'tercer');
    if(/^er$/i.test(mark))w=w.replace(/primero$/,'primer').replace(/tercero$/,'tercer');
    return hit(`${w}${gap||''}`);
  });
  // 4a) «3 mil 200» → 3200 (una sola cifra)
  s=s.replace(/(?<![\d.,])(\d{1,3})\s+mil\s+(\d{1,3})(?![\d.,])/g,(m,a,b)=>hit(String(Number(a)*1000+Number(b))));
  // 4b) cifra + sustantivo femenino (1.200 personas, 3,200 computadoras, 21 familias, 1 persona, 300 mil personas, 1 500 000 personas)
  s=s.replace(new RegExp(`(?<![\\p{L}\\p{N}:.,])(\\d{1,3}(?:[.,\\u00a0 ]\\d{3})+|\\d+)(?![.,]\\d)(\\s+mil)?(\\s+)(\\p{Ll}\\p{L}*)${R}`,'gu'),(m,num,mil,sp,noun)=>{
    if(!isFeminineNoun(noun))return m;
    const n=Number(num.replace(/[.,\u00a0 ]/g,''))*(mil?1000:1);
    const w=feminine(String(n));return w?hit(`${w}${sp}${noun}`):m;
  });
  // 4c) miles con coma (3,200 autos): una coma seguida de exactamente 3 cifras no es decimal
  s=s.replace(/(?<![\d.,])(\d{1,3})((?:,\d{3})+)(?![\d]|[.,]\d)/g,(m,a,rest)=>hit(a+rest.replace(/,/g,'')));
  // 5) decimales con punto (1 o 2 cifras después del punto; 3 cifras = miles): 3.5% → tres punto cinco por ciento
  s=s.replace(new RegExp(`(?<![\\p{L}\\p{N}.,/:])(\\d+)\\.(\\d{1,2})(?![\\d]|\\.\\d|:\\d)(\\s?%)?`,'gu'),(m,a,b,pct)=>{
    const dec=/^0/.test(b)?b.split('').map(words).join(' '):words(b);
    return hit(`${words(a)} punto ${dec}${pct?' por ciento':''}`);
  });
  // 6) Lab.50 · romano delante de un sustantivo: «el III Simulacro» → «el tercer Simulacro», «la IV edición» → «la cuarta
  // edición», «los XV Juegos» → «los decimoquintos Juegos». Solo después de un artículo o determinante, o al empezar la
  // oración (I, V y X sueltas, solo después de un determinante). Lo de siempre («León XIV», «siglo XXI») no se toca.
  s=s.replace(new RegExp(`(^|[.!?:;]\\s+|\\n\\s*|["“«(]\\s*|${L}${DET_RX}\\s+)([IVXLC]{1,7})(\\s+)(\\p{L}[\\p{L}-]*)`,'gu'),(m,lead,roman,sp,noun)=>{
    const n=romanToInt(roman),det=/\p{L}/u.test(lead);
    if(!n||n>100||(roman.length===1&&(!det||!/^[IVX]$/.test(roman))))return m;
    const low=noun.toLowerCase();
    if(low.length<3||NOT_NOUN.has(low)||ROMAN_NEXT_STOP.has(low)||/^[\p{Lu}]{2,}$/u.test(noun))return m;
    // género y número: del artículo si lo hay («la II Guerra», «los XV Juegos»); si no, del sustantivo
    const d=(lead.match(/\p{L}+/u)||[''])[0].toLowerCase();
    const female=/^(?:la|las|una|esta|estas|esa|esas|nuestra|aquella)$/.test(d)?true:/^(?:el|los|un|del|al|este|estos|ese|esos|nuestro|aquel)$/.test(d)?false:isFeminineNoun(low);
    const plural=/^(?:los|las|sus|estos|estas|esos|esas)$/.test(d)||(!d||d==='su')&&low.length>4&&/s$/.test(low)&&!/(?:is|us)$/.test(low);
    const w=romanOrdinal(n,{female,plural});
    const start=!det&&!/[“«("]/.test(lead)&&(lead===''||/[.!?:;\n]/.test(lead));
    return hit(`${lead}${start?w[0].toUpperCase()+w.slice(1):w}${sp}${noun}`);
  });
  return{text:s,count};
}
// Lab.50 · ordinales para un romano delante de un sustantivo (hasta 20 en una palabra; desde 21, cardinal)
const ORD=['','primero','segundo','tercero','cuarto','quinto','sexto','séptimo','octavo','noveno','décimo','undécimo','duodécimo','decimotercero','decimocuarto','decimoquinto','decimosexto','decimoséptimo','decimoctavo','decimonoveno','vigésimo'];
function romanOrdinal(n,{female=false,plural=false}={}){
  if(n>20){const w=words(n);return female?fem(w):w.replace(/veintiuno$/,'veintiún').replace(/(^|\s)uno$/,'$1un');}
  let w=ORD[n];
  if(female)w=w.replace(/o$/,'a');
  else if(!plural)w=w.replace(/(primer|tercer)o$/,'$1');
  return plural?w+'s':w;
}
const DET=['el','la','los','las','del','al','un','una','su','sus','este','esta','estos','estas','ese','esa','esos','esas','nuestro','nuestra','aquel','aquella'].map(w=>`[${w[0]}${w[0].toUpperCase()}]${w.slice(1)}`).join('|');
const DET_RX=`(?:${DET})`;
// palabras que siguen a una letra suelta y no son el sustantivo («la V de victoria», «el X y el Y»)
const ROMAN_NEXT_STOP=new Set(['de','del','y','e','o','u','en','a','al','con','por','que','se','es','son','fue','como','sin','sobre','entre','mientras']);

// Final de cada locución: sin punto, Qwen (y otras voces) no baja la entonación en la última palabra.
function endWithPunctuation(text){
  const s=String(text??'');const t=s.replace(/\s+$/,'');if(!t)return s;
  if(/[.!?…]["'»”’)\]]*$/.test(t))return s;
  const m=t.match(/^(.*?)(["'»”’)\]]*)$/s);
  return `${m[1].replace(/[,;:\-–—]+$/,'')}${m[2]}.`;
}

// Red de seguridad: con el normalizador encendido, si la locución todavía trae cifras (una regla del paquete actualizable,
// el aprendizaje guardado u otra capa falló y la cadena cayó al texto sin convertir), se vuelve a convertir con las
// reglas base. Cada caso queda en logs/speech-fallback.log (carpeta de datos) con el motivo que dio la cadena.
function digitSafetyNet(self,out){
  // solo cifras sueltas («3358», «2025»); las pegadas a letras («B5», «COVID-19») no cuentan
  if(!out||typeof out!=='object'||!/(?<![\p{L}\d])\d+(?![\p{L}\d])/u.test(String(out.text||'')))return out;
  const settings=self?.getSettings?.()||{};if(settings?.tts?.speechNormalizerEnabled===false)return out;
  const {normalizeSpeech,validateSpeech}=require('./speechNormalizer0326'),{structuralPreNormalize}=require('./speechRules0328');
  const before=String(out.text),pre=structuralPreNormalize(before,{rules:[]}).text,n=normalizeSpeech(pre,{enabled:true}).text,check=validateSpeech(before,n);
  const digits=t=>(String(t).match(/\d+/g)||[]).length,fixed=check.ok&&digits(n)<digits(before);
  try{
    const fs=require('fs'),path=require('path'),dir=path.join(String(self?.dataDir||process.env.GEC_V2_TTS_LAB_ROOT||'.'),'logs');fs.mkdirSync(dir,{recursive:true});
    const why=[out.speechFallbackReason,out.speechDiagnostic?.fallbackReason].filter(Boolean).join(' | ')||'sin motivo informado';
    fs.appendFileSync(path.join(dir,'speech-fallback.log'),`[${new Date().toISOString()}] ${fixed?'CORREGIDO':'SIN CAMBIOS'} · motivo: ${why} · cifras: ${(before.match(/\d[\d.,:/-]*/g)||[]).slice(0,8).join(' ')} · ${before.slice(0,140).replace(/\s+/g,' ')}\n`);
  }catch{}
  if(!fixed)return out;
  return{...out,text:n,speechFallbackReason:[out.speechFallbackReason,'Lab.46: cifras convertidas por la red de seguridad'].filter(Boolean).join(' | ')};
}

function installSpeechNumbersLab46(){
  const {PronunciationNormalizer}=require('./pronunciation');
  const proto=PronunciationNormalizer.prototype;
  if(!proto.__ecLab46Numbers){
    Object.defineProperty(proto,'__ecLab46Numbers',{value:true});
    const base=proto.normalize;
    proto.normalize=async function(script,options={}){
      let r={text:String(script??''),count:0};
      try{r=speakNumbers(script);}catch{r={text:String(script??''),count:0};}
      let out=await base.call(this,r.text,options);
      try{out=digitSafetyNet(this,out);}catch{}
      if(!r.count||!out||typeof out!=='object')return out;
      return{...out,speechTransforms:[...new Set([...(out.speechTransforms||[]),'horas, ordinales y decimales'])],speechNumbersVersion:VERSION};
    };
  }
  try{
    const {KokoroTTS}=require('./kokoro'),k=KokoroTTS.prototype;
    if(typeof k.generate==='function'&&!k.__ecLab46EndPunct){
      Object.defineProperty(k,'__ecLab46EndPunct',{value:true});
      const gen=k.generate;
      k.generate=function(text,...rest){let t=text;try{t=endWithPunctuation(text);}catch{}return gen.call(this,t,...rest);};
    }
  }catch{}
  return true;
}

module.exports={VERSION,speakNumbers,endWithPunctuation,feminine,digitSafetyNet,installSpeechNumbersLab46};
