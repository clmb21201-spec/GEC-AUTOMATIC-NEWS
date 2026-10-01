'use strict';
// Lab.30 · Vista previa de Merlín en el área de Diseño. Con el modo Merlín (y formato 16:9) la vista previa de emisión
// muestra la salida real de Merlín (output-merlin-preview.html, muda) con el diseño guardado y la nota de ejemplo.
// Solo se carga mientras la vista previa está en pantalla, para no ocupar la GPU; si el 3D falla, queda la clásica.
(function installMerlinDesignPreview(){
  if (window.__gecMerlinDesignPreview) return; window.__gecMerlinDesignPreview = true;
  const api = window.ECAPI;
  if (!api || typeof api.presenterGet !== 'function') return;
  let mode = 'clasico', visible = false, frame = null, badge = null, ready = false, loads = 0, failed = false, lastDesign = '', lastStory = '', pollTimer = null, readyTimer = null, io = null, classObs = null, observed = null;
  const stage = () => document.getElementById('ecV2PreviewStage');
  const text = id => String(document.getElementById(id)?.textContent || '').trim();
  const isWide = st => !!st && !st.classList.contains('format-9-16');

  function sampleStory(){
    return {title: text('ecV2PreviewTitle') || 'Titular de ejemplo para visualizar el diseño', summary: text('ecV2PreviewSummary'),
      category: text('ecV2PreviewCat') || 'ACTUALIDAD', pubDate: new Date().toISOString(), isExclusive: false, image: ''};
  }
  function post(msg){ try { frame?.contentWindow?.postMessage({type: 'gec-merlin-preview', ...msg}, '*'); } catch {} }
  async function pushDesign(force){
    if (!frame || !ready) return;
    let d = {}; try { const s = await api.getSettings(); d = (s && s.visual && s.visual.output) || {}; } catch {}
    const key = JSON.stringify(d);
    if (force || key !== lastDesign) { lastDesign = key; post({design: d}); }
    const story = sampleStory(), sk = JSON.stringify(story);
    if (force || sk !== lastStory) { lastStory = sk; post({story}); }
  }

  function remove(){
    clearInterval(pollTimer); pollTimer = null; clearTimeout(readyTimer); readyTimer = null;
    frame?.remove(); badge?.remove(); frame = null; badge = null; ready = false; loads = 0; lastDesign = ''; lastStory = '';
  }
  function fallback(reason){
    failed = true; remove();
    const st = stage(); if (!st) return;
    badge = document.createElement('div'); badge.className = 'note';
    badge.style.cssText = 'position:absolute;left:8px;top:8px;z-index:7;background:rgba(0,0,0,.7);padding:4px 8px;border-radius:4px;font-size:12px';
    badge.textContent = `Vista previa 3D de Merlín no disponible (${reason}); se muestra la clásica.`;
    st.appendChild(badge);
  }
  function create(){
    const st = stage(); if (!st || frame) return;
    frame = document.createElement('iframe');
    frame.src = 'output-merlin-preview.html'; frame.title = 'Vista previa de Merlín'; frame.setAttribute('aria-label', 'Vista previa de Merlín');
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:6;pointer-events:none;background:#000';
    frame.addEventListener('load', () => { if (++loads > 1) fallback('la salida 3D volvió a la clásica'); });
    st.appendChild(frame);
    badge = document.createElement('div'); badge.className = 'note';
    badge.style.cssText = 'position:absolute;right:8px;top:8px;z-index:7;background:rgba(0,0,0,.65);padding:3px 8px;border-radius:4px;font-size:12px;pointer-events:none';
    badge.textContent = 'Merlín · diseño guardado';
    st.appendChild(badge);
    readyTimer = setTimeout(() => { if (!ready) fallback('WebGL o el modelo no cargaron'); }, 20000);
  }
  function sync(){
    const st = stage();
    if (st && st !== observed) { io?.disconnect(); classObs?.disconnect(); observed = st; io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); sync(); }); io.observe(st); classObs = new MutationObserver(() => sync()); classObs.observe(st, {attributes: true, attributeFilter: ['class']}); }
    const want = mode === 'merlin' && visible && isWide(st) && !failed;
    if (want && !frame) create();
    else if (!want && frame) remove();
    if (!want && badge && !frame && mode !== 'merlin') { badge.remove(); badge = null; }
  }
  async function refreshMode(){
    try { const r = await api.presenterGet(); const next = r && r.mode === 'merlin' ? 'merlin' : 'clasico'; if (next !== mode) { mode = next; failed = false; remove(); } } catch {}
    sync();
  }

  window.addEventListener('message', ev => {
    if (!frame || ev.source !== frame.contentWindow) return;
    const t = ev.data && ev.data.type;
    if (t === 'gec-merlin-preview-ready') {
      ready = true; clearTimeout(readyTimer); pushDesign(true);
      clearInterval(pollTimer); pollTimer = setInterval(() => pushDesign(false), 3000);
    }
  });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'presenterMode') setTimeout(refreshMode, 800); }, true);
  // la pestaña Emisión (lab29) reconstruye la vista previa: se vuelve a enganchar cuando cambia
  new MutationObserver(() => { const st = stage(); if (st !== observed || (frame && !frame.isConnected)) { if (frame && !frame.isConnected) remove(); sync(); } })
    .observe(document.documentElement, {childList: true, subtree: true});
  refreshMode();
})();
