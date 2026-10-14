'use strict';
// Lab.51 · Más correcciones de lectura (se llaman desde speakNumbers de Lab.46, en el punto que corresponde a cada una):
//   - abreviaturas de cargos y direcciones: «Gral.» → «general», «Ing.» → «ingeniero» («la Ing.» → «ingeniera»),
//     «Urb.» → «urbanización», «Mz.» → «manzana», «Lt.» → «lote»… (antes la voz las leía como sílabas o las saltaba);
//   - teléfonos: «Celular 987 654 321» se leía con la cifra escrita y además dígito por dígito, y «987654321 de» quedaba
//     «unode». Ahora: «celular nueve ocho siete, seis cinco cuatro, tres dos uno»; fijos de Lima «01 311 5930» igual;
//   - tecnología: «5G» → «cinco ge» (antes «cinco gramos»), «G20» → «ge veinte», «2x1» → «dos por uno»;
//   - hora con «las» delante: «a las 20:00» → «a las veinte horas» (en notas de deportes se tomaba como marcador);
//   - códigos con guion: «2026-001» → «dos mil veintiséis, uno» (antes «dos mil veintiséis menos uno»); años
//     «2021-2026» → «dos mil veintiuno a dos mil veintiséis». Los códigos de documentos siguen en Lab.32;
//   - estatura: «1,75 m» → «un metro setenta y cinco»;
//   - «uno» delante de un sustantivo masculino: «71 años» → «setenta y un años», «21 heridos» → «veintiún heridos»,
//     «1 muerto» → «un muerto» (antes «setenta y uno años»);
//   - decimales con coma: «3,2 %» → «tres punto dos por ciento», igual que con punto.
const {integerWords}=require('./speechRules0328');

const VERSION='lab51-speech-1';
const L='(?<![\\p{L}\\p{N}])',R='(?![\\p{L}\\p{N}])';
const words=n=>integerWords(Number(n));
const DIG=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve'];
const apocope=w=>String(w).replace(/veintiuno$/,'veintiún').replace(/(^|\s)uno$/,'$1un');

// ── abreviaturas ─────────────────────────────────────────────────────────────────────────────────────────────
// [abreviatura, masculino, femenino]
const ABBR=[
  ['Gral','general','general'],['Cmdte','comandante','comandante'],['Cmte','comandante','comandante'],['Crnl','coronel','coronel'],
  ['Cnel','coronel','coronel'],['Tte','teniente','teniente'],['Sgto','sargento','sargento'],['Ing','ingeniero','ingeniera'],
  ['Lic','licenciado','licenciada'],['Abog','abogado','abogada'],['Arq','arquitecto','arquitecta'],['Mg','magíster','magíster'],
  ['Mag','magíster','magíster'],['Mons','monseñor','monseñor'],['Pdte','presidente','presidenta'],['Pdta','presidenta','presidenta'],
  ['Pbro','presbítero','presbítero'],['Prof','profesor','profesora'],['Profa','profesora','profesora'],
  ['Urb','urbanización'],['Mz','manzana'],['Lt','lote'],['Psje','pasaje'],['Dpto','departamento'],['Prov','provincia'],['Dist','distrito'],['Cía','compañía']
];
const ABBR_RX=new RegExp(`(?:(\\b[Ll]a|\\b[Uu]na)\\s+)?${L}(${ABBR.map(a=>a[0]).sort((a,b)=>b.length-a.length).join('|')})\\.(?=\\s)`,'gu');
function expandAbbreviations(s){
  return String(s).replace(ABBR_RX,(m,art,ab,offset,full)=>{
    const row=ABBR.find(a=>a[0]===ab);if(!row)return m;
    const w=art&&row[2]?row[2]:row[1];
    const start=offset===0&&!art||/[.!?:]\s*$/.test(full.slice(0,offset));
    return`${art?art+' ':''}${start&&!art?w[0].toUpperCase()+w.slice(1):w}`;
  });
}

