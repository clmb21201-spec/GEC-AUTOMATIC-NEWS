'use strict';
// Lab.37 · Noticias con movimiento en la salida clásica.
// Configuración por perfil en news-motion.json (carpeta de datos): nivel de movimiento, colores del movimiento (del
// Diseño o personalizados), datos clave, indicador de voz, reloj, golpe de marca entre noticias y ticker.
// A cada noticia que va a la salida se le agrega p.motion = {sentences, facts, ticker}:
// - sentences: oraciones de la locución (titular + guion) con su inicio, fin y punto de corte (mitad de la pausa),
//   ancladas a los tramos con voz del WAV, como los subtítulos de Merlín. Los planos solo cambian en esos cortes.
// - facts: datos clave sacados del guion sin IA (cifras, marcadores, personas con cargo, lugares, siglas, fechas),
//   con el segundo en que la voz los nombra. Uno es el principal (cifra del titular o la bajada).
// - ticker: titulares en cola (los escribe la IA), otros titulares de los RSS del perfil y mensajes del operador.
// El diseño (output:design) lleva design.newsMotion con la configuración del perfil activo.
// IPC newsMotion:get|set.
const fs=require('fs');
const path=require('path');
const {fileURLToPath}=require('url');

const FILE='news-motion.json';
const LEVELS=new Set(['sobrio','normal','dinamico','custom']);
const PLANES=['full','side','zoom','dato'];
const HEX=/^#[0-9a-f]{6}$/i;
const COLOR_KEYS=['bar1','bar2','bar3','voiceBg','voiceBars','tickerBg','tickerText'];
const DEFAULT={enabled:true,level:'normal',facts:true,voice:true,clock:true,progress:true,sting:true,
  colors:{mode:'auto',bar1:'#F7C600',bar2:'#FFFFFF',bar3:'#000000',voiceBg:'#000000',voiceBars:'#F7C600',tickerBg:'#F7C600',tickerText:'#000000'},
  ticker:{enabled:true,queue:true,rss:true,label:'ÚLTIMO',every:3,messages:[]},
  sfx:{enabled:true,style:'normal',volume:45,events:{sting:true,plane:true,dato:true,ex:true,card:false,host:true}}};
const SFX_STYLES=new Set(['suave','normal','marcado']);
const SFX_EVENTS=Object.keys(DEFAULT.sfx.events);

const clone=v=>JSON.parse(JSON.stringify(v));
const bool=(v,d)=>v==null?d:v!==false;
function normalizeConfig(raw={}){
  const r=raw&&typeof raw==='object'?raw:{},c=r.colors&&typeof r.colors==='object'?r.colors:{},t=r.ticker&&typeof r.ticker==='object'?r.ticker:{};
  const colors={mode:c.mode==='custom'?'custom':'auto'};for(const k of COLOR_KEYS)colors[k]=HEX.test(String(c[k]||''))?String(c[k]).toUpperCase():DEFAULT.colors[k];
  const msgs=(Array.isArray(t.messages)?t.messages:String(t.messages||'').split(/\r?\n/)).map(x=>String(x||'').replace(/\s+/g,' ').trim().slice(0,140)).filter(Boolean).slice(0,12);
  // Personalizado: qué planos se usan, cada cuánto pueden cambiar (3–15 s) y si el cambio es con barrido o fundido
  const cu=r.custom&&typeof r.custom==='object'?r.custom:{},planes={};for(const k of PLANES)planes[k]=bool(cu.planes?.[k],true);if(!PLANES.some(k=>planes[k]))planes.full=true;
  // Lab.39: sonidos de transición (el volumen se elige en Audio y locución → Música y mezcla)
  const fx=r.sfx&&typeof r.sfx==='object'?r.sfx:{},fe=fx.events&&typeof fx.events==='object'?fx.events:{},events={};
  for(const k of SFX_EVENTS)events[k]=bool(fe[k],DEFAULT.sfx.events[k]);
  const vol=Number(fx.volume);
  const sfx={enabled:bool(fx.enabled,true),style:SFX_STYLES.has(fx.style)?fx.style:'normal',volume:Number.isFinite(vol)?Math.max(0,Math.min(100,Math.round(vol))):45,events};
  const custom={planes,minSec:Math.max(3,Math.min(15,Math.round(Number(cu.minSec)||6))),transition:cu.transition==='fade'?'fade':'wipe'};
  return{enabled:bool(r.enabled,true),level:LEVELS.has(r.level)?r.level:'normal',custom,facts:bool(r.facts,true),voice:bool(r.voice,true),clock:bool(r.clock,true),progress:bool(r.progress,true),sting:bool(r.sting,true),colors,
    ticker:{enabled:bool(t.enabled,true),queue:bool(t.queue,true),rss:bool(t.rss,true),label:String(t.label??'ÚLTIMO').replace(/\s+/g,' ').trim().slice(0,24)||'ÚLTIMO',every:Math.max(1,Math.min(10,Math.round(Number(t.every)||3))),messages:msgs},sfx};
}

