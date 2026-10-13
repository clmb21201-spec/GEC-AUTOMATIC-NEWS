'use strict';
// Lab.36 · Tarjeta "Guardar audios de voz para edición" en la pestaña Audio y locución, debajo de la tarjeta de Voz: por cada noticia
// emitida se guarda el WAV de la voz (sin música), un .txt con el guion y la locución y un .srt sincronizado.
(function installVoiceArchiveLab36(){
  if (window.__gecVoiceArchiveLab36) return; window.__gecVoiceArchiveLab36 = true;
  const api = window.ECAPI;
  if (!api || typeof api.voiceArchiveGet !== 'function') return;
  const $ = s => document.querySelector(s);
  let info = null;

  const css = document.createElement('style');
  css.textContent = `
  #gecVoiceArchiveCard .gec-folder{display:flex;gap:6px;margin-top:10px}#gecVoiceArchiveCard .gec-folder input{flex:1;min-width:0}
  #gecVoiceArchiveCard .gec-check{display:flex;flex-direction:row;justify-content:flex-start;gap:8px;align-items:center;margin-top:10px;color:#ddd;font-size:13px}
  #gecVoiceArchiveCard .gec-check input{width:16px;height:16px;flex:0 0 16px;margin:0;padding:0}
  #gecVoiceArchiveCard .gec-days{display:flex;gap:8px;align-items:center;margin-top:10px;color:#ddd;font-size:13px}#gecVoiceArchiveCard .gec-days select{width:auto}`;
  document.head.appendChild(css);

  // La tarjeta de Voz es .card (Ajustes) o .ec27-card (pestaña Audio de Lab.29, donde vive hoy el selector #voice).
  function anchor(){ const v = $('#voice'); return v ? v.closest('.ec27-card, .card') : null; }
  function render(){
    const a = anchor(); if (!a) return;
    let card = $('#gecVoiceArchiveCard');
    if (!card) {
      card = document.createElement('div'); card.id = 'gecVoiceArchiveCard';
      if (a.classList.contains('ec27-card')) card.className = 'ec27-card'; else { card.className = 'card'; card.style.marginTop = '16px'; }
      card.innerHTML = `<div class="section-head"><h3>Guardar audios de voz para edición</h3><span id="gecVaPill" class="status-pill neutral">DESACTIVADO</span></div>
        <p class="note">Por cada noticia que sale al aire (salida clásica o Merlín) se guarda el audio de la voz sin música (.wav), el texto con el guion y lo que leyó la voz (.txt) y los subtítulos sincronizados (.srt). Una carpeta por día.</p>
        <label class="gec-check"><input type="checkbox" id="gecVaOn"> Guardar los audios de las noticias emitidas</label>
        <div class="gec-folder"><input id="gecVaFolder" readonly><button type="button" class="dark compact" id="gecVaPick">Elegir…</button><button type="button" class="dark compact" id="gecVaOpen">Abrir carpeta</button></div>
        <label class="gec-check"><input type="checkbox" id="gecVaSrt" checked> Crear subtítulos .srt</label>
        <div class="gec-days">Borrar lo que tenga más de <select id="gecVaDays"><option value="7">7 días</option><option value="15">15 días</option><option value="30">30 días</option><option value="90">90 días</option><option value="0">nunca</option></select></div>
        <div class="buttons"><button type="button" class="dark compact" id="gecVaSave">Guardar</button><span class="note" id="gecVaLast" style="align-self:center"></span></div>`;
      a.insertAdjacentElement('afterend', card);
      card.addEventListener('click', onClick);
      api.voiceArchiveGet().then(r => { info = r; fill(); }).catch(() => {});
    }
    if (card.previousElementSibling !== a) a.insertAdjacentElement('afterend', card);
  }
  function fill(){
    if (!info || !$('#gecVaOn')) return;
    $('#gecVaOn').checked = !!info.enabled; $('#gecVaFolder').value = info.folder || ''; $('#gecVaSrt').checked = info.srt !== false;
    const d = String(info.keepDays ?? 30), sel = $('#gecVaDays');
    if (![...sel.options].some(o => o.value === d)) sel.insertAdjacentHTML('beforeend', `<option value="${Number(d) || 0}">${Number(d) || 0} días</option>`);
    sel.value = d; paint();
  }
  function paint(){
    if (!info || !$('#gecVaPill')) return;
    const pill = $('#gecVaPill'), st = info.state || {};
    if (st.error) { pill.className = 'status-pill error'; pill.textContent = 'ERROR'; pill.title = st.error; }
    else if (info.enabled) { pill.className = 'status-pill ok'; pill.textContent = 'ACTIVO'; pill.title = ''; }
    else { pill.className = 'status-pill neutral'; pill.textContent = 'DESACTIVADO'; pill.title = ''; }
    $('#gecVaLast').textContent = st.error ? `Error: ${st.error}` : st.last ? `Último: ${st.last.file}` : '';
  }
  async function onClick(e){
    const t = e.target; if (!t.id || !/^gecVa(Pick|Open|Save)$/.test(t.id)) return;
    if (t.id === 'gecVaOpen') { const r = await api.voiceArchiveOpen(); if (r && r.ok === false) alert(r.error || 'No se pudo abrir la carpeta.'); return; }
    if (t.id === 'gecVaPick') { const r = await api.voiceArchivePick(); if (r && r.ok && r.folder) $('#gecVaFolder').value = r.folder; return; }
    t.disabled = true;
    try {
      const r = await api.voiceArchiveSet({enabled: $('#gecVaOn').checked, folder: $('#gecVaFolder').value, srt: $('#gecVaSrt').checked, keepDays: Number($('#gecVaDays').value) || 0});
      if (r && r.ok === false) { alert(r.error || 'No se pudo guardar.'); return; }
      info = r; fill();
    } finally { t.disabled = false; }
  }
  api.on('voiceArchive:state', s => { if (info) { info.state = s; paint(); } });
  new MutationObserver(() => { const a = anchor(), card = $('#gecVoiceArchiveCard'); if (a && (!card || card.previousElementSibling !== a)) render(); })
    .observe(document.documentElement, {childList: true, subtree: true});
  setTimeout(render, 1500);
})();
