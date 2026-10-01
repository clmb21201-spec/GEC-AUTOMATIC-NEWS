'use strict';
// Lab.30 · Optimización: botón para cancelar, tiempo transcurrido en vivo, tiempo restante estimado de la fase actual
// y aviso cuando una medición no reporta progreso (medición por etapas, reinicio del motor).
(function installOptimizationLab30(){
  if (window.__gecOptimizationLab30) return; window.__gecOptimizationLab30 = true;
  const api = window.ECAPI;
  if (!api || typeof api.optimizationCancel !== 'function') return;
  const $ = s => document.querySelector(s);
  let panel = null, timer = null, startedAt = 0, lastEventAt = 0, phase = null, cancelling = false;
  const local = {i: 1, n: 5, c: 0};
  const fmt = sec => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m ? `${m}:${String(s).padStart(2, '0')} min` : `${s} s`; };

  function ensurePanel(){
    const box = $('#ecOptimizeResult0321'); if (!box) return null;
    if (panel && panel.isConnected) return panel;
    panel = document.createElement('div'); panel.id = 'gecOptimizeLive30'; panel.className = 'note';
    panel.style.cssText = 'display:none;margin-top:8px;align-items:center;gap:12px;flex-wrap:wrap';
    panel.innerHTML = '<span id="gecOptimizeLiveText30"></span><button id="gecOptimizeCancel30" type="button">Cancelar optimización</button>';
    box.insertAdjacentElement('afterend', panel);
    panel.querySelector('#gecOptimizeCancel30').addEventListener('click', async () => {
      if (cancelling) return;
      if (!window.confirm('¿Cancelar la optimización? Se perderá lo medido hasta ahora y el perfil actual no cambia.')) return;
      cancelling = true; const b = panel.querySelector('#gecOptimizeCancel30'); b.disabled = true; b.textContent = 'Cancelando…';
      try { await api.optimizationCancel(); } catch {}
    });
    return panel;
  }

  // fracción completada de la fase actual a partir de los eventos de progreso
  function track(kind, e){
    const p = String(e && e.phase || ''); lastEventAt = Date.now();
    let key = '', frac = null;
    if (kind === 'voice') {
      if (p === 'candidate' || p === 'measure') { key = 'voz · configuraciones'; const i = Number(e.index) || 1, n = Number(e.total) || 1, r = Number(e.repeatIndex) || 0, rt = Number(e.repeatTotal) || 3; frac = ((i - 1) + (p === 'measure' ? r / (rt + 2) : 0)) / n; }
      else if (p === 'batch' || p === 'batch-run') { key = 'voz · lotes'; const i = Number(e.index) || 1, n = Number(e.total) || 1, r = Number(e.repeatIndex) || 0, rt = Number(e.repeatTotal) || 2; frac = ((i - 1) + (p === 'batch-run' ? r / (rt + 2) : 0)) / n; }
      // Lab.31: aceleración del predictor y notas realistas
      else if (p === 'lab31-graphs' || p === 'lab31-note') { key = p === 'lab31-graphs' ? 'voz · aceleración del predictor' : 'voz · notas realistas'; const i = Number(e.index) || 1, n = Number(e.total) || 1; frac = (i - 1) / n; }
    } else if (kind === 'local') {
      if (p === 'candidate') { local.i = Number(e.index) || 1; local.n = Number(e.total) || 5; local.c = 0; key = 'IA de texto'; }
      else if (p === 'warmup') { local.c = 0; key = 'IA de texto'; }
      else if (p === 'case') { local.c = Number(e.index) || 0; key = 'IA de texto'; }
      else if (p === 'overlap') key = 'validación voz + texto';
      if (key === 'IA de texto') frac = ((local.i - 1) + local.c / 4) / local.n;
    }
    if (!key) return;
    if (!phase || phase.key !== key) phase = {key, startedAt: Date.now()};
    phase.frac = frac;
  }

  function render(){
    const box = $('#ecOptimizeResult0321');
    if (!box || box.dataset.live !== '1') { stop(); return; }
    const p = ensurePanel(); if (!p) return;
    p.style.display = 'flex';
    const now = Date.now(), parts = [`Transcurrido ${fmt((now - startedAt) / 1000)}`];
    if (phase && phase.frac > 0.05 && phase.frac < 1) {
      const el = (now - phase.startedAt) / 1000, left = el * (1 - phase.frac) / phase.frac;
      parts.push(`${phase.key}: ~${fmt(left)} restantes`);
    }
    const quiet = (now - (lastEventAt || startedAt)) / 1000;
    if (quiet > 25 && !cancelling) parts.push(`sin novedades hace ${fmt(quiet)}: está midiendo por etapas o reiniciando el motor, sigue trabajando`);
    if (cancelling) parts.push('cancelando: deteniendo los motores…');
    p.querySelector('#gecOptimizeLiveText30').textContent = parts.join(' · ');
  }

  function start(){
    startedAt = Date.now(); lastEventAt = 0; phase = null; cancelling = false; local.i = 1; local.n = 5; local.c = 0;
    const p = ensurePanel(); if (p) { const b = p.querySelector('#gecOptimizeCancel30'); b.disabled = false; b.textContent = 'Cancelar optimización'; }
    clearInterval(timer); timer = setInterval(render, 1000); render();
  }
  function stop(){
    if (!timer) return;
    clearInterval(timer); timer = null;
    if (panel) panel.style.display = 'none';
    try { api.optimizationCancelReset(); } catch {}
    cancelling = false; phase = null;
  }

  api.on('tts-lab:event', e => { if (timer && String(e && e.type || '') === 'tts-lab-benchmark') track('voice', e); });
  api.on('local:event', e => { if (timer && String(e && e.type || '').startsWith('local-ai-benchmark')) track('local', e); });

  // el botón de la tarjeta (renderer-0321) arranca la optimización; si de verdad empezó, marca el resumen como "live"
  document.addEventListener('click', ev => {
    const b = ev.target && ev.target.closest && ev.target.closest('#optimizeEc0321'); if (!b || b.disabled) return;
    try { api.optimizationCancelReset(); } catch {}
    setTimeout(() => { const box = $('#ecOptimizeResult0321'); if (box && box.dataset.live === '1') start(); }, 60);
  }, true);
})();