// ---------------------------------------------------------------- oraciones y tiempos (mismo criterio que Merlín)
const sentencesOf=t=>String(t||'').replace(/\s+/g,' ').trim().split(/(?<=[.!?;:])\s+/).filter(Boolean);
const fold=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function locutionText(title,script){
  const t=String(title||'').trim(),s=String(script||'').trim();if(!t)return s;if(!s)return t;
  const clean=x=>fold(x).replace(/[^a-z0-9]+/g,' ').trim();
  const ct=clean(t),cs=clean(s.slice(0,Math.max(t.length*2,220)));
  return ct&&cs.startsWith(ct)?s:`${t}. ${s}`;
}
// Reparte las oraciones sobre la voz: cada límite entre oraciones se ancla a la pausa real más cercana a lo esperado
// por el largo del texto. Sin tramos de voz, reparte por largo sobre la duración del audio.
function alignSentences(sentences,segments,durationSec,spoken=''){
  const n=sentences.length;if(!n)return[];
  const sp=sentencesOf(spoken),w=(sp.length===n?sp:sentences).map(x=>x.length+6);
  const seg=(Array.isArray(segments)?segments:[]).filter(x=>Array.isArray(x)&&x[1]>x[0]).map(x=>[+x[0],+x[1]]).sort((a,b)=>a[0]-b[0]);
  const W=w.reduce((a,b)=>a+b,0)||1;
  if(!seg.length){const D=Math.max(1,Number(durationSec)||n*4);let acc=0;return sentences.map((text,i)=>{const s=D*acc/W;acc+=w[i];const e=D*acc/W;return{text,start:+s.toFixed(3),end:+e.toFixed(3),cut:+s.toFixed(3)};});}
  const vStart=[];let T=0;for(const x of seg){vStart.push(T);T+=x[1]-x[0];}
  const gaps=[];for(let i=0;i+1<seg.length;i++)gaps.push({v:vStart[i]+seg[i][1]-seg[i][0],dur:seg[i+1][0]-seg[i][1],idx:i});
  const len=w.map(x=>T*x/W),bounds=[{v:0,gap:-1}];let expected=0,lastGap=-1;
  for(let k=1;k<n;k++){
    expected+=len[k-1];const tol=.45*Math.min(len[k-1],len[k]);let best=null,score=Infinity;
    for(const g of gaps){if(g.idx<=lastGap||g.dur<.18||Math.abs(g.v-expected)>tol)continue;const sc=Math.abs(g.v-expected)-.15*g.dur;if(sc<score){score=sc;best=g;}}
    if(best){lastGap=best.idx;bounds.push({v:best.v,gap:best.idx});}else bounds.push({v:Math.max(bounds[bounds.length-1].v,expected),gap:-1});
  }
  // tiempo de voz (sin pausas) → segundo real del audio
  const real=v=>{for(let i=0;i<seg.length;i++){const d=seg[i][1]-seg[i][0];if(v<=vStart[i]+d+1e-9)return seg[i][0]+Math.max(0,v-vStart[i]);}return seg[seg.length-1][1];};
  return sentences.map((text,i)=>{const b=bounds[i],g=b.gap;
    const start=i===0?seg[0][0]:g>=0?seg[g+1][0]:real(b.v),cut=i===0?0:g>=0?(seg[g][1]+seg[g+1][0])/2:start;
    const nb=bounds[i+1],end=nb?(nb.gap>=0?seg[nb.gap][1]:real(nb.v)):seg[seg.length-1][1];
    return{text,start:+start.toFixed(3),end:+Math.max(start,end).toFixed(3),cut:+cut.toFixed(3)};});
}

