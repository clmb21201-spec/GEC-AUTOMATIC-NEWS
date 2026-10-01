'use strict';
// Selector del modo de salida: clásico (placa de EC1) o Merlín (presentador 3D en el set).
// Lab29 reconstruye la pestaña Emisión (renderer-emission-design-v2.js) y oculta la vista previa antigua,
// así que la tarjeta se ubica junto a la vista previa nueva (#ecEmissionV2PreviewCard) y se reubica si la interfaz cambia.
(function installMerlinMode(){
  if (window.__merlinModeInstalled) return; window.__merlinModeInstalled = true;
  const api = window.ECAPI;
  let card = null, sel = null, note = null, started = Date.now();
  function build(){
    card = document.createElement('div');
    card.id = 'merlinPresenterCard'; card.className = 'card top-gap';
    card.innerHTML = '<div class="section-head"><div><h3>Modo de salida</h3><p class="note">Presentador</p></div><span class="mini-pill">MERLÍN</span></div>'
      + '<label>Salida<select id="presenterMode"><option value="clasico">Clásica (imagen con titular y bajada)</option><option value="merlin">Merlín en el set (presentador 3D)</option></select></label>'
      + '<p class="note" id="presenterModeNote">Merlín usa el mismo audio, imagen, titular y bajada de cada noticia. Al cambiar el modo, la ventana de salida se recarga.</p>';
    sel = card.querySelector('#presenterMode'); note = card.querySelector('#presenterModeNote');
    api.presenterGet().then(r => { sel.value = (r && r.mode) === 'merlin' ? 'merlin' : 'clasico'; }).catch(() => {});
    sel.addEventListener('change', async () => {
      sel.disabled = true;
      try { const r = await api.presenterSet(sel.value); note.textContent = r && r.reopened ? 'Listo: la ventana de salida se recargó con el nuevo modo.' : 'Listo: el modo se usará la próxima vez que abras la salida.'; }
      catch (e) { note.textContent = 'No se pudo cambiar el modo: ' + (e && e.message || e); }
      finally { sel.disabled = false; }
    });
  }
  const visible = el => !!el && !el.closest('.ec-v2-legacy-hidden') && getComputedStyle(el).display !== 'none';
  function anchor(){
    const v2 = document.getElementById('ecEmissionV2PreviewCard');
    if (v2) return v2;
    // sin el diseño v2 (o mientras se construye) se espera unos segundos antes de usar la vista previa clásica
    if (Date.now() - started < 8000) return null;
    const old = document.querySelector('#tab-emission .preview-card') || document.querySelector('.preview-card');
    return visible(old) ? old : null;
  }
  function place(){
    if (!api || typeof api.presenterGet !== 'function') return;
    const a = anchor(); if (!a) return;
    if (!card) build();
    if (card.previousElementSibling !== a || !card.isConnected) a.insertAdjacentElement('afterend', card);
  }
  const timer = setInterval(() => { place(); if (card && card.isConnected && Date.now() - started > 15000) clearInterval(timer); }, 500);
  new MutationObserver(() => { if (card && (!card.isConnected || card.previousElementSibling !== anchor())) place(); })
    .observe(document.documentElement, {childList:true, subtree:true});
})();
