'use strict';
// Lab.51 · más correcciones de lectura (cadena completa: Lab.45 → Lab.46/51 → Lab.32 → básica → 0328 → 0326) y fondo
// detrás del texto de Noticias con movimiento (medición de la foto, configuración, panel y salida).
const path=require('path'),fs=require('fs'),assert=require('assert');
const src=path.join(__dirname,'..','src'),svc=path.join(src,'services');
const M=require(path.join(svc,'moneySpeechLab45')),N=require(path.join(svc,'speechNumbersLab46')),D=require(path.join(svc,'documentCodesSpeechLab32'));
const {normalizeSpeech,validateSpeech}=require(path.join(svc,'speechNormalizer0326'));
const {structuralPreNormalize}=require(path.join(svc,'speechRules0328'));
const {PronunciationNormalizer}=require(path.join(svc,'pronunciation'));
let checks=0;const eq=(a,b,m)=>{checks++;assert.strictEqual(a,b,m);},ok=(v,m)=>{checks++;assert.ok(v,m);};
const pn=Object.create(PronunciationNormalizer.prototype);
const spoken=x=>{const a=D.speakForTts(N.speakNumbers(M.speakMoney(x).text).text,{}).text,b=pn.basic(a),pre=structuralPreNormalize(b,{rules:[]}).text,n=normalizeSpeech(pre,{enabled:true}).text;return validateSpeech(b,n).ok?n:pre;};
const cases=[
  // «uno» delante de un sustantivo masculino: antes «setenta y uno años»
  ['Tenía 71 años.','Tenía setenta y un años.'],
  ['Hay 21 heridos y 1 muerto.','Hay veintiún heridos y un muerto.'],
  ['Un total de 31 detenidos.','Un total de treinta y un detenidos.'],
  ['Hay 1 año de plazo.','Hay un año de plazo.'],
  ['101 muertos y 1001 soldados.','ciento un muertos y mil un soldados.'],
  ['21 mil soles y 31 mil personas.','veintiún mil soles y treinta y un mil personas.'],
  ['41 personas y 21 familias','cuarenta y una personas y veintiuna familias'],
  ['El puesto 71 de la lista.','El puesto setenta y uno de la lista.'],
  ['Sólo 1 de cada 10 peruanos.','Sólo uno de cada diez peruanos.'],
  ['Quedó 2 a 1.','Quedó dos a uno.'],
  // abreviaturas de cargos y direcciones
  ['El Gral. PNP Ruiz y el Cmdte. Soto.','El general pe ene pe Ruiz y el comandante Soto.'],
  ['El Crnl. Díaz, el Tte. Rojas y el Sgto. Vega.','El coronel Díaz, el teniente Rojas y el sargento Vega.'],
  ['La Ing. Salas y el Ing. Ruiz.','La ingeniera Salas y el ingeniero Ruiz.'],
  ['Gral. Ruiz llegó.','General Ruiz llegó.'],
  ['Urb. Los Olivos Mz. A Lt. 5.','Urbanización Los Olivos manzana A lote cinco.'],
  ['El Dr. Pérez y la Sra. García.','El doctor Pérez y la señora García.'],
  // hora con «las»: antes «a las veinte a cero» en notas de deportes
  ['El partido es a las 20:00.','El partido es a las veinte horas.'],
  ['El partido de Alianza es a las 20:00 horas.','El partido de Alianza es a las veinte horas.'],
  ['El clásico será a las 15:30.','El clásico será a las quince horas con treinta minutos.'],
  ['A las 9:00 a. m.','A las nueve de la mañana.'],
  ['Ganó 2-1 a Alianza Lima.','Ganó dos a uno a Alianza Lima.'],
  // teléfonos: antes la cifra quedaba escrita y además se leía, o «unode»
  ['Celular 987 654 321.','Celular nueve ocho siete, seis cinco cuatro, tres dos uno.'],
  ['El celular 987654321 de contacto.','El celular nueve ocho siete, seis cinco cuatro, tres dos uno de contacto.'],
  ['Llame al 01 311 5930.','Llame al cero uno, tres uno uno, cinco nueve tres cero.'],
  ['DNI 45678912.','de ene i cuatro cinco seis siete ocho nueve uno dos.'],
  // tipo de cambio con 3 decimales: antes «tres mil setecientos cuarenta y cinco soles»
  ['El tipo de cambio cerró en S/ 3.745 por dólar.','El tipo de cambio cerró en tres punto siete cuatro cinco soles por dólar.'],
  ['El dólar cerró en S/ 3,745.','El dólar cerró en tres punto siete cuatro cinco soles.'],
  ['Pagó S/ 3.745 en multas.','Pagó tres mil setecientos cuarenta y cinco soles en multas.'],
  // tecnología: antes «cinco gramos»
  ['La red 5G y el 4G.','La red cinco ge y el cuatro ge.'],
  ['El G7 y el G20 se reunieron.','El ge siete y el ge veinte se reunieron.'],
  ['Promoción 2x1 y camioneta 4x4.','Promoción dos por uno y camioneta cuatro por cuatro.'],
  // códigos con guion: antes «dos mil veintiséismenos uno»
  ['El código 2026-001 del caso.','El código dos mil veintiséis, uno del caso.'],
  ['El periodo 2021-2026.','El periodo dos mil veintiuno a dos mil veintiséis.'],
  ['Entre 100-200 soles.','Entre cien y doscientos soles.'],
  ['N° 000081-2026-PE-ONP','número ochenta y uno, dos mil veintiséis, pe e, o ene pe'],
  ['El 13-10-2026 se votó.','El trece de octubre de dos mil veintiséis se votó.'],
  // decimales con coma y estatura
  ['El PBI creció 3,2 % en el trimestre.','El pe be i creció tres punto dos por ciento en el trimestre.'],
  ['Sismo de magnitud 5,8.','Sismo de magnitud cinco punto ocho.'],
  ['Mide 1,75 m y pesa 80 kg.','Mide un metro setenta y cinco y pesa ochenta kilogramos.'],
  ['Mide 1.80 metros.','Mide un metro ochenta.'],
  ['La lista 1, 2 y 3.','La lista uno, dos y tres.'],
  ['Robo de 18 000 soles','Robo de dieciocho mil soles'],
];
for(const [inp,out] of cases)eq(spoken(inp),out,inp);