// ---------------------------------------------------------------- datos clave (sin IA)
// Lab.46: también «3 mil 200» (una sola cifra)
// Lab.50: primero los millones con apóstrofo (3'244,426) y los miles con varias comas (3,200,000); antes se cortaban en «3» y «3,200»
const NUM='\\d{1,3}[\'’´]\\d{3}(?:[.,\\s]\\d{3})*(?:[.,]\\d{1,2})?(?![\\d])|\\d{1,3}(?:,\\d{3}){2,}(?:\\.\\d{1,2})?(?![\\d])|\\d{1,3}\\smil\\s\\d{1,3}(?![\\d.,])|\\d{1,3}(?:[.\\s]\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?';
const SCALE='(?:\\s(?:mil\\s)?(?:millones|millón|mil|billones))?';
const RE_MONEY=new RegExp(`(?:S\\/\\.?|US\\$|\\$|€|£)\\s?(?:${NUM})${SCALE}`,'g');
const RE_PCT=new RegExp(`(?:${NUM})\\s?(?:%|por\\s?ciento)`,'gi');
const RE_SCORE=/\b\d{1,2}\s?-\s?\d{1,2}\b/g;
const SPORT=/\b(gol|goles|partido|venci[óo]|vence|derrot|empat|gan[óo]|gana|cay[óo]|igual[óo]|marcador|selecci[óo]n|club|f[úu]tbol|torneo|liga|copa|campeonato|eliminatorias)/i;
const UNITS='votos|personas|muertos|fallecidos|heridos|damnificados|afectados|casos|contagios|soles|d[óo]lares|euros|kil[óo]metros|km|metros|toneladas|puntos|viviendas|familias|trabajadores|estudiantes|alumnos|pasajeros|veh[íi]culos|hect[áa]reas|grados|detenidos|polic[íi]as|efectivos|colegios|hospitales|empresas|vuelos|kilos';
const RE_QTY=new RegExp(`(?:${NUM})${SCALE}(?:\\sde)?\\s(?:${UNITS})(?:\\s(?:a\\sfavor|en\\scontra))?`,'gi');
const MONTHS='enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre';
// Lab.46: cifra con cualquier sustantivo (3 200 turistas, 3.200 computadoras), no solo los de UNITS. Sin años sueltos
// (2025), sin cifras de una sola cifra sin separador y sin palabras que no son sustantivos.
const RE_QTY_ANY=new RegExp(`(?:${NUM})${SCALE}(?:\\sde)?\\s(?:nuevos?\\s|nuevas?\\s)?[a-záéíóúñ]{4,}`,'g');
const QTY_STOP=/\s(?:para|contra|hasta|desde|durante|según|entre|sobre|cuando|donde|mientras|aunque|porque|también|años?|veces|horas?|minutos?|segundos?|días?|semanas?|meses|enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre|fueron|eran|están|son|habían|tienen)$/i;
const RE_DATE=new RegExp(`\\b\\d{1,2}\\sde\\s(?:${MONTHS})(?:\\sde(?:l)?\\s\\d{4})?`,'gi');
const NAMEW='[A-ZÁÉÍÓÚÑ][a-záéíóúüñ]+';
const NAME=`${NAMEW}(?:\\s(?:de\\s(?:la\\s|los\\s)?|del\\s)?${NAMEW}){1,3}`;
const ROLES='presidente|presidenta|ministro|ministra|viceministro|viceministra|alcalde|alcaldesa|congresista|gobernador|gobernadora|director|directora|gerente|jefe|jefa|vocero|vocera|portavoz|fiscal|juez|jueza|premier|secretario|secretaria|entrenador|t[ée]cnico|delantero|arquero|portero|volante|defensa|capit[áa]n|actor|actriz|cantante|decano|decana|rector|rectora|especialista|economista|analista|abogado|abogada|defensor|defensora|comandante|general|coronel|alcaldesa|embajador|embajadora|canciller|procurador|procuradora|investigador|investigadora|m[ée]dico|m[ée]dica|doctor|doctora';
const ROLE_PHRASE=`(?:${ROLES})(?:\\s(?:de|del|de\\sla|de\\slos|de\\slas|[a-záéíóúñ]+|${NAMEW})){0,5}`;
const RE_ROLE_NAME=new RegExp(`\\b(${ROLE_PHRASE}),?\\s(${NAME})`,'g');
const RE_NAME_ROLE=new RegExp(`(${NAME}),\\s(${ROLE_PHRASE})(?=[,.;:])`,'g');
const PLACE_KIND=['distrito','provincia','regi[óo]n','departamento','ciudad','localidad','centro\\spoblado','estadio','hospital','aeropuerto','plaza','puerto','playa','penal','mercado'].map(w=>`[${w[0]}${w[0].toUpperCase()}]${w.slice(1)}`).join('|');
const RE_PLACE=new RegExp(`\\b(${PLACE_KIND})\\s(?:de\\s(?:la\\s)?|del\\s)?(${NAMEW}(?:\\s(?:de\\s(?:la\\s|los\\s)?|del\\s)?${NAMEW}){0,3})`,'g');
const RE_ACR=new RegExp(`(${NAMEW}(?:\\s(?:de\\s(?:la\\s|los\\s)?|del\\s|y\\s|para\\sel\\s)?${NAMEW}){1,6})\\s\\(([A-ZÁÉÍÓÚÑ]{2,8})\\)`,'g');
const STOP_LEAD=/^(?:y|e|o|u|pero|que|pues|ya|además|asimismo|también)\s+/i;
const cap=s=>{s=String(s||'').trim();return s?s[0].toUpperCase()+s.slice(1):'';};
const words=(s,n,fromEnd=false)=>{const w=String(s||'').trim().split(/\s+/).filter(Boolean);return(fromEnd?w.slice(-n):w.slice(0,n)).join(' ');};
function labelAround(sentence,index,length){
  const after=sentence.slice(index+length),m=after.match(/^,\s*([^,.;:]{3,80})/);
  if(m&&m[1].trim().split(/\s+/).length<=8)return cap(m[1].trim());
  const before=sentence.slice(0,index),cut=Math.max(before.lastIndexOf(','),before.lastIndexOf(';'),before.lastIndexOf(':'));
  let lead=before.slice(cut+1).trim(),prev='';while(prev!==lead){prev=lead;lead=lead.replace(/\s+(?:de|en|a|con|por|para|del|al|y|el|la|los|las|desde|hasta|que)$/i,'').replace(STOP_LEAD,'');}
  lead=words(lead,6,true).replace(/^(?:de|del|en|a|al|y|e|o|con|por|para)\s+/i,'');
  return cap(lead);
}
const tidy=s=>String(s||'').replace(/\s+/g,' ').replace(/\s?por\s?ciento/i,' %').replace(/\b(\d{1,3}) mil (\d{1,3})\b/,(m,a,b)=>`${a} ${b.padStart(3,'0')}`).trim();
// candidatos de una oración: {type,big,label,index,length,cifra}
function factsInSentence(s){
  const out=[],taken=[];
  const free=(i,l)=>!taken.some(([a,b])=>i<b&&i+l>a);
  const add=(o,i,l)=>{if(!free(i,l))return;taken.push([i,i+l]);out.push({...o,index:i,length:l});};
  const each=(re,fn)=>{re.lastIndex=0;let m;while((m=re.exec(s)))fn(m);};
  each(RE_MONEY,m=>add({type:'cifra',big:tidy(m[0]),label:labelAround(s,m.index,m[0].length),cifra:true},m.index,m[0].length));
  each(RE_PCT,m=>add({type:'cifra',big:tidy(m[0]),label:labelAround(s,m.index,m[0].length),cifra:true},m.index,m[0].length));
  if(SPORT.test(s))each(RE_SCORE,m=>add({type:'marcador',big:tidy(m[0]).replace(/\s/g,''),label:labelAround(s,m.index,m[0].length),cifra:true},m.index,m[0].length));
  each(RE_QTY,m=>add({type:'cifra',big:tidy(m[0]),label:labelAround(s,m.index,m[0].length),cifra:true},m.index,m[0].length));
  each(RE_QTY_ANY,m=>{const num=m[0].match(/^[\d.,\s'’´]+(?:mil\s\d+)?/)[0].trim();if(QTY_STOP.test(m[0])||/^(?:19|20)\d{2}$/.test(num)||/^\d$/.test(num))return;add({type:'cifra',big:tidy(m[0]),label:labelAround(s,m.index,m[0].length),cifra:true},m.index,m[0].length);});
  each(RE_ROLE_NAME,m=>{const i=m.index+m[0].lastIndexOf(m[2]);add({type:'persona',big:m[2],label:cap(m[1])},i,m[2].length);});
  each(RE_NAME_ROLE,m=>add({type:'persona',big:m[1],label:cap(m[2])},m.index,m[1].length));
  each(RE_ACR,m=>{const i=m.index+m[0].lastIndexOf(m[2]);add({type:'institucion',big:m[2],label:m[1]},i,m[2].length);});
  each(RE_PLACE,m=>{const kind=m[1].toLowerCase(),big=/estadio|hospital|aeropuerto|plaza|mercado|penal|puerto|playa/.test(kind)?`${cap(m[1])} ${m[2]}`:m[2];add({type:'lugar',big,label:/estadio|hospital|aeropuerto|plaza|mercado|penal|puerto|playa/.test(kind)?'':cap(m[1])},m.index,m[0].length);});
  each(RE_DATE,m=>add({type:'fecha',big:m[0],label:labelAround(s,m.index,m[0].length)},m.index,m[0].length));
  return out.sort((a,b)=>a.index-b.index);
}
const key=x=>fold(x).replace(/[^a-z0-9]+/g,'');
// Elige hasta 4 datos (uno por oración, sin repetir) sobre las oraciones del guion; el principal es la cifra que también
// aparece en el titular o la bajada (o la primera cifra del guion).
function extractFacts({title='',summary='',sentences=[],firstScript=0,max=4}={}){
  const head=key(`${title} ${summary}`),cands=[];
  sentences.forEach((s,si)=>{if(si<firstScript)return;for(const c of factsInSentence(String(s.text||s)))cands.push({...c,si});});
  if(!cands.length)return[];
  const cifras=cands.filter(c=>c.cifra),hero=cifras.find(c=>head.includes(key(c.big)))||cifras[0]||null;
  const picked=[],seen=new Set(),used=new Set();
  const take=c=>{if(!c||picked.length>=max||used.has(c.si)||seen.has(key(c.big))||key(c.big).length<2)return;picked.push(c);used.add(c.si);seen.add(key(c.big));};
  take(hero);for(const c of [...cands].sort((a,b)=>a.si-b.si||(b.cifra?1:0)-(a.cifra?1:0)||a.index-b.index))take(c);
  return picked.map(c=>({type:c.type,big:c.big.slice(0,40),label:String(c.label||'').slice(0,60),si:c.si,frac:c.index/Math.max(1,String(sentences[c.si].text||sentences[c.si]).length),main:c===hero})).sort((a,b)=>a.si-b.si||a.frac-b.frac);
}
// segundo en que la voz nombra cada dato; mínimo 5,2 s entre uno y otro y cada uno ~4,4 s en pantalla
function timeFacts(facts,sentences,durationSec){
  const end=Math.max(0,Number(durationSec)||sentences[sentences.length-1]?.end||0);let prev=-99;const out=[];
  for(const f of facts){const s=sentences[f.si];if(!s)continue;let at=s.start+f.frac*Math.max(0,s.end-s.start)+.15;at=Math.max(at,prev+5.2);if(end&&at>end-1.2)continue;prev=at;out.push({...f,at:+at.toFixed(2),until:+Math.min(at+4.4,end||at+4.4).toFixed(2)});}
  return out;
}

// ---------------------------------------------------------------- ticker
const cleanTitle=t=>String(t||'').replace(/\s+/g,' ').trim().slice(0,140);
function tickerItems({automation=null,payload={},cfg=normalizeConfig()}={}){
  const t=cfg.ticker;if(!t.enabled)return[];
  const current=key(payload.title),heads=[],seen=new Set([current]);
  const push=(title,src,ex=false)=>{const k=key(title);if(!k||seen.has(k))return;seen.add(k);heads.push({t:cleanTitle(title),src,ex:!!ex});};
  if(t.queue&&automation)for(const it of(Array.isArray(automation.queue)?automation.queue:[])){
    if(it?.status!=='LISTA'||(payload.audioUrl&&it.audio?.url===payload.audioUrl))continue;
    push(it.result?.title||it.story?.title,'cola',it.isExclusive||it.result?.isExclusive);if(heads.length>=8)break;}
  if(t.rss&&automation){const rows=(Array.isArray(automation.cachedItems)?automation.cachedItems:[]).filter(x=>x&&x.title).slice()
      .sort((a,b)=>(Date.parse(b.pubDate||'')||0)-(Date.parse(a.pubDate||'')||0));
    let n=0;for(const r of rows){const before=heads.length;push(r.title,'rss');if(heads.length>before&&++n>=6)break;}}
  const msgs=t.messages;if(!heads.length)return msgs.map(x=>({t:x,src:'op',ex:false}));
  const out=[];let m=0;heads.forEach((h,i)=>{out.push(h);if(msgs.length&&(i+1)%t.every===0)out.push({t:msgs[m++%msgs.length],src:'op',ex:false});});
  if(msgs.length&&!m)out.push({t:msgs[0],src:'op',ex:false});
  return out;
}

// ---------------------------------------------------------------- plan de una noticia
function fileOf(url){try{return /^file:/i.test(String(url||''))?fileURLToPath(String(url).split('#')[0]):'';}catch{return'';}}
function buildMotion(payload={},{cfg=normalizeConfig(),automation=null,segmentsFor=null}={}){
  const script=String(payload.script||payload.summary||''),text=locutionText(payload.title,script),raw=sentencesOf(text);
  let segments=Array.isArray(payload.speechSegments)?payload.speechSegments:null;
  if(!segments&&segmentsFor){try{segments=segmentsFor(fileOf(payload.audioUrl));}catch{segments=null;}}
  const duration=Number(payload.audioDurationSec)||0,sentences=alignSentences(raw,segments,duration,payload.ttsScript);
  const firstScript=text===script?0:sentencesOf(payload.title).length;
  const facts=cfg.facts?timeFacts(extractFacts({title:payload.title,summary:payload.summary,sentences,firstScript}),sentences,duration):[];
  return{v:1,sentences,facts,ticker:tickerItems({automation,payload,cfg}),segments:Array.isArray(segments)?segments.slice(0,2000):null};
}

// ---------------------------------------------------------------- vista previa del panel (Lab.40)
// Tres noticias de ejemplo con la voz simulada (14 caracteres/s, 0,45 s entre oraciones) y el plan real de la salida.
const PREVIEW_STORIES=[
  {key:'deportes',category:'DEPORTES',isExclusive:false,title:'Perú vence 2-0 a Bolivia y sube al quinto lugar de las eliminatorias',summary:'Los goles de Andrés Salcedo y Marcos Quispe dan tres puntos clave a la selección, que ahora suma 14 en la tabla.',
   script:'Perú venció 2-0 a Bolivia en el Estadio Nacional y subió al quinto lugar de las eliminatorias. El primer gol llegó a los 20 minutos, con un cabezazo del delantero Andrés Salcedo. En el segundo tiempo, Marcos Quispe amplió la ventaja con un remate desde fuera del área. Con este resultado, la selección suma 14 puntos y queda en zona de repechaje. El próximo martes visitará a Ecuador en Quito.'},
  {key:'economia',category:'ECONOMÍA',isExclusive:false,title:'El dólar cierra en S/ 3,72 y baja por tercer día consecutivo',summary:'El tipo de cambio llegó a su nivel más bajo en cinco meses, impulsado por la entrada de capitales.',
   script:'El dólar cerró a la baja por tercer día consecutivo en el mercado cambiario local. Terminó la jornada en S/ 3,72, su nivel más bajo en cinco meses. Así lo informó el Banco Central de Reserva (BCR) al cierre de las operaciones. En lo que va de la semana, la moneda estadounidense acumula una caída de 1,2 %. Los analistas atribuyen la baja a la entrada de capitales y al alza del precio del cobre.'},
  {key:'exclusiva',category:'POLÍTICA',isExclusive:true,title:'Congreso aprueba en primera votación la reforma del sistema electoral',summary:'La propuesta obtuvo 78 votos a favor y necesita una segunda votación en la próxima legislatura.',
   script:'El Congreso aprobó en primera votación la reforma del sistema electoral. La propuesta obtuvo 78 votos a favor, 31 en contra y 9 abstenciones. La presidenta de la comisión, Rosa Medina, dijo que el cambio busca fortalecer a los partidos. Para entrar en vigencia, la reforma necesita una segunda votación el 15 de noviembre. Las bancadas de oposición anunciaron que presentarán observaciones.'}];
function previewStories(cfgRaw={},{automation=null}={}){
  const cfg=normalizeConfig(cfgRaw);
  return PREVIEW_STORIES.map(b=>{
    const sents=sentencesOf(locutionText(b.title,b.script)),segments=[];let t=.35;
    for(const x of sents){const d=Math.max(1.6,x.length/14);segments.push([+t.toFixed(3),+(t+d).toFixed(3)]);t+=d+.45;}
    const duration=+(t+.6).toFixed(3);
    const p={source:'preview',kind:'news',...b,pubDate:new Date().toISOString(),audioDurationSec:duration,speechSegments:segments};
    return{...p,motion:buildMotion(p,{cfg,automation})};
  });
}

// ---------------------------------------------------------------- instalación (main)
function profileId(dataDir){try{const {getProfileManager}=require('./profileManager0329');return String(getProfileManager(dataDir).activeId?.()||'default');}catch{return'default';}}
function readJson(f,fb){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return fb;}}
function writeJson(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});const t=`${f}.tmp-${process.pid}`;fs.writeFileSync(t,JSON.stringify(v,null,2),'utf8');fs.renameSync(t,f);}

function installNewsMotionLab37({api=globalThis.__gecScheduleApi,electron=null}={}){
  if(!api)return null;if(global.__gecNewsMotion)return global.__gecNewsMotion;
  const {ipcMain}=electron||require('electron');
  const file=()=>path.join(api.dataDir(),FILE);
  const readAll=()=>{const v=readJson(file(),{});return v&&typeof v==='object'&&v.profiles&&typeof v.profiles==='object'?v:{version:1,profiles:{}};};
  const config=()=>normalizeConfig(readAll().profiles[profileId(api.dataDir())]||{});
  const log=(k,m)=>{try{api.log?.(k,m);}catch{}};
  let segmentsFor=null;try{const {speechSegments}=require('./voiceArchiveLab36');segmentsFor=f=>{if(!f||!fs.existsSync(f))return null;const r=speechSegments(f);return r.segments.length?r.segments.map(x=>[+x[0].toFixed(3),+x[1].toFixed(3)]):null;};}catch{}
  // los tramos de voz van solo en p.motion: no se toca p.speechSegments (Merlín calcula los suyos)
  function enrich(payload){
    if(!payload||(payload.kind||'news')!=='news')return payload;
    const cfg=config();if(!cfg.enabled)return payload;
    try{const m=buildMotion(payload,{cfg,automation:api.automation?.(),segmentsFor});return{...payload,motion:m};}
    catch(e){log('NEWS_MOTION',e.message||e);return payload;}
  }
  const handle=(k,fn)=>{try{ipcMain.removeHandler(k);}catch{}ipcMain.handle(k,fn);};
  handle('newsMotion:get',()=>({ok:true,profile:profileId(api.dataDir()),config:config()}));
  handle('newsMotion:set',(_e,inc={})=>{
    const all=readAll(),id=profileId(api.dataDir()),cfg=normalizeConfig(inc);all.profiles[id]=cfg;
    try{writeJson(file(),all);}catch(e){return{ok:false,error:`No se pudo guardar: ${e.message||e}`};}
    try{global.__gecNewsMotionRefresh?.();}catch{}
    return{ok:true,profile:id,config:cfg};
  });
  // Lab.40: vista previa en la ventana del panel con la configuración que se está editando (sin guardar)
  handle('newsMotion:preview',(_e,draft)=>{try{return{ok:true,config:normalizeConfig(draft||config()),stories:previewStories(draft||config(),{automation:api.automation?.()})};}catch(e){return{ok:false,error:String(e.message||e)};}});
  global.__gecNewsMotion={config,enrich};
  return global.__gecNewsMotion;
}

module.exports={installNewsMotionLab37,normalizeConfig,alignSentences,locutionText,sentencesOf,factsInSentence,extractFacts,timeFacts,tickerItems,buildMotion,previewStories,DEFAULT};
