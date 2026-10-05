'use strict';
// Lab.33 · Horario automático en el panel, sin ocupar alto en ninguna pestaña:
// - pastilla en la barra superior (junto a OUTPUT) con el próximo horario o el estado actual; al tocarla abre la ventana;
// - ventana "Horario automático": franjas con días, Preparar / Emitir / Hasta en AM/PM y YouTube por franja;
// - tarjeta "OBS / YouTube" en la pestaña Salida, debajo de Salida NDI® (conexión con OBS en esta PC).
(function installScheduleLab33(){
  if (window.__gecScheduleLab33) return; window.__gecScheduleLab33 = true;
  const api = window.ECAPI;
  if (!api || typeof api.scheduleGet !== 'function') return;
  const $ = s => document.querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'], DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  let state = null, draft = null, obsInfo = null;

  const css = document.createElement('style');
  css.textContent = `
  #gecSchedPill{display:inline-flex;align-items:center;gap:6px;margin-left:8px;border:1px solid #6d5b00;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:800;color:#F7C600;background:#211c06;cursor:pointer;white-space:nowrap;max-width:420px;overflow:hidden;text-overflow:ellipsis}
  #gecSchedPill.off{color:#b5b5b5;border-color:#303030;background:#121212}
  #gecSchedPill.live{color:#d6e5ff;border-color:#365f92;background:#142338}
  #gecSchedPill.error{color:#ffd0d0;border-color:#793d3d;background:#2b1515}
  #gecSchedPill .dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex:0 0 auto}
  #gecSchedBg{position:fixed;inset:0;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px}
  #gecSchedBg.show{display:flex}
  #gecSchedModal{background:#1a1a1a;border:1px solid #303030;border-radius:14px;width:min(860px,100%);max-height:92vh;overflow:auto;padding:18px;color:#fff}
  #gecSchedModal table{width:100%;border-collapse:collapse;margin-top:12px}
  #gecSchedModal th{text-align:left;color:#b5b5b5;font-size:11px;font-weight:700;padding:0 6px 6px;white-space:nowrap}
  #gecSchedModal td{padding:7px 6px;border-top:1px solid #303030;vertical-align:middle}
  .gec-days{display:flex;gap:3px}
  .gec-day{width:25px;height:25px;padding:0;border-radius:6px;background:#262626;color:#999;border:1px solid #3a3a3a;font-size:11px;font-weight:800}
  .gec-day.on{background:#F7C600;color:#000;border-color:#F7C600}
  .gec-quick{display:flex;gap:8px;margin-top:4px}.gec-quick button{background:none;color:#F7C600;padding:0;font-size:10px;text-decoration:underline;font-weight:700}
  .gec-time{display:flex;gap:2px;align-items:center}.gec-time select{width:auto;padding:5px 3px;font-size:12px}
  .gec-hint{display:block;color:#ffe08a;font-size:10px;margin-top:3px;min-height:12px}
  .gec-yt{width:17px;height:17px;accent-color:#F7C600}
  .gec-del{background:none;color:#888;padding:2px 6px;font-size:16px}
  .gec-errors{margin-top:10px;color:#ffb3b3;font-size:12px}
  .gec-sched-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
  .gec-mini-switch{position:relative;width:38px;height:21px;border-radius:999px;background:#3a3a3a;border:1px solid #555;cursor:pointer;flex:0 0 auto}
  .gec-mini-switch:after{content:"";position:absolute;width:15px;height:15px;left:2px;top:2px;border-radius:50%;background:#ddd;transition:.2s}
  .gec-mini-switch.on{background:#F7C600;border-color:#F7C600}.gec-mini-switch.on:after{transform:translateX(17px);background:#111}
  #gecObsCard .gec-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
  #gecObsCard label{display:block;color:#b5b5b5;margin:0 0 5px}
  #gecObsCard .gec-live{margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:#101010;border:1px solid #303030;border-radius:10px;padding:10px 12px;font-size:13px}`;
  document.head.appendChild(css);

  // ---------------------------------------------------------------- horas: 24 h (guardado) ↔ AM/PM (pantalla)
  const to12 = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); if (!m) return null; let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return {h, m: m[2], ap}; };
  const to24 = (h, m, ap) => { if (h === '') return ''; let x = +h % 12; if (ap === 'PM') x += 12; return `${String(x).padStart(2, '0')}:${m}`; };
  const label12 = t => { const v = to12(t); return v ? `${v.h}:${v.m} ${v.ap}` : ''; };
  const minutes = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };

  // ---------------------------------------------------------------- pastilla
  function pillText(s){
    if (!s || !s.slots || !s.slots.length) return {cls: 'off', text: '⏰ Sin horario'};
    if (!s.enabled) return {cls: 'off', text: '⏰ Horario apagado'};
    const obsBad = s.anyYoutube && s.obs && s.obs.configured && s.obs.connected === false;
    if (s.message && /OBS|error|no /i.test(s.message) && obsBad) return {cls: 'error', text: '⏰ OBS no responde'};
    if (s.active) {
      const yt = s.active.youtube ? (s.obs && s.obs.streaming ? ' · YouTube en vivo' : ' · YouTube') : '';
      if (s.message && /esperando/i.test(s.message)) return {cls: 'live', text: '● Esperando noticias listas' + yt, dot: true};
      return {cls: 'live', text: '● ' + s.active.label + yt, dot: true};
    }
    if (obsBad) return {cls: 'error', text: '⏰ OBS no responde'};
    return {cls: '', text: s.next ? `⏰ Horario · próximo ${s.next.label}${s.next.youtube ? ' ▶ YouTube' : ''}` : '⏰ Horario sin próximas franjas'};
  }
  function renderPill(){
    const anchor = $('#outputStatus'); if (!anchor) return;
    let pill = $('#gecSchedPill');
    if (!pill) { pill = document.createElement('span'); pill.id = 'gecSchedPill'; pill.setAttribute('role', 'button'); pill.title = 'Horario automático: prepara, emite y transmite a YouTube en los días y horas que elijas'; pill.addEventListener('click', openModal); anchor.insertAdjacentElement('afterend', pill); }
    const p = pillText(state); pill.className = p.cls; pill.textContent = p.text;
    if (state && state.message) pill.title = state.message;
  }

  // ---------------------------------------------------------------- ventana del horario
  function timeCell(i, key, allowEmpty){
    const v = to12(draft.slots[i][key]) || (allowEmpty ? null : {h: 6, m: '00', ap: 'AM'});
    const hours = (allowEmpty ? ['<option value="">—</option>'] : []).concat(Array.from({length: 12}, (_, k) => k + 1).map(h => `<option${v && v.h === h ? ' selected' : ''}>${h}</option>`)).join('');
    const mins = Array.from({length: 12}, (_, k) => String(k * 5).padStart(2, '0')); if (v && !mins.includes(v.m)) mins.push(v.m);
    return `<div class="gec-time" data-i="${i}" data-k="${key}"><select class="h" aria-label="hora">${hours}</select>:<select class="m" aria-label="minutos"${v ? '' : ' disabled'}>${mins.map(m => `<option${v && v.m === m ? ' selected' : ''}>${m}</option>`).join('')}</select><select class="a" aria-label="AM o PM"${v ? '' : ' disabled'}>${['AM', 'PM'].map(a => `<option${v && v.ap === a ? ' selected' : ''}>${a}</option>`).join('')}</select></div><span class="gec-hint" data-hint="${i}-${key}"></span>`;
  }
  function rows(){
    const tb = $('#gecSchedRows'); if (!tb) return;
    tb.innerHTML = draft.slots.map((s, i) => `<tr>
      <td><div class="gec-days">${DAYS.map((d, j) => `<button type="button" class="gec-day${s.days[j] ? ' on' : ''}" data-i="${i}" data-j="${j}" title="${DAY_NAMES[j]}">${d}</button>`).join('')}</div>
        <div class="gec-quick"><button type="button" data-i="${i}" data-q="week">Lun–Vie</button><button type="button" data-i="${i}" data-q="weekend">Fin de semana</button><button type="button" data-i="${i}" data-q="all">Todos</button></div></td>
      <td>${timeCell(i, 'prep', false)}</td><td>${timeCell(i, 'emit', true)}</td><td>${timeCell(i, 'until', true)}</td>
      <td><input type="checkbox" class="gec-yt" data-y="${i}"${s.youtube ? ' checked' : ''}${s.emit ? '' : ' disabled title="Para transmitir, indica la hora de emitir"'}></td>
      <td><button type="button" class="gec-del" data-del="${i}" title="Quitar franja" aria-label="Quitar franja">✕</button></td></tr>`).join('') || '<tr><td colspan="6" class="note">Sin franjas. Usa "Agregar franja".</td></tr>';
    hints();
  }
  function hints(){
    draft.slots.forEach((s, i) => {
      const set = (k, t) => { const el = document.querySelector(`[data-hint="${i}-${k}"]`); if (el) el.textContent = t; };
      const p = minutes(s.prep), e = minutes(s.emit), u = minutes(s.until), ref = e ?? p;
      set('prep', ''); set('emit', s.emit ? (e < p ? '(día siguiente)' : '') : 'manual');
      set('until', s.until ? (u <= ref ? (u === 0 ? '12:00 AM = medianoche (día siguiente)' : '(día siguiente)') : (u === 720 ? '12:00 PM = mediodía' : '')) : 'sin hora de fin');
      if (e === 720) set('emit', '12:00 PM = mediodía');
    });
  }
  function ensureModal(){
    if ($('#gecSchedBg')) return;
    const bg = document.createElement('div'); bg.id = 'gecSchedBg';
    bg.innerHTML = `<div id="gecSchedModal" role="dialog" aria-modal="true" aria-label="Horario automático">
      <div class="gec-sched-head"><h3 style="margin:0">Horario automático</h3><div style="display:flex;align-items:center;gap:8px"><span class="note">Activo</span><span id="gecSchedOn" class="gec-mini-switch" role="switch" tabindex="0"></span><button type="button" class="gec-del" id="gecSchedClose" aria-label="Cerrar">✕</button></div></div>
      <p class="note" style="margin:6px 0 0">GEC prepara, emite y (si lo marcas) transmite a YouTube en estos horarios. Debe estar abierto. Si pausas o detienes algo a mano, el horario lo respeta hasta la próxima franja. "Emitir" vacío = la emisión la inicias tú; "Hasta" vacío = no se detiene sola.</p>
      <table><thead><tr><th>Días</th><th>Preparar</th><th>Emitir</th><th>Hasta</th><th>YouTube</th><th></th></tr></thead><tbody id="gecSchedRows"></tbody></table>
      <div class="buttons"><button type="button" class="dark compact" id="gecSchedAdd">+ Agregar franja</button></div>
      <div class="gec-errors" id="gecSchedErr"></div>
      <p class="note" id="gecSchedObsNote"></p>
      <div class="buttons" style="justify-content:flex-end"><button type="button" class="dark" id="gecSchedCancel">Cancelar</button><button type="button" id="gecSchedSave">Guardar</button></div></div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', onModalClick);
    bg.addEventListener('change', onModalChange);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && bg.classList.contains('show')) closeModal(); });
  }
  async function openModal(){
    ensureModal();
    let r = null; try { r = await api.scheduleGet(); } catch {}
    const raw = (r && r.schedule) || {enabled: true, slots: []};
    draft = {enabled: (r && r.raw && r.raw.enabled === false) ? false : true, slots: (raw.slots || []).map(s => ({...s, days: [...s.days]}))};
    if (!draft.slots.length) draft.slots.push({id: '', days: [true, true, true, true, true, false, false], prep: '05:30', emit: '06:00', until: '09:00', youtube: false});
    $('#gecSchedOn').classList.toggle('on', draft.enabled);
    $('#gecSchedErr').textContent = '';
    const o = state && state.obs;
    $('#gecSchedObsNote').textContent = o && o.configured ? (o.connected ? 'OBS conectado ✓ (pestaña Salida → OBS / YouTube).' : 'OBS no responde: revisa la tarjeta OBS / YouTube en la pestaña Salida.') : 'Para transmitir a YouTube, configura OBS en la pestaña Salida → OBS / YouTube.';
    rows(); $('#gecSchedBg').classList.add('show');
  }
  function closeModal(){ const bg = $('#gecSchedBg'); if (bg) bg.classList.remove('show'); }
  async function save(){
    const btn = $('#gecSchedSave'); btn.disabled = true;
    try {
      const r = await api.scheduleSet({enabled: draft.enabled, slots: draft.slots});
      if (!r || !r.ok) { $('#gecSchedErr').innerHTML = ((r && r.errors) || ['No se pudo guardar.']).map(esc).join('<br>'); return; }
      state = r.state; renderPill(); renderObsCard(); closeModal();
    } catch (e) { $('#gecSchedErr').textContent = String(e.message || e); }
    finally { btn.disabled = false; }
  }
  function onModalClick(e){
    const t = e.target;
    if (t.id === 'gecSchedBg' || t.id === 'gecSchedClose' || t.id === 'gecSchedCancel') return closeModal();
    if (t.id === 'gecSchedSave') return save();
    if (t.id === 'gecSchedOn') { draft.enabled = !draft.enabled; t.classList.toggle('on', draft.enabled); return; }
    if (t.id === 'gecSchedAdd') { draft.slots.push({id: '', days: [false, false, false, false, false, true, true], prep: '07:30', emit: '08:00', until: '11:00', youtube: false}); return rows(); }
    if (t.dataset.j !== undefined) { const s = draft.slots[+t.dataset.i]; s.days[+t.dataset.j] = !s.days[+t.dataset.j]; return rows(); }
    if (t.dataset.q) { const s = draft.slots[+t.dataset.i]; s.days = t.dataset.q === 'week' ? [1, 1, 1, 1, 1, 0, 0].map(Boolean) : t.dataset.q === 'weekend' ? [0, 0, 0, 0, 0, 1, 1].map(Boolean) : Array(7).fill(true); return rows(); }
    if (t.dataset.del !== undefined) { draft.slots.splice(+t.dataset.del, 1); return rows(); }
  }
  function onModalChange(e){
    const t = e.target, cell = t.closest('.gec-time');
    if (cell) {
      const s = draft.slots[+cell.dataset.i], k = cell.dataset.k, h = cell.querySelector('.h').value;
      s[k] = to24(h, cell.querySelector('.m').value || '00', cell.querySelector('.a').value || 'AM');
      if (k === 'emit' && !s.emit) s.youtube = false;
      return rows();
    }
    if (t.dataset.y !== undefined) draft.slots[+t.dataset.y].youtube = t.checked;
  }

  // ---------------------------------------------------------------- tarjeta OBS / YouTube (pestaña Salida)
  function renderObsCard(){
    const ndi = $('#ecNdiOutputCard'); if (!ndi) return;
    let card = $('#gecObsCard');
    if (!card) {
      card = document.createElement('div'); card.id = 'gecObsCard'; card.className = ndi.className; card.style.marginTop = '16px';
      card.innerHTML = `<div class="section-head"><h3>OBS / YouTube</h3><span id="gecObsPill" class="status-pill neutral">SIN PROBAR</span></div>
        <p class="note">GEC le indica a OBS cuándo empezar y terminar la transmisión según el horario. En OBS: Herramientas → Configuración del servidor WebSocket (OBS en esta PC: ws://127.0.0.1:4455).</p>
        <div class="gec-row2"><div><label for="gecObsUrl">Dirección de OBS</label><input id="gecObsUrl" value="ws://127.0.0.1:4455"></div><div><label for="gecObsPass">Contraseña</label><input id="gecObsPass" type="password" autocomplete="off"></div></div>
        <div class="buttons"><button type="button" class="dark compact" id="gecObsSave">Guardar y probar</button><button type="button" class="compact" id="gecObsStart">Iniciar transmisión ahora</button><button type="button" class="danger compact" id="gecObsStop">Detener transmisión</button></div>
        <div class="gec-live"><span>Transmisión: <b id="gecObsLive">—</b></span><span class="note" id="gecObsNext"></span></div>`;
      ndi.insertAdjacentElement('afterend', card);
      card.addEventListener('click', onObsClick);
      api.obsGet().then(r => { obsInfo = r; if (r && r.url) $('#gecObsUrl').value = r.url; if (r && r.hasPassword) $('#gecObsPass').placeholder = '•••••••• (guardada)'; renderObsCard(); }).catch(() => {});
    }
    // la pestaña Salida (lab28) mueve la tarjeta NDI después de crearla: la de OBS va siempre justo debajo
    if (card.previousElementSibling !== ndi) ndi.insertAdjacentElement('afterend', card);
    const o = (state && state.obs) || (obsInfo && obsInfo.state) || {};
    const pill = $('#gecObsPill');
    if (o.connected) { pill.className = 'status-pill ok'; pill.textContent = 'CONECTADO ✓'; }
    else if (o.configured && o.error) { pill.className = 'status-pill error'; pill.textContent = 'NO RESPONDE'; pill.title = o.error; }
    else { pill.className = 'status-pill neutral'; pill.textContent = 'SIN PROBAR'; }
    $('#gecObsLive').textContent = o.streaming ? `EN VIVO${o.timecode ? ' · ' + String(o.timecode).replace(/\.\d+$/, '') : ''}` : (o.connected ? 'sin transmitir' : (o.error ? o.error : '—'));
    const n = state && state.next && state.next.youtube ? `Próxima: ${state.next.label} (horario)` : (state && state.active && state.active.youtube ? 'En franja con YouTube' : '');
    $('#gecObsNext').textContent = n;
  }
  async function onObsClick(e){
    const t = e.target; if (!t.id || !/^gecObs(Save|Start|Stop)$/.test(t.id)) return;
    t.disabled = true;
    try {
      if (t.id === 'gecObsSave') {
        const pass = $('#gecObsPass').value;
        const r = await api.obsSet({url: $('#gecObsUrl').value.trim(), password: pass, keepPassword: !pass});
        if (r && r.ok === false && r.error) alert(r.error);
        if (pass) { $('#gecObsPass').value = ''; $('#gecObsPass').placeholder = '•••••••• (guardada)'; }
        if (r && r.state) { state = {...(state || {}), obs: r.state}; }
      } else {
        if (t.id === 'gecObsStop' && !confirm('¿Detener la transmisión de YouTube en OBS?')) return;
        const r = t.id === 'gecObsStart' ? await api.obsStart() : await api.obsStop();
        if (r && r.ok === false) alert(r.error || 'OBS no respondió.');
      }
      try { state = await api.scheduleState(); } catch {}
      renderObsCard(); renderPill();
    } finally { t.disabled = false; }
  }

  // ---------------------------------------------------------------- arranque
  api.on('schedule:state', s => { state = s; renderPill(); renderObsCard(); });
  const refresh = () => api.scheduleState().then(s => { state = s; renderPill(); renderObsCard(); }).catch(() => {});
  new MutationObserver(() => { const ndi = $('#ecNdiOutputCard'), card = $('#gecObsCard');
    if ((!$('#gecSchedPill') && $('#outputStatus')) || (ndi && (!card || card.previousElementSibling !== ndi))) { renderPill(); renderObsCard(); } })
    .observe(document.documentElement, {childList: true, subtree: true});
  // el perfil cambia el horario (cada perfil tiene el suyo)
  api.on('profile:changed', () => setTimeout(refresh, 800));
  setTimeout(refresh, 1200); setInterval(refresh, 60000);
})();