// ---- fondo detrás del texto
const B=require(path.join(svc,'backdropLumaLab51'));
const bitmap=(w,h,fn)=>{const b=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const [r,g,bb]=fn(x,y),i=(y*w+x)*4;b[i]=bb;b[i+1]=g;b[i+2]=r;b[i+3]=255;}return b;};
const yellow=B.lumaFromBitmap(bitmap(20,10,()=>[245,224,0]),20,10);
ok(yellow.all>.8&&yellow.left>.8,'foto amarilla: muy clara');
const half=B.lumaFromBitmap(bitmap(20,10,x=>x<10?[255,255,255]:[0,0,0]),20,10);
ok(half.left>.85&&half.all>.45&&half.all<.55,'mitad izquierda blanca: la zona del texto es clara');
eq(B.lumaFromBitmap(null,0,0),null,'sin imagen: null');
(async()=>{
  const r=await B.measure('ftp://x',{nativeImage:null});eq(r,null,'dirección no soportada: null');
  const NM=require(path.join(svc,'newsMotionLab37'));
  eq(JSON.stringify(NM.normalizeConfig({}).backdrop),JSON.stringify({mode:'auto',level:50}),'por defecto: automático, normal');
  eq(JSON.stringify(NM.normalizeConfig({backdrop:{mode:'manual',level:140}}).backdrop),JSON.stringify({mode:'manual',level:100}),'manual con tope 100');
  const out=fs.readFileSync(path.join(src,'output-news-motion-lab37.js'),'utf8'),css=fs.readFileSync(path.join(src,'output-news-motion-lab37.css'),'utf8');
  ok(/Lab\.51 · Fondo detrás del texto/.test(out)&&/ECAPI\.imageLuma/.test(out)&&/--nm-bright/.test(out),'la salida mide la foto y oscurece lo justo');
  ok(/brightness\(var\(--nm-bright/.test(css)&&/--nm-extra/.test(css),'CSS: brillo y sombra según la foto');
  const pre=fs.readFileSync(path.join(src,'preload.js'),'utf8');ok(/imageLuma:url=>invoke\('output:imageLuma',url\)/.test(pre),'preload expone imageLuma a la salida');
  const rd=fs.readFileSync(path.join(src,'renderer-news-motion-lab37.js'),'utf8');ok(/Fondo detrás del texto/.test(rd)&&/next\.backdrop/.test(rd)&&/gecNmBdLevel/.test(rd),'panel: automático / manual y ajuste');
  const boot=fs.readFileSync(path.join(src,'bootstrap-v2lab.js'),'utf8');ok(/backdropLumaLab51'\)\.installBackdropLumaLab51\(\)/.test(boot),'bootstrap instala la medición');
  const n46=fs.readFileSync(path.join(svc,'speechNumbersLab46.js'),'utf8');ok(/speechFixesLab51/.test(n46),'Lab.46 usa las correcciones de Lab.51');
  console.log(`check-speech-lab51 OK (${checks} verificaciones) · masculinos · abreviaturas · teléfonos · horas · códigos · tipo de cambio · fondo`);
})().catch(e=>{console.error('check-speech-lab51: '+(e.stack||e.message));process.exit(1);});
