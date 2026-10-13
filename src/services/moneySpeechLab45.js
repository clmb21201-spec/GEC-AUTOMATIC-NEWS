'use strict';
// Lab.45 · Cifras con dinero y con millones, leídas como en un noticiero peruano.
// «Deuda de S/ 3.2 millones» llegaba mal a la voz: la pronunciación básica la pasaba a «3.2 millones de soles» y, según
// la cifra, el normalizador decía «tres coma dos», tomaba «3.25» o «3.20» por una hora («tres horas con veinticinco
// minutos»), dejaba «S/» suelto o leía «18 000» como «dieciocho cero». Ahora, antes de todo lo demás:
//   - S/ 3.2 millones → «tres punto dos millones de soles»; US$ 2.5 millones → «dos punto cinco millones de dólares»;
//   - S/ 1.500 (o 1,500 o 1 500) → «mil quinientos soles»: un separador seguido de exactamente 3 cifras es de miles;
//   - S/ 3.20 → «tres soles con veinte céntimos»; S/ 1 → «un sol»; S/ 21 → «veintiún soles»;
//   - 3.2 millones (sin moneda) → «tres punto dos millones»; 15.4 mil millones → «quince punto cuatro mil millones»;
//   - 18 000 (miles con espacio) → «18000», que el normalizador ya lee bien.
// Se instala al final de bootstrap-v2lab.js envolviendo PronunciationNormalizer.prototype.normalize (vale para todos
// los motores de voz y para Merlín); lo que se ve en pantalla no cambia.
const {integerWords}=require('./speechRules0328');

const VERSION='lab45-money-1';
const CURRENCY={
  PEN:{one:'sol',many:'soles',cent1:'céntimo',cents:'céntimos'},
  USD:{one:'dólar',many:'dólares',cent1:'centavo',cents:'centavos'},
  EUR:{one:'euro',many:'euros',cent1:'céntimo',cents:'céntimos'}
};
const CUR_RX='(S\\/\\.?|PEN|US\\$|USD|\\$|€|EUR)';
const NUM_RX='(\\d{1,3}(?:[ \\u00a0.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d+)?)';
const SCALE_RX='(mil\\s+millones|millones|mill[oó]n|billones|bill[oó]n|mil)';
const curCode=c=>{const s=String(c||'').toUpperCase();return s.startsWith('S/')||s==='PEN'?'PEN':s==='€'||s==='EUR'?'EUR':'USD';};

// «1.500» / «1,500» / «1 500» → miles; «3.2» / «3,25» → decimal; «1.234,56» → miles y decimal.
function parseAmount(raw){
  const s=String(raw||'').replace(/ /g,' ').trim();
  if(!/^\d/.test(s))return null;
  const seps=[...s.matchAll(/[ .,]/g)].map(m=>m.index);
  if(!seps.length)return{int:s,dec:''};
  const last=seps[seps.length-1],tail=s.slice(last+1);
  let int=s,dec='';
  if(s[last]!==' '&&tail.length!==3){int=s.slice(0,last);dec=tail;}
  int=int.replace(/[ .,]/g,'');
  if(!/^\d+$/.test(int)||(dec&&!/^\d+$/.test(dec)))return null;
  return{int,dec};
}
const big=n=>{try{return BigInt(n);}catch{return null;}};
function intWords(digits){const v=big(digits);if(v==null)return String(digits);if(v>BigInt(Number.MAX_SAFE_INTEGER))return String(digits);return integerWords(Number(v));}
// «uno» → «un», «veintiuno» → «veintiún», «ciento uno» → «ciento un» (delante de un sustantivo)
const apocope=w=>String(w).replace(/veintiuno$/,'veintiún').replace(/(^|\s)uno$/,'$1un');
// parte decimal: «2» → «dos», «25» → «veinticinco», «05» → «cero cinco»
function decimalWords(dec){if(!dec)return'';if(/^0/.test(dec))return dec.split('').map(d=>intWords(d)).join(' ').replace(/^uno$/,'uno');return intWords(dec);}
function scaleWord(s){const t=String(s||'').toLowerCase().replace(/\s+/g,' ');if(/^mil millones$/.test(t))return'mil millones';if(/^mill[oó]n$/.test(t))return'millón';if(/^bill[oó]n$/.test(t))return'billón';return t;}
// cifra + escala: «tres punto dos millones», «un millón», «veintiún millones», «quince punto cuatro mil millones»
function scaled(p,scale){
  const sc=scaleWord(scale),head=p.dec?`${intWords(p.int)} punto ${decimalWords(p.dec)}`:apocope(intWords(p.int));
  const one=!p.dec&&/^0*1$/.test(p.int);
  const word=one&&sc==='millones'?'millón':one&&sc==='billones'?'billón':sc;
  return`${one&&sc==='mil'?'mil':head+' '+word}`.replace(/^un mil$/,'mil');
}
const needsDe=sc=>/millón|millones|billón|billones/.test(sc);

