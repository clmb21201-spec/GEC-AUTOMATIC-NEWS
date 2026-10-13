'use strict';
// Lab.39 · Efectos de sonido de las transiciones (woosh, golpe grave, impacto con brillo, clic), generados con Web Audio:
// sin archivos de audio ni derechos de terceros. Lo usan la salida clásica (output-sfx-lab39.js) y el panel (botones
// «Probar»). La configuración es la de Noticias con movimiento del perfil (design.newsMotion.sfx):
// {enabled, style: suave|normal|marcado, volume 0–100, events: {sting, plane, dato, ex, card, host}}.
// Reglas: el cambio de plano suena solo con barrido y no en los 2 s siguientes a un golpe de marca; un mismo tipo de
// efecto no se repite antes de 3 s; efectos de tipos distintos sí pueden sonar juntos.
(function(){
  if (window.GECSfx) return;
  const STY = {suave: {g: .8, dur: .85, top: 1900, sub: false}, normal: {g: 1, dur: 1, top: 2800, sub: true}, marcado: {g: 1.3, dur: 1.15, top: 3600, sub: true}};
  const SPACED = new Set(['plane', 'dato', 'card']);

  function create(opts = {}){
    let ctx = null, dest = null, bus = null, rev = null, noise = null, cfg = {};
    const last = {};
    function init(){
      if (bus) return true;
      try {
        const o = typeof opts === 'function' ? opts() || {} : opts;
        ctx = o.context || null; dest = o.dest || null;
        if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return false; ctx = new A(); }
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -8; comp.ratio.value = 6; comp.attack.value = .003; comp.release.value = .15;
        comp.connect(dest || ctx.destination);
        const out = ctx.createGain(); out.connect(comp); bus = ctx.createGain(); bus.connect(out);
        const len = Math.floor(ctx.sampleRate * 1.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
        rev = ctx.createConvolver(); rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = .28; rev.connect(rg); rg.connect(bus);
        const nl = ctx.sampleRate * 3; noise = ctx.createBuffer(1, nl, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
        return true;
      } catch { bus = null; return false; }
    }
    const volume = () => { const v = Math.max(0, Math.min(100, Number(cfg.volume ?? 45))) / 100; return v * v * 1.6; };
    const E = (g, a, peak, att, dec) => { g.gain.setValueAtTime(.0001, a); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), a + att); g.gain.exponentialRampToValueAtTime(.0001, a + att + dec); };
    const send = (node, wet = true) => { node.connect(bus); if (wet) node.connect(rev); };
    function woosh(at, {dur = .5, f0 = 260, f1 = 2800, f2 = 420, g = .9, q = 1.1, pan = .75, dir = 1} = {}){
      const s = ctx.createBufferSource(); s.buffer = noise; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; const pk = at + dur * .45;
      bp.frequency.setValueAtTime(f0, at); bp.frequency.exponentialRampToValueAtTime(f1, pk); bp.frequency.exponentialRampToValueAtTime(f2, at + dur);
      const env = ctx.createGain(); env.gain.setValueAtTime(.0001, at); env.gain.exponentialRampToValueAtTime(g, pk); env.gain.exponentialRampToValueAtTime(.0001, at + dur);
      const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-pan * dir, at); p.pan.linearRampToValueAtTime(pan * dir, at + dur);
      s.connect(bp); bp.connect(env); env.connect(p); send(p); s.start(at, Math.random() * 2); s.stop(at + dur + .05);
    }
    function boom(at, {g = .8, f0 = 150, f1 = 42, d = .55} = {}){
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + d * .7);
      const e = ctx.createGain(); E(e, at, g * .55, .006, d); o.connect(e); send(e, false); o.start(at); o.stop(at + d + .1);
      const s = ctx.createBufferSource(); s.buffer = noise; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const ce = ctx.createGain(); E(ce, at, g * .35, .002, .05); s.connect(lp); lp.connect(ce); send(ce); s.start(at, Math.random()); s.stop(at + .1);
    }
    function shimmer(at, {g = .18, d = 1.3} = {}){
      [1568, 2093, 2637, 3136, 4186].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = i % 2 ? 7 : -7;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200; const e = ctx.createGain(); E(e, at + i * .018, g / (1 + i * .4), .01, d - i * .12);
        o.connect(hp); hp.connect(e); send(e); o.start(at + i * .018); o.stop(at + d + .2);
      });
    }
    function pop(at, {g = .22} = {}){
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1250, at); o.frequency.exponentialRampToValueAtTime(720, at + .07);
      const e = ctx.createGain(); E(e, at, g, .004, .09); o.connect(e); send(e); o.start(at); o.stop(at + .15);
    }
    function sound(k, o = {}){
      const S = STY[cfg.style] || STY.normal, a = ctx.currentTime + .02 + Math.max(0, Number(o.delay) || 0);
      bus.gain.setValueAtTime(volume(), ctx.currentTime);
      if (k === 'sting') { woosh(a, {dur: .95 * S.dur, f0: 200, f1: S.top, f2: 380, g: 1.05 * S.g, q: .9}); woosh(a + .06, {dur: .8 * S.dur, f0: 500, f1: S.top * 1.5, f2: 900, g: .4 * S.g, q: 2.2, dir: -1}); if (S.sub) boom(a + .17, {g: .55 * S.g, f0: 120, f1: 40, d: .6}); }
      else if (k === 'ex') { boom(a, {g: .95 * S.g, f0: 170, f1: 38, d: .8}); shimmer(a, {g: .2 * S.g}); }
      else if (k === 'plane') woosh(a, {dur: .5 * S.dur, f0: 320, f1: S.top, f2: 520, g: 1 * S.g, q: 1.3});
      else if (k === 'dato') { woosh(a, {dur: .32 * S.dur, f0: 400, f1: S.top, f2: 700, g: .45 * S.g, q: 1.4}); boom(a + .12, {g: .8 * S.g, f0: 140, f1: 45, d: .5}); }
      else if (k === 'card') pop(a, {g: .18 * S.g});
      else if (k === 'host') { woosh(a, {dur: .9 * S.dur, f0: 180, f1: S.top * .8, f2: 300, g: .8 * S.g, q: .8, pan: .4}); if (S.sub) boom(a + .3, {g: .4 * S.g, f0: 110, f1: 40, d: .7}); }
      else return false;
      return true;
    }
    function ready(){ if (!init()) return false; if (ctx.state !== 'running') ctx.resume().catch(() => {}); return true; }
    // Efecto de la emisión: respeta la configuración del perfil y las reglas de separación.
    function play(k, o = {}){
      if (!cfg || cfg.enabled === false || (cfg.events || {})[k] !== true) return false;
      if (k === 'plane' && o.wipe === false) return false;
      const now = performance.now() / 1000;
      if (k === 'plane' && now - (last.sting ?? -99) < 2) return false;
      if (SPACED.has(k) && now - (last[k] ?? -99) < 3) return false;
      if (!ready()) return false;
      last[k] = now; return sound(k, o);
    }
    // Botón «Probar» del panel: suena siempre, con el estilo y el volumen elegidos.
    function test(k, o = {}){ if (!ready()) return false; return sound(k, o); }
    return {play, test, setConfig(c){ cfg = c && typeof c === 'object' ? c : {}; }, get context(){ return ctx; }};
  }
  window.GECSfx = {create, styles: Object.keys(STY)};
})();
