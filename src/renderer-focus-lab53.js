'use strict';
// Lab.53 · Si haces clic en una casilla del panel y la página no tiene el teclado (lo tenía la ventana OUTPUT u otra),
// se le pide al proceso principal que lo devuelva y se vuelve a enfocar la casilla. Así se puede escribir durante la
// emisión aunque la salida haya quedado activa. Ver services/controlFocusLab53.js.
(function installControlFocusLab53(){
  if (window.__gecControlFocusLab53) return; window.__gecControlFocusLab53 = true;
  const api = window.ECAPI;
  const typing = el => el && (el.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|button|submit|range|color|file)$/i.test(el.type || '')));
  let busy = false;
  document.addEventListener('pointerdown', e => {
    const el = e.target?.closest?.('input,textarea,select,[contenteditable="true"]');
    if (!typing(el) || document.hasFocus() || busy || typeof api?.focusControl !== 'function') return;
    busy = true;
    Promise.resolve(api.focusControl()).catch(() => {}).finally(() => {
      busy = false;
      const back = () => { try { if (el.isConnected && document.activeElement !== el) el.focus({preventScroll: true}); } catch {} };
      requestAnimationFrame(back); setTimeout(back, 80);
    });
  }, true);
})();
