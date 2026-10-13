'use strict';
// Lab.44 · Botón «Optimización rápida» junto a «Optimizar EC para esta computadora». Pide al proceso principal el modo
// rápido (optimization:setMode 'quick') y lanza la misma optimización; al terminar vuelve al modo completo.
// Debajo, una nota con la meta de RTF (0,65): las variantes de voz que faltan no se miden si ya se alcanzó.
(function installOptimizationQuickLab44(){
  if (window.__gecOptimizationQuickLab44) return; window.__gecOptimizationQuickLab44 = true;
  const api = window.ECAPI;
  if (!api || typeof api.optimizationSetMode !== 'function') return;
  const $ = s => document.querySelector(s);
  let running = false;

  function render(){
    const main = $('#optimizeEc0321'); if (!main || $('#gecOptimizeQuick44')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'gecOptimizeQuick44'; b.className = 'dark';
    b.textContent = 'Optimización rápida'; b.style.marginTop = '8px'; b.style.display = 'block';
    b.title = 'Menos repeticiones y solo las configuraciones que suelen ganar. Tarda bastante menos que la completa.';
    main.insertAdjacentElement('afterend', b);
    const note = document.createElement('p'); note.id = 'gecOptimizeQuickNote44'; note.className = 'note'; note.style.margin = '6px 0 0';
    note.textContent = 'Meta de voz: RTF 0,65. Si una configuración ya la alcanza de forma estable, no se prueban las demás.';
    b.insertAdjacentElement('afterend', note);
    b.addEventListener('click', start);
    // también en la completa: mientras corre, el botón rápido se desactiva
    new MutationObserver(sync).observe(main, {attributes: true, attributeFilter: ['disabled']});
  }
  function sync(){
    const main = $('#optimizeEc0321'), b = $('#gecOptimizeQuick44'); if (!main || !b) return;
    b.disabled = main.disabled;
    if (running && !main.disabled) { running = false; api.optimizationSetMode('full').catch(() => {}); b.textContent = 'Optimización rápida'; }
  }
  async function start(){
    const main = $('#optimizeEc0321'); if (!main || main.disabled || running) return;
    try { await api.optimizationSetMode('quick'); } catch { return; }
    running = true; $('#gecOptimizeQuick44').textContent = 'Optimización rápida en curso…';
    main.click();
    // si el panel no llegó a iniciar (por ejemplo, la emisión está corriendo), vuelve al modo completo
    setTimeout(() => { if (running && !main.disabled) sync(); }, 400);
  }
  new MutationObserver(render).observe(document.documentElement, {childList: true, subtree: true});
  render();
})();
