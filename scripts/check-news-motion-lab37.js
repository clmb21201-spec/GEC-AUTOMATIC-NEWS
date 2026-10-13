'use strict';
// Lab.37 · noticias con movimiento en la salida clásica: configuración por perfil, oraciones ancladas a la voz,
// datos clave sin IA, ticker, IPC y que todo quede conectado (main, bootstrap, preload, LAN, output-web).
const fs=require('fs');
const os=require('os');
const path=require('path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const nm=require('../src/services/newsMotionLab37');
let n=0;const ok=(c,m)=>{if(!c){console.error(`check-news-motion-lab37: ${m}`);process.exit(1);}n++;};

// ---- configuración
const d=nm.normalizeConfig({});
ok(d.enabled===true&&d.level==='normal'&&d.colors.mode==='auto'&&d.ticker.label==='ÚLTIMO'&&d.ticker.every===3,'valores por defecto');
const c=nm.normalizeConfig({enabled:false,level:'x',colors:{mode:'custom',bar1:'#ff0000',bar2:'rojo'},ticker:{every:99,label:'  ',messages:'uno\n\n dos \n'+'x'.repeat(300)}});
ok(c.enabled===false&&c.level==='normal','nivel inválido vuelve a normal');
ok(c.colors.mode==='custom'&&c.colors.bar1==='#FF0000'&&c.colors.bar2===d.colors.bar2,'colores: hex válidos, inválidos al valor por defecto');
ok(c.ticker.every===10&&c.ticker.label==='ÚLTIMO','ticker: cada N acotado y etiqueta vacía');
ok(c.ticker.messages.length===3&&c.ticker.messages[1]==='dos'&&c.ticker.messages[2].length===140,'mensajes: sin vacíos, recortados a 140');

// ---- oraciones ancladas a la voz
const txt=['Primera oración del titular.','Segunda oración más larga, con una coma en el medio.','Tercera y última.'];
const segs=[[0.2,2.0],[2.5,4.2],[4.5,7.8],[8.4,10.0]];
const al=nm.alignSentences(txt,segs,10.3);
ok(al.length===3&&al[0].cut===0&&al[0].start===0.2,'la primera oración empieza con la voz');
ok(al[1].cut>2&&al[1].cut<2.5&&al[1].start===2.5,'el corte cae a mitad de la pausa y la oración empieza con la voz');
ok(al[2].cut>7.8&&al[2].cut<8.4&&al[2].end===10,'la pausa larga separa la última oración');
const nos=nm.alignSentences(txt,null,30);
ok(nos[2].end===30&&nos[1].start>0,'sin tramos de voz reparte por largo sobre la duración');
ok(nm.locutionText('Titular','Titular. Guion.')==='Titular. Guion.'&&nm.locutionText('Titular','Guion.')==='Titular. Guion.','locución = titular + guion sin repetir');

// ---- datos clave sin IA
const f=s=>nm.factsInSentence(s).map(x=>`${x.type}|${x.big}|${x.label}`);
ok(f('El dólar terminó la jornada en S/ 3,72, su nivel más bajo en cinco meses.')[0]==='cifra|S/ 3,72|Su nivel más bajo en cinco meses','dinero con aposición');
ok(f('La moneda acumula una caída de 1,2 % en la semana.')[0]==='cifra|1,2 %|La moneda acumula una caída','porcentaje');
ok(f('La propuesta obtuvo 78 votos a favor, 31 en contra.')[0].startsWith('cifra|78 votos a favor'),'cantidad con unidad');
ok(f('Perú venció 2-0 a Bolivia en el Estadio Nacional.').join()==='marcador|2-0|Perú venció,lugar|Estadio Nacional|','marcador (solo con contexto deportivo) y estadio');
ok(!f('El expediente 12-24 fue archivado.').some(x=>x.startsWith('marcador')),'sin contexto deportivo no es marcador');
ok(f('La presidenta de la comisión, Rosa Medina, dijo que no.')[0]==='persona|Rosa Medina|Presidenta de la comisión','cargo, nombre');
ok(f('Juan Pérez, ministro de Economía, anunció el bono.').some(x=>x==='persona|Juan Pérez|Ministro de Economía'),'nombre, cargo');
ok(f('El ministro del Interior, Carlos Rojas, viajó.')[0]==='persona|Carlos Rojas|Ministro del Interior','cargo con mayúscula');
ok(f('Lo informó el Banco Central de Reserva del Perú (BCRP) ayer.')[0]==='institucion|BCRP|Banco Central de Reserva del Perú','sigla con su nombre');
ok(f('Ocurrió en el distrito de San Juan de Lurigancho el lunes.')[0]==='lugar|San Juan de Lurigancho|Distrito','lugar sin arrastrar palabras en minúscula');
ok(f('La audiencia será el 15 de noviembre.').some(x=>x.startsWith('fecha|15 de noviembre')),'fecha');
ok(f('No hay datos en esta oración.').length===0,'oración sin datos');
const sent=nm.alignSentences(['Dólar a la baja.','El dólar terminó en S/ 3,72, su nivel más bajo.','Lo dijo el ministro de Economía, Juan Pérez.','Subió 1,2 % en la semana.','El dólar terminó en S/ 3,72 otra vez.'],null,40);
const facts=nm.timeFacts(nm.extractFacts({title:'El dólar cierra en S/ 3,72',summary:'',sentences:sent,firstScript:1}),sent,40);
ok(facts.length===3&&facts[0].big==='S/ 3,72'&&facts[0].main===true,'el principal es la cifra del titular; sin repetir');
ok(facts.every((x,i)=>!i||x.at-facts[i-1].at>=5.2-1e-9)&&facts.every(x=>x.until>x.at),'mínimo 5,2 s entre datos');
ok(nm.extractFacts({title:'x',sentences:sent,firstScript:5}).length===0,'el titular no aporta datos');

// ---- ticker
const automation={queue:[{status:'AL AIRE',result:{title:'Al aire'},audio:{url:'a'}},{status:'LISTA',result:{title:'En cola uno'},audio:{url:'b'}},{status:'LISTA',isExclusive:true,result:{title:'Exclusiva en cola'},audio:{url:'c'}},{status:'PROCESANDO',result:{title:'Procesando'}}],
  cachedItems:[{title:'RSS viejo',pubDate:'2020-01-01'},{title:'RSS nuevo',pubDate:new Date().toISOString()},{title:'En cola uno'}]};
const cfg=nm.normalizeConfig({ticker:{every:2,messages:['Síguenos']}});
const tk=nm.tickerItems({automation,payload:{title:'Al aire',audioUrl:'a'},cfg});
ok(tk.map(x=>x.src+':'+x.t).join('|')==='cola:En cola uno|cola:Exclusiva en cola|op:Síguenos|rss:RSS nuevo|rss:RSS viejo|op:Síguenos','ticker: cola, RSS más nuevos primero, sin repetir ni la nota al aire, mensaje cada 2');
ok(tk[1].ex===true&&!tk[0].ex,'ticker: marca exclusivas');
ok(nm.tickerItems({automation:{queue:[],cachedItems:[]},payload:{},cfg}).map(x=>x.t).join()==='Síguenos','sin titulares quedan los mensajes');
ok(nm.tickerItems({automation,payload:{},cfg:nm.normalizeConfig({ticker:{enabled:false}})}).length===0,'ticker apagado');

// ---- plan completo
const mo=nm.buildMotion({kind:'news',title:'El dólar cierra en S/ 3,72',summary:'Baja',script:'El dólar terminó en S/ 3,72, su nivel más bajo. Lo dijo el ministro de Economía, Juan Pérez.',audioDurationSec:12,speechSegments:[[0.1,2],[2.4,7],[7.5,11.6]]},{cfg:nm.normalizeConfig({}),automation});
ok(mo.sentences.length===3&&mo.facts.length===2&&mo.facts[0].main&&mo.ticker.length>0&&Array.isArray(mo.segments),'buildMotion arma oraciones, datos y ticker');
ok(nm.buildMotion({title:'T',script:'Guion con 50 % de algo.',audioDurationSec:5},{cfg:nm.normalizeConfig({facts:false})}).facts.length===0,'datos clave apagados');

// ---- instalación: IPC por perfil y enrich
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gec-nm-'));const handlers={};
global.__gecNewsMotion=null;let refreshed=0;global.__gecNewsMotionRefresh=()=>refreshed++;
const inst=nm.installNewsMotionLab37({api:{dataDir:()=>tmp,automation:()=>automation,log:()=>{}},electron:{ipcMain:{removeHandler(){},handle:(k,fn)=>handlers[k]=fn}}});
ok(inst&&handlers['newsMotion:get']&&handlers['newsMotion:set'],'IPC newsMotion:get|set');
const saved=handlers['newsMotion:set']({}, {level:'dinamico',ticker:{messages:['Hola']}});
ok(saved.ok&&saved.config.level==='dinamico'&&refreshed===1,'guardar refresca el diseño de la salida');
const all=JSON.parse(fs.readFileSync(path.join(tmp,'news-motion.json'),'utf8'));
ok(all.profiles&&Object.values(all.profiles)[0].level==='dinamico','se guarda por perfil');
ok(handlers['newsMotion:get']().config.ticker.messages[0]==='Hola','get devuelve lo guardado');
const en=inst.enrich({kind:'news',title:'Al aire',script:'Uno. Dos.',audioDurationSec:6});
ok(en.motion&&en.motion.sentences.length===3&&en.speechSegments===undefined,'enrich agrega p.motion a las noticias (sin tocar speechSegments de Merlín)');
ok(inst.enrich({kind:'canned',videoUrl:'x'}).motion===undefined&&inst.enrich({kind:'host'}).motion===undefined,'enrich no toca contenidos ni intervenciones');
handlers['newsMotion:set']({}, {enabled:false});
ok(inst.enrich({kind:'news',title:'x',script:'y.'}).motion===undefined,'apagado: la noticia sale como siempre');
fs.rmSync(tmp,{recursive:true,force:true});global.__gecNewsMotion=null;

// ---- conexiones
const main=read('src/main.js'),boot=read('src/bootstrap-v2lab.js'),pre=read('src/preload.js'),lan=read('src/services/outputLanServer.js'),web=read('src/output-web.html');
ok(/typeof enrichDesign===.function.&&typeof deliverToOutput===.function.\)\{const __origEnrichMotion=enrichDesign;/.test(main)&&/enrichDesign=function\(raw=\{\}\)\{const d=__origEnrichMotion\(raw\);/.test(main)&&/__gecNewsMotion\.enrich\(payload\)/.test(main)&&/__gecNewsMotionRefresh=\(\)=>sendDesignLive\(\)/.test(main),'main.js: diseño con newsMotion, payload con motion y refresco');
ok(main.lastIndexOf('__origDeliverMotion')>main.lastIndexOf('__origDeliverLoudness'),'main.js: el envoltorio de Lab.37 es el último (corre antes que Merlín)');
ok(/installVoiceArchiveLab36\(\);\s*require\('\.\/services\/newsMotionLab37'\)\.installNewsMotionLab37\(\);/.test(boot),'bootstrap instala Lab.37 al final');
ok(pre.includes("injectAsset('script',{src:'output-news-motion-lab37.js'})")&&pre.includes("href:'output-news-motion-lab37.css'"),'preload inyecta la salida con movimiento en output.html');
ok(pre.includes("newsMotionGet:()=>invoke('newsMotion:get')")&&pre.includes("injectAsset('script',{src:'renderer-news-motion-lab37.js'})"),'preload: API y panel');
ok(/'schedule:state'\]\);/.test(pre),'preload: schedule:state sigue al final de allowedEvents');
ok(lan.includes("'output-news-motion-lab37.css','output-news-motion-lab37.js'")&&web.includes('<script src="output-news-motion-lab37.js"></script>')&&web.includes('href="output-news-motion-lab37.css"'),'salida en red local (OBS) con movimiento');
ok(web.indexOf('output-news-motion-lab37.js')>web.indexOf('output-0331.js'),'output-web: se carga después de 0331');
const out=read('src/output-news-motion-lab37.js');
ok(/window\.__ecOutput0326&&?|!window\.__ecOutput0326/.test(out)&&out.includes("ECAPI.on('output:story'")&&out.includes('setStoryContent=async function')&&out.includes('revealStoryFromStory=async function'),'salida: se monta sobre setStoryContent y revealStoryFromStory');
ok(!/outputPlayback/.test(out),'salida: no emite ended/error (lo sigue haciendo output.js)');
ok(!read('src/output.html').includes('news-motion')&&!read('src/output.js').includes('nmLayer'),'no se modifica la salida clásica original');
console.log(`check-news-motion-lab37 OK (${n} verificaciones)`);
