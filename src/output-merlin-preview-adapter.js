'use strict';
// Vista previa de Merlín en el área de Diseño: reemplaza a window.ECAPI dentro del iframe.
// El panel (renderer-merlin-preview-lab30.js) envía por postMessage el diseño guardado y una nota de ejemplo.
// La vista previa es muda: sin música, sin video de espera y sin voz; no reporta nada a la automatización.
(function(){
  const listeners = {};
  let design = {};
  const emit = (ch, p) => (listeners[ch] || []).forEach(fn => { try { fn(p); } catch (e) { console.error('[merlin-preview]', e); } });
  const mute = d => ({...(d || {}), musicEnabled: false, musicUrl: '', standbyVideoUrl: '', voiceVolume: 0, cannedVolume: 0});
  window.ECAPI = {
    on: (ch, fn) => { (listeners[ch] = listeners[ch] || []).push(fn); },
    getSettings: async () => ({visual: {output: design}}),
    outputPlayback: () => {},
    presenterHostPlayback: () => {}
  };
  window.addEventListener('message', ev => {
    const m = ev.data || {};
    if (m.type !== 'gec-merlin-preview') return;
    if (m.design) { design = mute(m.design); emit('output:design', design); }
    if (m.story) emit('output:story', {...m.story, kind: 'news', audioUrl: '', design});
  });
  // avisa al panel cuando la escena 3D quedó lista (si WebGL o el modelo fallan, el panel vuelve a la vista clásica)
  const t0 = Date.now();
  (function waitReady(){
    if (window.__merlinOutput) { parent.postMessage({type: 'gec-merlin-preview-ready'}, '*'); return; }
    if (Date.now() - t0 < 15000) setTimeout(waitReady, 250);
  })();
  parent.postMessage({type: 'gec-merlin-preview-loading'}, '*');
})();
