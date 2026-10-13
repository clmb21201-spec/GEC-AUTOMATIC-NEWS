'use strict';
// Lab.42 · Tarjeta «Carpeta de datos e IAs» en Ajustes: dónde guarda GEC las IAs, motores de voz, voces, perfiles y
// diseño; abrirla, elegir otra (usar la que ya tiene datos o copiar ahí los actuales) o volver a la de junto al EXE.
// Si esta versión del EXE arrancó con los datos de la última carpeta usada, lo avisa una vez.
(function installDataLocationLab42(){
  if (window.__gecDataLocationLab42) return; window.__gecDataLocationLab42 = true;
  const api = window.ECAPI;
  if (!api || typeof api.dataLocationGet !== 'function') return;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let info = null, noticed = false;

  const css = document.createElement('style');
  css.textContent = `
  #gecDataLocCard .gec-dl-path{font-family:Consolas,monospace;font-size:12px;background:#0e0e0e;border:1px solid #303030;border-radius:8px;padding:8px 10px;margin-top:8px;word-break:break-all;color:#ddd}
  #gecDataLocCard .gec-dl-buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  #gecDataLocCard .gec-dl-msg{margin-top:8px;font-size:12px;line-height:1.45}
  #gecDataLocCard .gec-dl-msg.warn{color:#f3e7b0;background:#221d05;border:1px solid #6b5a12;border-radius:8px;padding:7px 10px}
  #gecDataLocCard .gec-dl-bar{height:6px;background:#262626;border-radius:4px;overflow:hidden;margin-top:8px;display:none}
  #gecDataLocCard .gec-dl-bar b{display:block;height:100%;width:0;background:#F7C600;transition:width .3s}`;
  document.head.appendChild(css);

  const SOURCE = {
    fixed: 'Carpeta fija elegida en Ajustes: la usa cualquier versión del EXE, esté donde esté.',
    local: 'Junto a este EXE.',
    'local-new': 'Junto a este EXE (carpeta nueva).',
    remembered: 'La última carpeta usada: este EXE está en otra carpeta y no tenía datos propios, así que siguió con los tuyos.',
    env: 'La misma con la que arrancó GEC.'
  };
  const gb = n => `${(Number(n || 0) / 1073741824).toFixed(1)} GB`;

  function anchor(){
    const tab = $('#tab-settings'); if (!tab) return null;
    const opt = $('#optimizeEc0321')?.closest('.card');
    return opt && tab.contains(opt) ? {el: opt, where: 'afterend'} : {el: tab.querySelector('.card') || tab, where: tab.querySelector('.card') ? 'beforebegin' : 'afterbegin'};
  }
  function render(){
    if ($('#gecDataLocCard')) return;
    const a = anchor(); if (!a) return;
    const card = document.createElement('div'); card.id = 'gecDataLocCard'; card.className = 'card'; card.style.marginTop = '16px';
    card.innerHTML = `<div class="section-head"><h3>Carpeta de datos e IAs</h3><span id="gecDlPill" class="status-pill neutral">—</span></div>
      <p class="note">Aquí guarda GEC las IAs, los motores de voz, tus voces, los perfiles, el diseño y la optimización. Si abres una versión nueva del EXE desde otra carpeta, GEC sigue usando esta y no hace falta volver a descargar nada.</p>
      <div class="gec-dl-path" id="gecDlPath">…</div>
      <div class="gec-dl-msg" id="gecDlSource"></div>
      <div class="gec-dl-bar" id="gecDlBar"><b></b></div>
      <div class="gec-dl-buttons">
        <button type="button" class="dark compact" id="gecDlOpen">Abrir carpeta</button>
        <button type="button" class="dark compact" id="gecDlPick">Elegir otra carpeta…</button>
        <button type="button" class="dark compact" id="gecDlLocal">Usar la carpeta junto al EXE</button>
      </div>
      <div class="gec-dl-msg note" id="gecDlNote">Cambiar de carpeta reinicia GEC. Antes se detienen la emisión y la preparación.</div>`;
    a.el.insertAdjacentElement(a.where, card);
    card.addEventListener('click', onClick);
    load();
  }
  async function load(){ try { info = await api.dataLocationGet(); paint(); } catch {} }
  function paint(){
    if (!info || !$('#gecDlPath')) return;
    $('#gecDlPath').textContent = info.dataDir;
    const src = $('#gecDlSource'); src.textContent = SOURCE[info.source] || '';
    src.className = 'gec-dl-msg' + (info.source === 'remembered' ? ' warn' : ' note');
    const pill = $('#gecDlPill'); pill.textContent = info.fixed ? 'FIJA' : (info.source === 'remembered' ? 'ÚLTIMA USADA' : 'JUNTO AL EXE');
    pill.className = 'status-pill ' + (info.fixed ? 'ok' : 'neutral');
    $('#gecDlLocal').style.display = info.fixed || info.source === 'remembered' ? '' : 'none';
    if (info.source === 'remembered' && !noticed) {
      noticed = true;
      try { if (typeof status === 'function') status(`GEC usa tus datos e IAs de ${info.dataDir} (Ajustes → Carpeta de datos e IAs).`); } catch {}
    }
  }
  function busy(on){ ['gecDlOpen', 'gecDlPick', 'gecDlLocal'].forEach(id => { const b = $('#' + id); if (b) b.disabled = on; }); $('#gecDlBar').style.display = on ? 'block' : 'none'; }
  async function onClick(e){
    const id = e.target.id; if (!/^gecDl(Open|Pick|Local)$/.test(id)) return;
    if (id === 'gecDlOpen') { const r = await api.dataLocationOpen(); if (r && r.ok === false) alert(r.error || 'No se pudo abrir la carpeta.'); return; }
    if (id === 'gecDlLocal') {
      if (!confirm('GEC volverá a usar la carpeta que está junto a este EXE y se reiniciará. Si ahí no hay datos, empezará de cero (puedes volver a elegir esta carpeta después). ¿Continuar?')) return;
      busy(true); const r = await api.dataLocationSet({mode: 'local'}); busy(false);
      if (r && r.ok === false) alert(r.error); else if (r && !r.restart) load();
      return;
    }
    const pick = await api.dataLocationPick(); if (!pick || !pick.ok) return;
    if (!pick.writable) { alert('GEC no puede escribir en esa carpeta. Elige otra (por ejemplo, una en tu disco D: o en Documentos).'); return; }
    if (pick.current) { await api.dataLocationSet({mode: 'use', folder: pick.folder}); load(); alert('Esa ya es la carpeta en uso. Quedó fijada: la usará cualquier versión del EXE.'); return; }
    let mode = 'use';
    if (pick.hasData) {
      if (!confirm(`Esa carpeta ya tiene datos de GEC:\n${pick.dataDir}\n\nGEC se reiniciará usándolos (no se copia nada). ¿Continuar?`)) return;
    } else {
      const copy = confirm(`Carpeta nueva:\n${pick.dataDir}\n\nAceptar = copiar ahí tus datos e IAs actuales y usarla (puede tardar varios minutos; la carpeta actual no se borra).\nCancelar = no hacer nada.`);
      if (!copy) return; mode = 'copy';
    }
    busy(true); $('#gecDlNote').textContent = mode === 'copy' ? 'Copiando… no cierres GEC.' : 'Reiniciando…';
    const r = await api.dataLocationSet({mode, folder: pick.folder});
    if (r && r.ok === false) { busy(false); $('#gecDlNote').textContent = 'Cambiar de carpeta reinicia GEC. Antes se detienen la emisión y la preparación.'; alert(r.error); }
  }
  api.on('dataLocation:progress', p => {
    if (!p || !$('#gecDlBar')) return;
    if (p.error) { $('#gecDlNote').textContent = `La copia no terminó: ${p.error}`; return; }
    const pct = p.totalBytes ? Math.round(p.bytes / p.totalBytes * 100) : 0;
    $('#gecDlBar b').style.width = pct + '%';
    $('#gecDlNote').textContent = `Copiando… ${pct} % · ${p.done} de ${p.total} archivos · ${gb(p.bytes)} de ${gb(p.totalBytes)}. No cierres GEC.`;
  });
  new MutationObserver(() => { if (!$('#gecDataLocCard') && anchor()) render(); }).observe(document.documentElement, {childList: true, subtree: true});
  setTimeout(render, 1200);
})();