// ── teléfonos ───────────────────────────────────────────────────────────────────────────────────────────────
function digitGroups(raw){
  const parts=String(raw).trim().split(/[\s.-]+/).filter(Boolean),flat=parts.join('');
  let groups=parts.length>1?parts:[];
  if(groups.length<2){groups=[];for(let i=0;i<flat.length;i+=3)groups.push(flat.slice(i,i+3));if(groups.length>1&&groups[groups.length-1].length===1){const last=groups.pop();groups[groups.length-1]+=last;}}
  return groups.map(g=>g.split('').map(d=>DIG[Number(d)]).join(' ')).join(', ');
}
function speakPhones(s){
  let out=String(s);
  // con etiqueta: teléfono, celular, cel., WhatsApp, central…
  out=out.replace(new RegExp(`${L}(tel[eé]fonos?|celular(?:es)?|cel\\.|whatsapp|wsp|central(?:\\s+telef[oó]nica)?|l[ií]nea)(\\s*(?:N\\.?\\s*[°º]?|:)?\\s*)(\\+?51[\\s-]?)?(\\d[\\d\\s.-]{5,15}\\d)${R}`,'giu'),(m,label,_sep,cc,num)=>{
    const lab=/^cel\.$/i.test(label)?'celular':label;
    return`${lab}${cc?' más cinco uno,':''} ${digitGroups(num)}`;
  });
  // celulares sueltos (9 dígitos que empiezan con 9) y fijos de Lima (01 311 5930)
  out=out.replace(/(?<![\p{L}\p{N}.,])9\d{2}[\s-]?\d{3}[\s-]?\d{3}(?![\p{L}\p{N}]|[.,]\d)/gu,m=>digitGroups(m));
  out=out.replace(/(?<![\p{L}\p{N}.,])\(?01\)?[\s-]?\d{3}[\s-]?\d{4}(?![\p{L}\p{N}]|[.,]\d)/gu,m=>digitGroups(m.replace(/[()]/g,'')));
  return out;
}

// ── tecnología y «por» ─────────────────────────────────────────────────────────────────────────────────────
function speakTech(s){
  return String(s)
    .replace(new RegExp(`${L}([2-6])G${R}`,'gu'),(m,n)=>`${DIG[Number(n)]} ge`)
    .replace(new RegExp(`${L}G(\\d{1,2})${R}`,'gu'),(m,n)=>`ge ${words(n)}`)
    .replace(new RegExp(`${L}(\\d{1,2})\\s?[xX×]\\s?(\\d{1,2})${R}`,'gu'),(m,a,b)=>`${words(a)} por ${words(b)}`);
}

// ── hora con «las» delante (antes de la regla de marcadores de 0328) ────────────────────────────────────────────
function speakClock(s){
  return String(s).replace(new RegExp(`${L}((?:a|desde|hasta|de|entre|para)\\s+las\\s+)(\\d{1,2}):(\\d{2})(\\s+horas?)?${R}`,'giu'),(m,lead,hh,mm,hrs)=>{
    const h=Number(hh),mi=Number(mm);if(h<2||h>23||mi>59)return m;
    return`${lead}${words(h)} horas${mi?` con ${words(mi)} minutos`:''}`;
  });
}

// ── códigos con guion y rangos de años ─────────────────────────────────────────────────────────────────────
const DOC_BEFORE=/(?:N\s*[°º.]|Nro\.?|N[úu]m\.?|n[úu]mero|ley|decreto|resoluci[oó]n|expediente|exp\.|caso|carpeta|denuncia|oficio|informe|acta|D\.\s?S\.|R\.\s?M\.|R\.\s?D\.)[^.;:]{0,24}$/i;
function speakCodes(s){
  return String(s).replace(/(?<![\p{L}\p{N}/.,°º-])(\d{1,6})-(\d{1,6})(?![\p{L}\p{N}]|-[\p{L}\p{N}]|[.,]\d)/gu,(m,a,b,offset,full)=>{
    if(a.length<=2&&b.length<=2)return m;                       // marcadores y rangos cortos: reglas de siempre
    if(DOC_BEFORE.test(full.slice(Math.max(0,offset-40),offset)))return m; // documentos: Lab.32
    const year=x=>/^(?:19|20)\d{2}$/.test(x);
    if(year(a)&&year(b)&&Number(b)>Number(a))return`${words(a)} a ${words(b)}`;
    if(!/^0/.test(b)&&Number(b)>Number(a)&&!year(a))return`${words(a)} ${/\bentre\s+$/i.test(full.slice(Math.max(0,offset-8),offset))?'y':'a'} ${words(b)}`; // rango: 100-200
    return`${words(Number(a))}, ${words(Number(b))}`;
  });
}

