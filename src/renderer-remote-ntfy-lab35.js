'use strict';
// Lab.35 · Tarjeta "Control desde el celular (ntfy)" en la pestaña Salida, debajo de OBS / YouTube.
// El operador instala la app ntfy, se suscribe al tema que muestra la tarjeta y recibe avisos con botones:
// pausar / reanudar, siguiente, detener la preparación y cortar la transmisión.
(function installRemoteNtfyLab35(){
  if (window.__gecRemoteNtfyLab35) return; window.__gecRemoteNtfyLab35 = true;
  const api = window.ECAPI;
  if (!api || typeof api.remoteGet !== 'function') return;
  const $ = s => document.querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const CMD = {pause: 'pausar', resume: 'reanudar', next: 'siguiente', 'prep-stop': 'detener preparación', 'obs-stop': 'cortar transmisión', status: 'estado', menu: 'botones', more: 'más opciones'};
  let info = null;

  const css = document.createElement('style');
  css.textContent = `
  #gecRemoteCard .gec-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
  #gecRemoteCard label{display:block;color:#b5b5b5;margin:0 0 5px}
  #gecRemoteCard .gec-topic{display:flex;gap:6px}#gecRemoteCard .gec-topic input{flex:1;min-width:0;font-family:monospace}
  #gecRemoteCard details{margin-top:10px;border:1px solid #303030;border-radius:10px;padding:8px 12px;background:#121212}
  #gecRemoteCard summary{cursor:pointer;font-weight:700;color:#ddd;font-size:13px}
  #gecRemoteCard .gec-check{display:flex;gap:8px;align-items:center;margin-top:10px;color:#ddd;font-size:13px}
  #gecRemoteCard .gec-live{margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:#101010;border:1px solid #303030;border-radius:10px;padding:10px 12px;font-size:13px}`;
  document.head.appendChild(css);

  function render(){
    const obs = $('#gecObsCard'), anchor = obs || $('#ecNdiOutputCard'); if (!anchor) return;
    let card = $('#gecRemoteCard');
    if (!card) {
      card = document.createElement('div'); card.id = 'gecRemoteCard'; card.className = anchor.className; card.style.marginTop = '16px';
      card.innerHTML = `<div class="section-head"><h3>Control desde el celular (ntfy)</h3><span id="gecRemotePill" class="status-pill neutral">DESACTIVADO</span></div>
        <p class="note">Instala la app <b>ntfy</b> en el celular y suscríbete al tema de abajo. Te llegan avisos con botones para pausar, pasar a la siguiente, detener la preparación y cortar la transmisión. También puedes escribir órdenes con el PIN, por ejemplo «pausar 1234».</p>
        <div class="gec-row2">
          <div><label for="gecRemoteTopic">Tema (suscríbete a este en la app)</label><div class="gec-topic"><input id="gecRemoteTopic" readonly><button type="button" class="dark compact" id="gecRemoteCopy">Copiar</button></div></div>
          <div><label for="gecRemotePin">PIN para órdenes escritas</label><input id="gecRemotePin" type="password" autocomplete="off" placeholder="4 a 12 letras o números"></div>
        </div>
        <label class="gec-check"><input type="checkbox" id="gecRemoteOn"> Activar el control desde el celular</label>
        <details><summary>Avanzado</summary>
          <div class="gec-row2"><div><label for="gecRemoteServer">Servidor ntfy</label><input id="gecRemoteServer" value="https://ntfy.sh"></div><div><label for="gecRemoteToken">Token de acceso (opcional)</label><input id="gecRemoteToken" type="password" autocomplete="off"></div></div>
          <label class="gec-check"><input type="checkbox" id="gecRemoteNotify" checked> Enviar los botones cuando empieza o termina la emisión</label>
          <div class="buttons"><button type="button" class="dark compact" id="gecRemoteNew">Generar tema nuevo</button></div>
          <p class="note">Generar un tema nuevo invalida los botones anteriores: en el celular hay que suscribirse al tema nuevo.</p>
        </details>
        <div class="buttons"><button type="button" class="dark compact" id="gecRemoteSave">Guardar</button><button type="button" class="compact" id="gecRemoteTest">Enviar botones al celular</button></div>
        <div class="gec-live"><span>Conexión: <b id="gecRemoteConn">—</b></span><span class="note" id="gecRemoteLast"></span></div>`;
      anchor.insertAdjacentElement('afterend', card);
      card.addEventListener('click', onClick);
      load();
    }
    if (card.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', card);
    paint();
  }
  function paint(){
    if (!info || !$('#gecRemoteCard')) return;
    const st = info.state || {}, pill = $('#gecRemotePill');
    if (!info.enabled) { pill.className = 'status-pill neutral'; pill.textContent = 'DESACTIVADO'; }
    else if (st.connected) { pill.className = 'status-pill ok'; pill.textContent = 'CONECTADO ✓'; }
    else { pill.className = 'status-pill error'; pill.textContent = 'SIN CONEXIÓN'; pill.title = st.error || ''; }
    $('#gecRemoteConn').textContent = !info.enabled ? 'desactivado' : st.connected ? `escuchando en ${info.server.replace(/^https?:\/\//, '')}` : (st.error || 'conectando…');
    $('#gecRemoteLast').textContent = st.lastCommand ? `Última orden: ${CMD[st.lastCommand] || st.lastCommand} · ${new Date(st.lastAt).toLocaleTimeString('es-PE', {hour: 'numeric', minute: '2-digit'})}` : '';
  }
  function fill(){
    if (!info) return;
    $('#gecRemoteTopic').value = info.topic || '';
    $('#gecRemoteServer').value = info.server || 'https://ntfy.sh';
    $('#gecRemoteOn').checked = !!info.enabled; $('#gecRemoteNotify').checked = info.notifyStart !== false;
    $('#gecRemotePin').placeholder = info.hasPin ? '•••• (guardado)' : '4 a 12 letras o números';
    $('#gecRemoteToken').placeholder = info.hasToken ? '•••••••• (guardado)' : 'solo con cuenta o servidor propio';
    paint();
  }
  const load = () => api.remoteGet().then(r => { info = r; fill(); }).catch(() => {});
  async function onClick(e){
    const t = e.target; if (!t.id || !/^gecRemote(Save|Test|Copy|New)$/.test(t.id)) return;
    if (t.id === 'gecRemoteCopy') {
      const text = `${($('#gecRemoteServer').value || 'https://ntfy.sh').replace(/\/+$/, '')}/${$('#gecRemoteTopic').value}`;
      try { await navigator.clipboard.writeText(text); t.textContent = 'Copiado ✓'; setTimeout(() => { t.textContent = 'Copiar'; }, 1500); } catch { prompt('Copia el tema:', text); }
      return;
    }
    if (t.id === 'gecRemoteNew' && !confirm('¿Generar un tema nuevo? En el celular tendrás que suscribirte al nuevo tema.')) return;
    t.disabled = true;
    try {
      let r;
      if (t.id === 'gecRemoteNew') r = await api.remoteNewTopic();
      else {
        const pin = $('#gecRemotePin').value.trim(), token = $('#gecRemoteToken').value.trim();
        r = await api.remoteSet({enabled: $('#gecRemoteOn').checked, server: $('#gecRemoteServer').value.trim(), topic: $('#gecRemoteTopic').value.trim(), pin, token, notifyStart: $('#gecRemoteNotify').checked});
        if (r && r.ok === false) { alert(r.error || 'No se pudo guardar.'); return; }
        $('#gecRemotePin').value = ''; $('#gecRemoteToken').value = '';
        if (t.id === 'gecRemoteTest') {
          if (!$('#gecRemoteOn').checked) { alert('Activa primero el control desde el celular.'); info = r; fill(); return; }
          r = await api.remoteTest();
          if (r && r.ok === false) alert(`No se pudo enviar: ${r.error || 'sin respuesta de ntfy'}`);
        }
      }
      if (r) { info = r; fill(); }
    } finally { t.disabled = false; }
  }

  api.on('remote:state', s => { if (info) { info.state = s; paint(); } });
  new MutationObserver(() => { const anchor = $('#gecObsCard') || $('#ecNdiOutputCard'), card = $('#gecRemoteCard');
    if (anchor && (!card || card.previousElementSibling !== anchor)) render(); })
    .observe(document.documentElement, {childList: true, subtree: true});
  setTimeout(render, 1500);
})();
