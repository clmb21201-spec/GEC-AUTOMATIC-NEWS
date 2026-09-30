'use strict';
// Selector del modo de salida: clásico (placa de EC1) o Merlín (presentador 3D en el set).
(function installMerlinMode(){
  const api = window.ECAPI;
  const anchor = document.querySelector('.preview-card');
  if (!anchor || !api || typeof api.presenterGet !== 'function') { setTimeout(installMerlinMode, 400); return; }
  if (document.getElementById('merlinPresenterCard')) return;
  const card = document.createElement('div');
  card.id = 'merlinPresenterCard'; card.className = 'card';
  card.innerHTML = '<div class="section-head"><h3>Modo de salida</h3><span class="mini-pill">PRESENTADOR</span></div>'
    + '<div class="form-grid"><label>Salida<select id="presenterMode"><option value="clasico">Clásica (imagen con titular y bajada)</option><option value="merlin">Merlín en el set (presentador 3D)</option></select></label></div>'
    + '<p class="note" id="presenterModeNote">Merlín usa el mismo audio, imagen, titular y bajada de cada noticia. Al cambiar el modo, la ventana de salida se reinicia.</p>';
  anchor.parentNode.insertBefore(card, anchor);
  const sel = card.querySelector('#presenterMode'), note = card.querySelector('#presenterModeNote');
  api.presenterGet().then(r => { sel.value = (r && r.mode) === 'merlin' ? 'merlin' : 'clasico'; }).catch(() => {});
  sel.addEventListener('change', async () => {
    sel.disabled = true;
    try { const r = await api.presenterSet(sel.value); note.textContent = r && r.reopened ? 'Listo: la ventana de salida se reinició con el nuevo modo.' : 'Listo: el modo se usará la próxima vez que abras la salida.'; }
    catch (e) { note.textContent = 'No se pudo cambiar el modo: ' + (e && e.message || e); }
    finally { sel.disabled = false; }
  });
})();