// ── estatura: 1,75 m → un metro setenta y cinco ─────────────────────────────────────────────────────────────
function speakHeight(s){
  return String(s).replace(new RegExp(`(?<![\\p{L}\\p{N}.,])([12])[.,](\\d{2})\\s?(?:m|metros?)${R}`,'gu'),(m,a,b)=>{
    const cm=Number(b);return`${a==='1'?'un metro':'dos metros'}${cm?` ${words(cm)}`:''}`;
  });
}

// ── «uno» delante de un sustantivo masculino ────────────────────────────────────────────────────────────────
const NOT_NOUN=new Set(['de','del','a','al','y','e','o','u','en','con','por','para','que','se','es','son','fue','era','como','pero','cuando','durante','mientras','sobre','sin','entre','hasta','desde','más','menos','antes','después','entonces','solo','sólo','cada','todo','todos','esto','eso','otro','otros','mismo','mismos','resultaron','fueron','están','estaban','han','habían','tienen','tenían']);
const MASC_SING=/^(?:año|mes|día|muerto|herido|detenido|punto|gol|voto|sol|dólar|euro|kilómetro|metro|kilo|kilogramo|gramo|litro|galón|minuto|segundo|grado|caso|menor|niño|hombre|adulto|policía|militar|soldado|trabajador|estudiante|pasajero|agente|jugador|país|distrito|millón|centímetro|milímetro|nuevo|solo|último|primer|turista|atleta|ganador|lugar|lote|local|hospital|colegio|accidente|incendio|sismo|vehículo|auto|bus|camión|avión|hijo|nieto|hermano|caso)$/;
const VERB_END=/(?:amos|emos|imos|aron|ieron|aban|ían)$/;
function isMasculineAfter(word,n){
  const w=String(word||'').toLowerCase();
  if(w.length<2||NOT_NOUN.has(w)||VERB_END.test(w))return false;
  if(n===1)return MASC_SING.test(w)||/o$/.test(w)&&w.length>=4;
  return /s$/.test(w)&&w.length>=4;
}
function masculineApocope(s){
  return String(s).replace(new RegExp(`(?<![\\p{L}\\p{N}:.,/°º-])(\\d{1,3}(?:[ \\u00a0]\\d{3})*|\\d+)(?![.,]\\d)(\\s+mil)?(\\s+)(\\p{Ll}[\\p{L}]*)${R}`,'gu'),(m,num,mil,sp,noun)=>{
    const n=Number(num.replace(/[  ]/g,''));if(!Number.isSafeInteger(n)||n<1)return m;
    if(n%10!==1||n%100===11)return m;
    if(!isMasculineAfter(noun,mil?2:n))return m;
    const w=apocope(words(n));
    return`${w}${mil?' mil':''}${sp}${noun}`;
  });
}

// ── decimales con coma: 3,2 % → tres punto dos por ciento ──────────────────────────────────────────────────
function commaDecimals(s){
  return String(s).replace(/(?<![\p{L}\p{N}.,/:])(\d+),(\d{1,2})(?![\d]|,\d)(\s?%)?/gu,(m,a,b,pct)=>{
    const dec=/^0/.test(b)?b.split('').map(d=>DIG[Number(d)]).join(' '):words(b);
    return`${words(a)} punto ${dec}${pct?' por ciento':''}`;
  });
}

module.exports={VERSION,expandAbbreviations,speakPhones,speakTech,speakClock,speakCodes,speakHeight,masculineApocope,commaDecimals,digitGroups};
