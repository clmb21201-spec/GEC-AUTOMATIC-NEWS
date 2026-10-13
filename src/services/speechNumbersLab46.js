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
const {integerWords}=require('./speechRules0328');
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
  const n=Number(digits);if(!Number.isSafeInteger(n)||n<1||n>=1e6)return null;
  let w=words(n);
  w=w.replace(/ientos(?=\s|$)/g,'ientas');
  w=w.replace(/(^|\s)uno$/,'$1una').replace(/veintiuno$/,'veintiuna').replace(/(^|\s)un mil(?=\s|$)/,'$1mil');
  return w;
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
  // 4) cifra + sustantivo femenino (1.200 personas, 21 familias, 1 persona); miles con punto o espacio
  s=s.replace(new RegExp(`(?<![\\p{L}\\p{N}:.,])(\\d{1,3}(?:[.\\u00a0 ]\\d{3})+|\\d+)(?![.,]\\d)(\\s+)(${FEM_RX})${R}`,'giu'),(m,num,sp,noun)=>{
    const w=feminine(num.replace(/[.  ]/g,''));return w?hit(`${w}${sp}${noun}`):m;
  });
  // 5) decimales con punto (1 o 2 cifras después del punto; 3 cifras = miles): 3.5% → tres punto cinco por ciento
  s=s.replace(new RegExp(`(?<![\\p{L}\\p{N}.,/:])(\\d+)\\.(\\d{1,2})(?![\\d]|\\.\\d|:\\d)(\\s?%)?`,'gu'),(m,a,b,pct)=>{
    const dec=/^0/.test(b)?b.split('').map(words).join(' '):words(b);
    return hit(`${words(a)} punto ${dec}${pct?' por ciento':''}`);
  });
  return{text:s,count};
}

// Final de cada locución: sin punto, Qwen (y otras voces) no baja la entonación en la última palabra.
function endWithPunctuation(text){
  const s=String(text??'');const t=s.replace(/\s+$/,'');if(!t)return s;
  if(/[.!?…]["'»”’)\]]*$/.test(t))return s;
  const m=t.match(/^(.*?)(["'»”’)\]]*)$/s);
  return `${m[1].replace(/[,;:\-–—]+$/,'')}${m[2]}.`;
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
      const out=await base.call(this,r.text,options);
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

module.exports={VERSION,speakNumbers,endWithPunctuation,feminine,installSpeechNumbersLab46};
