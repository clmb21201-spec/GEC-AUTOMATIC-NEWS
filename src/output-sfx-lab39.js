'use strict';
// Lab.39 · Sonidos de transición en la salida clásica (output.html, output-web.html para OBS y la ventana de NDI).
// Las noticias con movimiento (output-news-motion-lab37.js) y las intervenciones (output-classic-host-lab38.js) llaman a
// window.__gecSfx.play(tipo, opciones); la configuración llega en design.newsMotion.sfx. En la ventana de NDI el sonido
// se suma a la mezcla que se envía por NDI (window.__GEC_NDI_AUDIO__ de output-ndi-audio.js) en vez de a los parlantes.
(function installOutputSfxLab39(){
  if (!window.GECSfx) { setTimeout(installOutputSfxLab39, 80); return; }
  if (window.__gecSfx) return;
  const engine = window.GECSfx.create(() => { const n = window.__GEC_NDI_AUDIO__; return n && n.ctx && n.mix ? {context: n.ctx, dest: n.mix} : {}; });
  const cfg = () => { try { return (typeof design !== 'undefined' && design && design.newsMotion && design.newsMotion.sfx) || {}; } catch { return {}; } };
  let paused = false;
  // Lab.54: solo la pausa calla los efectos. Antes «stop» (detener la emisión, despedida, una pieza que falla) también
  // los callaba y nunca llegaba un «play» después: el resto de la sesión no sonaba nada, ni en OUTPUT ni en OBS.
  // Cada pieza nueva (noticia, contenido, intervención) los vuelve a habilitar.
  try { window.ECAPI?.on?.('output:control', a => { paused = a === 'pause'; }); } catch {}
  try { window.ECAPI?.on?.('output:story', () => { paused = false; }); } catch {}
  window.__gecSfx = {
    play(k, o){ if (paused) return false; engine.setConfig(cfg()); return engine.play(k, o || {}); },
    get context(){ return engine.context; }
  };
})();
