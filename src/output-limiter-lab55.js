'use strict';
// Lab.55 · Limitador final de la salida clásica (output.html y output-web.html para OBS).
// Síntoma: a veces el audio «reventaba» un instante. La voz de las noticias llega casi al máximo (picos de ~99 %), la
// música y el contenido suenan aparte, y los efectos de transición por Web Audio: ninguno sabe cuánto suenan los otros
// y la suma podía pasar del 100 % y recortarse. Además, el canal de los efectos se abría recién con el primer efecto,
// a mitad de una noticia.
// Ahora, al cargar la salida, se abre un solo AudioContext; cada <audio>/<video> (voz, música, contenidos, video de
// espera) y los efectos pasan por una mezcla común con un limitador (umbral -3 dB, relación 20:1, ataque 1 ms) y un
// recorte suave final, de modo que la suma nunca pase del máximo. Si el AudioContext no llega a estar activo, los
// elementos no se conectan (siguen sonando como antes, sin limitador): así nunca se queda la salida sin voz.
// La ventana de NDI tiene su propia mezcla (output-ndi-audio.js), que también lleva el limitador.
(function installOutputLimiterLab55(){
  if (window.__gecMaster || new URLSearchParams(location.search).get('ndi') === '1') return;
  const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
  let ctx; try { ctx = new A({latencyHint: 'playback'}); } catch { try { ctx = new A(); } catch { return; } }
  const input = ctx.createGain();
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .12;
  // recorte suave por encima de ~-1 dB (por si un pico se adelanta al limitador)
  const clip = ctx.createWaveShaper(), n = 2048, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x), t = .89; curve[i] = a <= t ? x : Math.sign(x) * (t + (1 - t) * Math.tanh((a - t) / (1 - t))); }
  clip.curve = curve; clip.oversample = '2x';
  input.connect(lim); lim.connect(clip); clip.connect(ctx.destination);
  const attached = new WeakSet(), pending = new Set();
  let running = false;
  function attach(el){
    if (!el || attached.has(el)) return;
    if (!running) { pending.add(el); return; }
    attached.add(el); pending.delete(el);
    try { ctx.createMediaElementSource(el).connect(input); } catch {}
  }
  const scan = root => { if (root?.matches?.('audio,video')) attach(root); root?.querySelectorAll?.('audio,video').forEach(attach); };
  function resume(){
    if (ctx.state !== 'running') { ctx.resume().catch(() => {}); return; }
    if (!running) { running = true; for (const el of [...pending]) attach(el); }
  }
  ctx.onstatechange = resume;
  scan(document);
  new MutationObserver(rs => { for (const r of rs) for (const nd of r.addedNodes) if (nd.nodeType === 1) scan(nd); }).observe(document.documentElement, {childList: true, subtree: true});
  resume(); setInterval(resume, 1000);
  window.__gecMaster = {ctx, input, limiter: lim, get running(){ return running; }, attachedCount: () => [...document.querySelectorAll('audio,video')].filter(e => attached.has(e)).length};
})();