function moneyWords(cur,raw,scale){
  const p=parseAmount(raw),c=CURRENCY[curCode(cur)];if(!p)return null;
  if(scale){const sc=scaleWord(scale);return`${scaled(p,sc)}${needsDe(sc)?' de':''} ${c.many}`;}
  const one=/^0*1$/.test(p.int);
  if(p.dec&&p.dec.length<=2){
    const cents=p.dec.length===1?p.dec+'0':p.dec;
    if(/^0+$/.test(cents))return`${apocope(intWords(p.int))} ${one?c.one:c.many}`;
    const cn=Number(cents);
    if(/^0+$/.test(p.int))return`${apocope(intWords(String(cn)))} ${cn===1?c.cent1:c.cents}`;
    return`${apocope(intWords(p.int))} ${one?c.one:c.many} con ${apocope(intWords(String(cn)))} ${cn===1?c.cent1:c.cents}`;
  }
  if(p.dec)return`${intWords(p.int)} punto ${decimalWords(p.dec)} ${c.many}`;
  return`${apocope(intWords(p.int))} ${one?c.one:c.many}`;
}

function speakMoney(input){
  let text=String(input??''),count=0;
  const B='(?<![\\p{L}\\p{N}])',E='(?![\\p{L}\\p{N}])';
  // 1) con moneda delante (S/ 3.2 millones, US$ 2.5 millones, S/ 1.500, S/ 3.20)
  text=text.replace(new RegExp(`${CUR_RX}\\s?${NUM_RX}(?:\\s+${SCALE_RX}${E})?(?:\\s+de\\s+(?:soles|d[oó]lares|euros)${E})?`,'giu'),(m,cur,num,scale)=>{
    if(cur==='$'&&/^\d{4}$/.test(num))return m;
    const w=moneyWords(cur,num,scale);if(!w)return m;count++;return w;
  });
  // 2) cifra con decimales + escala, sin moneda delante (3.2 millones de soles, 15.4 mil millones, 3,25 millones de personas)
  text=text.replace(new RegExp(`${B}(\\d+[.,]\\d{1,2})\\s+${SCALE_RX}${E}`,'giu'),(m,num,scale)=>{
    const p=parseAmount(num);if(!p||!p.dec)return m;count++;return scaled(p,scale);
  });
  // 3) miles separados con espacio: 18 000 → 18000 (sin tocar años ni listas: grupos de exactamente 3 cifras)
  text=text.replace(/(?<![\d.,])(\d{1,3})((?:[  ]\d{3})+)(?![\d.,]\d|\d)/g,(m,a,rest)=>{count++;return a+rest.replace(/[  ]/g,'');});
  return{text,count};
}

function installMoneySpeechLab45(){
  const {PronunciationNormalizer}=require('./pronunciation');
  const proto=PronunciationNormalizer.prototype;
  if(proto.__ecLab45Money)return false;
  Object.defineProperty(proto,'__ecLab45Money',{value:true});
  const base=proto.normalize;
  proto.normalize=async function(script,options={}){
    let r={text:String(script??''),count:0};
    try{r=speakMoney(script);}catch{r={text:String(script??''),count:0};}
    const out=await base.call(this,r.text,options);
    if(!r.count||!out||typeof out!=='object')return out;
    return{...out,speechTransforms:[...new Set([...(out.speechTransforms||[]),'cifras con dinero'])],moneySpeechVersion:VERSION};
  };
  return true;
}

module.exports={VERSION,speakMoney,moneyWords,parseAmount,installMoneySpeechLab45};
