'use strict';
// Lab.30 · Merlín: NDI solo en la vista clásica. Con el modo Merlín activo, la tarjeta NDI queda deshabilitada
// (el aviso lo pone main en el estado NDI: merlinBlocked + error) y se vuelve a habilitar al pasar a clásica.
(function installMerlinNdiLock(){
  if (window.__gecMerlinNdiLock) return; window.__gecMerlinNdiLock = true;
  const api = window.ECAPI;
  if (!api || typeof api.outputNdiStatus !== 'function') return;
  let blocked = false;
  function apply(){
    for (const id of ['ecNdiEnabled', 'ecNdiApply', 'ecNdiName', 'ecNdiFps', 'ecNdiAudio']) {
      const el = document.getElementById(id); if (!el) continue;
      el.disabled = blocked;
      el.title = blocked ? 'NDI solo está disponible en la vista clásica. Cambia el Modo de salida a "Clásica" para usarlo.' : '';
    }
  }
  function update(st){ if (!st) return; blocked = !!st.merlinBlocked; apply(); }
  api.on('output:ndiState', update);
  const refresh = () => api.outputNdiStatus().then(update).catch(() => {});
  // la tarjeta NDI y el selector de modo se construyen después; se reaplica cuando aparecen o cambia el modo
  new MutationObserver(() => { if (document.getElementById('ecNdiEnabled')) apply(); }).observe(document.documentElement, {childList: true, subtree: true});
  document.addEventListener('change', e => { if (e.target && e.target.id === 'presenterMode') setTimeout(refresh, 1500); }, true);
  setTimeout(refresh, 1500);
})();
