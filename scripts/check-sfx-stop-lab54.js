'use strict';
// Lab.54 · los efectos de transición se callaban para siempre después de un «stop» (detener la emisión, despedida,
// una pieza que falla): nunca llegaba un «play». Ahora solo la pausa los calla y cada pieza nueva los habilita.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
let checks=0;const eq=(a,b,m)=>{checks++;assert.strictEqual(a,b,m);};
const code=fs.readFileSync(path.join(__dirname,'..','src','output-sfx-lab39.js'),'utf8');
const L={},played=[];
const window={GECSfx:{create:()=>({setConfig(){},play:k=>{played.push(k);return true;},context:null})},ECAPI:{on:(c,cb)=>{(L[c]=L[c]||[]).push(cb);return()=>{};}}};
const emit=(c,p)=>(L[c]||[]).forEach(f=>f(p));
vm.runInNewContext(code,{window,setTimeout,design:{newsMotion:{sfx:{enabled:true}}}});
const sfx=window.__gecSfx;
eq(sfx.play('sting'),true,'al empezar suena');
emit('output:control','stop');
emit('output:story',{kind:'news'});
eq(sfx.play('sting'),true,'después de un stop, la noticia siguiente suena (antes quedaba callado para siempre)');
emit('output:control','stop');eq(sfx.play('plane'),true,'un stop solo no calla los efectos');
emit('output:control','pause');eq(sfx.play('plane'),false,'en pausa no suena');
emit('output:control','play');eq(sfx.play('plane'),true,'al reanudar vuelve a sonar');
emit('output:control','pause');emit('output:story',{kind:'canned'});eq(sfx.play('host'),true,'una pieza nueva lo habilita');
eq(played.join(','),'sting,sting,plane,plane,host','el motor recibe solo los permitidos');
console.log(`check-sfx-stop-lab54 OK (${checks} verificaciones) · efectos después de detener la emisión`);
