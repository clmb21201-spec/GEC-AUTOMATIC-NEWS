'use strict';
// Lab.47 · Pestaña «Generador de offs» (antes «Generador de notas»). Las tarjetas viejas del generador quedan ocultas
// (no se borran); la revisión manual de RSS (#manualReview) sigue igual.
// Flujo: documentos → ① texto (completo o resumen de off de 30 s / 1 min / 90 s, editable) → ② cómo lo leerá la voz
// (editable, con los cambios resaltados) → ③ audio (escuchar, guardar en carpeta con .txt y .srt).
(function installOffsLab47(){
  if (window.__gecOffsLab47) return; window.__gecOffsLab47 = true;
  const api = window.ECAPI;
  if (!api || typeof api.offsStatus !== 'function') return;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt = s => { s = Math.max(0, Math.round(Number(s) || 0)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s} s`; };
  const est = t => Math.round(((String(t || '').match(/[\p{L}\p{N}]+/gu) || []).length) / 2.5);
  const MODES = [['full', 'Texto completo'], ['s30', 'Resumen de off · 30 s'], ['s60', 'Resumen de off · 1 min'], ['s90', 'Resumen de off · 90 s']];
  const SECS = {s30: 30, s60: 60, s90: 90};
  let st = {blocked: false, reason: '', busy: false, config: {}, history: []};
  let docs = [], cur = null, step = 1, audio = null, prepared = null;

  const css = document.createElement('style');
  css.textContent = `
  #gecOffs .gec-off-block{display:none;background:#2a1d05;border:1px solid #7a5a12;color:#f6e3b0;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-weight:600}
  #gecOffs.blocked .gec-off-block{display:block}
  #gecOffs.blocked .gec-off-work{opacity:.45;pointer-events:none}
  #gecOffs .gec-off-docs{display:flex;flex-direction:column;gap:6px;margin-top:10px}
  #gecOffs .gec-off-doc{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;background:#141414;border:1px solid #2c2c2c;border-radius:8px;padding:8px 10px}
  #gecOffs .gec-off-doc.on{border-color:#F7C600}
  #gecOffs .gec-off-doc small{color:#9a9a9a}
  #gecOffs .gec-off-steps{display:flex;gap:6px;margin:12px 0}
  #gecOffs .gec-off-steps span{flex:1;text-align:center;padding:6px;border-radius:8px;background:#1b1b1b;color:#8d8d8d;font-size:12px;font-weight:700}
  #gecOffs .gec-off-steps span.on{background:#F7C600;color:#111}
  #gecOffs .gec-off-steps span.done{background:#2b2b2b;color:#d6d6d6}
  #gecOffs textarea{width:100%;min-height:220px;resize:vertical;font-family:inherit;font-size:14px;line-height:1.5;background:#0f0f0f;color:#eee;border:1px solid #333;border-radius:8px;padding:10px;box-sizing:border-box}
  #gecOffs .gec-off-diff{background:#0f0f0f;border:1px solid #2a2a2a;border-radius:8px;padding:10px;max-height:220px;overflow:auto;font-size:13px;line-height:1.6;margin-bottom:8px}
  #gecOffs .gec-off-diff p{margin:0 0 8px}
  #gecOffs .gec-off-diff mark{background:#3a3000;color:#ffe680;border-radius:3px;padding:0 2px}
  #gecOffs .gec-off-diff del{color:#8a6f6f}
  #gecOffs .gec-off-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
  #gecOffs .gec-off-meta{font-size:12px;color:#aaa}
  #gecOffs .gec-off-meta.warn{color:#f3c96b}
  #gecOffs .gec-off-bar{height:6px;background:#262626;border-radius:4px;overflow:hidden;margin-top:8px;display:none}
  #gecOffs .gec-off-bar b{display:block;height:100%;width:0;background:#F7C600;transition:width .3s}
  #gecOffs .gec-off-hist{display:flex;flex-direction:column;gap:6px}
  #gecOffs .gec-off-hist div{display:flex;gap:8px;align-items:center;justify-content:space-between;background:#141414;border:1px solid #262626;border-radius:8px;padding:6px 10px;font-size:13px}
  #gecOffs .gec-off-acr{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}
  #gecOffs .gec-off-acr input{width:140px}
  #gecOffs .gec-off-path{font-family:Consolas,monospace;font-size:12px;color:#ccc;word-break:break-all}`;
  document.head.appendChild(css);

  function mount(){
    const tab = $('#tab-generator'); if (!tab || $('#gecOffs')) return !!$('#gecOffs');
    // las tarjetas del generador de notas quedan ocultas; la revisión manual de RSS no se toca
    tab.querySelectorAll(':scope > .generator-cols, #generatedSchedulerControls').forEach(el => { el.style.display = 'none'; el.dataset.gecOffsHidden = '1'; });
    const h1 = tab.querySelector('h1'); if (h1) h1.textContent = 'Generador de offs';
    const nav = document.querySelector('button.nav[data-tab="generator"]'); if (nav) nav.textContent = 'Generador de offs';
    const box = document.createElement('div'); box.id = 'gecOffs';
    box.innerHTML = `
      <div class="gec-off-block" id="gecOffBlock"></div>
      <div class="gec-off-work cols generator-cols">
        <div class="card">
          <div class="section-head"><h3>Documentos</h3><span class="mini-pill" id="gecOffCount">0</span></div>
          <p class="note">Convierte un TXT o Word en una locución con la voz de Audio y locución: el texto completo o un resumen de off. Antes de generar el audio puedes revisar y editar el texto y cómo lo leerá la voz.</p>
          <div class="buttons"><button type="button" id="gecOffPick">Elegir TXT o Word…</button></div>
          <div class="gec-off-docs" id="gecOffDocs"><div class="empty">Todavía no elegiste documentos.</div></div>
          <h3 style="margin-top:18px">Últimos offs</h3>
          <div class="gec-off-hist" id="gecOffHist"><div class="empty">Sin offs guardados.</div></div>
        </div>
        <div class="card" id="gecOffEditor">
          <div class="section-head"><h3 id="gecOffTitle">Elige un documento</h3><button type="button" class="dark compact" id="gecOffCancel" style="display:none">Cancelar</button></div>
          <div class="gec-off-steps"><span data-s="1">① Texto</span><span data-s="2">② Cómo lo leerá la voz</span><span data-s="3">③ Audio</span></div>
          <div class="gec-off-bar" id="gecOffBar"><b></b></div>
          <div class="gec-off-meta" id="gecOffMsg"></div>
          <div id="gecOffStep"></div>
        </div>
      </div>`;
    tab.querySelector('h1')?.insertAdjacentElement('afterend', box);
    box.addEventListener('click', onClick);
    box.addEventListener('input', onInput);
    box.addEventListener('change', onChange);
    return true;
  }

  // ------------------------------------------------------------- estado y bloqueo
  function applyStatus(s){
    if (!s) return; Object.assign(st, s);
    const box = $('#gecOffs'); if (!box) return;
    const blocked = !!st.blocked && !st.busy;
    box.classList.toggle('blocked', blocked);
    $('#gecOffBlock').textContent = blocked ? `⚠ ${st.reason || 'Para usar el Generador de offs, pausa la Preparación de noticias y la Emisión en Automático.'}` : '';
    renderHistory();
  }
  async function refresh(){ try { applyStatus(await api.offsStatus()); } catch {} }

  // ------------------------------------------------------------- documentos
  function renderDocs(){
    const list = $('#gecOffDocs'); if (!list) return;
    $('#gecOffCount').textContent = String(docs.length);
    if (!docs.length) { list.innerHTML = '<div class="empty">Todavía no elegiste documentos.</div>'; return; }
    list.innerHTML = docs.map((d, i) => `<div class="gec-off-doc${cur === d ? ' on' : ''}">
      <div><b>${esc(d.name)}</b>${d.saved ? ' ✓' : ''}<br><small>${d.error ? esc(d.error) : `${d.words} palabras · ~${fmt(d.estimateSec)} leído completo`}</small></div>
      <select data-mode="${i}" ${d.error ? 'disabled' : ''}>${MODES.map(([v, l]) => `<option value="${v}"${(d.mode || 'full') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <button type="button" class="compact" data-open="${i}" ${d.error ? 'disabled' : ''}>Preparar</button></div>`).join('');
  }
  function renderHistory(){
    const h = $('#gecOffHist'); if (!h) return;
    const rows = st.history || [];
    if (!rows.length) { h.innerHTML = '<div class="empty">Sin offs guardados.</div>'; return; }
    h.innerHTML = rows.slice(0, 8).map((r, i) => `<div><span>${esc(r.name)} <small style="color:#999">· ${fmt(r.duration)}${r.srt ? ' · SRT' : ''}</small></span><span><button type="button" class="dark compact" data-hplay="${i}">Escuchar</button> <button type="button" class="dark compact" data-hopen="${i}">Abrir carpeta</button></span></div>`).join('');
  }

  // ------------------------------------------------------------- pasos
  function setStep(n){
    step = n;
    document.querySelectorAll('#gecOffs .gec-off-steps span').forEach(s => { const k = Number(s.dataset.s); s.className = k === n ? 'on' : k < n ? 'done' : ''; });
    render();
  }
  function msg(text, warn){ const m = $('#gecOffMsg'); if (m) { m.textContent = text || ''; m.className = 'gec-off-meta' + (warn ? ' warn' : ''); } }
  function target(){ return SECS[cur?.mode] || 0; }
  function estLine(t){ const e = est(t), tg = target(); return tg ? `~${fmt(e)} leído · objetivo ${fmt(tg)}${e > tg * 1.15 ? ' · está largo, recórtalo un poco' : ''}` : `~${fmt(e)} leído`; }
  function render(){
    const el = $('#gecOffStep'); if (!el) return;
    if (!cur) { el.innerHTML = '<p class="note">Elige un documento y pulsa «Preparar».</p>'; return; }
    $('#gecOffTitle').textContent = cur.name;
    if (step === 1) {
      const sum = !!target();
      el.innerHTML = `<p class="note">${sum ? 'Resumen de off escrito por la IA (sin saludo ni despedida; si los quieres, agrégalos aquí).' : 'El texto del documento, tal como se va a narrar.'} Puedes editarlo. Una línea en blanco separa párrafos (pausa más larga).</p>
        <textarea id="gecOffText">${esc(cur.edited ?? (sum ? (cur.summary || '') : cur.text))}</textarea>
        <div class="gec-off-meta" id="gecOffEst">${esc(estLine(cur.edited ?? (sum ? cur.summary : cur.text)))}</div>
        <div class="gec-off-row">${sum ? '<button type="button" class="dark" id="gecOffSummarize">' + (cur.summary ? 'Volver a resumir con la IA' : 'Resumir con la IA') + '</button>' : ''}<button type="button" id="gecOffNext1">Siguiente: ver cómo lo leerá la voz</button></div>`;
      if (sum && !cur.summary && !cur.edited) summarize();
    } else if (step === 2) {
      el.innerHTML = `<p class="note">Así lo va a leer la voz. Lo resaltado es lo que GEC convirtió (cifras, horas, siglas, documentos…). Corrige lo que quieras: se narra exactamente lo que quede abajo.</p>
        <div class="gec-off-diff" id="gecOffDiff">${diffHtml(prepared?.written || [], (cur.spoken ?? prepared?.text ?? '').split(/\n\s*\n/))}</div>
        <textarea id="gecOffSpoken">${esc(cur.spoken ?? prepared?.text ?? '')}</textarea>
        <div class="gec-off-meta" id="gecOffEst2">${esc(estLine(cur.spoken ?? prepared?.text))}</div>
        <div class="gec-off-acr"><span class="gec-off-meta">¿Una sigla que se lee mal siempre? Guárdala en «Siglas» (vale también para las noticias):</span><input id="gecOffAcrA" placeholder="Sigla (BTS)"><input id="gecOffAcrB" placeholder="Se dice (bi ti es)"><button type="button" class="dark compact" id="gecOffAcrSave">Guardar sigla</button></div>
        <div class="gec-off-row"><button type="button" class="dark" id="gecOffBack1">Volver al texto</button><button type="button" id="gecOffGen">Generar audio</button></div>`;
    } else {
      const c = st.config || {};
      el.innerHTML = `<audio id="gecOffAudio" controls style="width:100%" src="${esc(audio?.url || '')}"></audio>
        <div class="gec-off-meta">${audio ? `Duración ${fmt(audio.duration)} · WAV 48 kHz · volumen parejo` : ''}</div>
        <div class="form-grid two" style="margin-top:10px"><label>Nombre del archivo<input id="gecOffName" value="${esc(cur.name)}"></label>
          <div><label class="switch-row"><span><b>Guardar el texto (.txt)</b></span><input id="gecOffTxt" type="checkbox"${c.txt !== false ? ' checked' : ''}><span class="switch-ui"></span></label>
          <label class="switch-row"><span><b>Exportar subtítulos (.srt)</b><small>Con el texto tal como está escrito.</small></span><input id="gecOffSrt" type="checkbox"${c.srt !== false ? ' checked' : ''}><span class="switch-ui"></span></label></div></div>
        <div class="gec-off-meta">Carpeta: <span class="gec-off-path">${esc(c.folder || '')}</span></div>
        <div class="gec-off-row"><button type="button" class="dark" id="gecOffBack2">Volver a corregir y regenerar</button><button type="button" class="dark" id="gecOffFolder">Cambiar carpeta…</button><button type="button" id="gecOffSave">Guardar</button><button type="button" class="dark" id="gecOffOpen" style="display:none">Abrir carpeta</button></div>`;
    }
  }

  // diferencias palabra por palabra (LCS) entre lo escrito y lo que leerá la voz
  function diffHtml(written, spoken){
    const n = Math.max(written.length, spoken.length), out = [];
    for (let i = 0; i < n; i++) {
      const a = String(written[i] || '').split(/\s+/).filter(Boolean), b = String(spoken[i] || '').split(/\s+/).filter(Boolean);
      if (a.length * b.length > 250000) { out.push(`<p>${esc(b.join(' '))}</p>`); continue; }
      const norm = w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      const L = Array.from({length: a.length + 1}, () => new Uint16Array(b.length + 1));
      for (let x = a.length - 1; x >= 0; x--) for (let y = b.length - 1; y >= 0; y--) L[x][y] = norm(a[x]) === norm(b[y]) ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
      let x = 0, y = 0, html = '', del = [], add = [];
      const flush = () => { if (del.length || add.length) html += `${del.length ? `<del>${esc(del.join(' '))}</del> ` : ''}${add.length ? `<mark>${esc(add.join(' '))}</mark> ` : ''}`; del = []; add = []; };
      while (x < a.length || y < b.length) {
        if (x < a.length && y < b.length && norm(a[x]) === norm(b[y])) { flush(); html += esc(b[y]) + ' '; x++; y++; }
        else if (y < b.length && (x >= a.length || L[x][y + 1] >= L[x + 1][y])) { add.push(b[y]); y++; }
        else { del.push(a[x]); x++; }
      }
      flush(); out.push(`<p>${html.trim()}</p>`);
    }
    return out.join('') || '<p class="note">Sin texto.</p>';
  }

  // ------------------------------------------------------------- acciones
  function busyUi(on, text){
    const bar = $('#gecOffBar'); if (bar) bar.style.display = on ? 'block' : 'none';
    const c = $('#gecOffCancel'); if (c) c.style.display = on ? '' : 'none';
    document.querySelectorAll('#gecOffStep button, #gecOffPick, #gecOffDocs button').forEach(b => { b.disabled = on; });
    if (text !== undefined) msg(text);
  }
  async function summarize(){
    if (!cur) return; busyUi(true, 'La IA está escribiendo el resumen de off…');
    const r = await api.offsSummarize({text: cur.text, seconds: target()});
    busyUi(false, '');
    if (!r || r.ok === false) { msg(r?.error || 'No se pudo resumir.', true); return; }
    cur.summary = r.text; cur.edited = undefined; msg(`Resumen de ${r.words} palabras (${r.provider === 'local' ? 'IA local' : r.provider}). Revísalo y edítalo si hace falta.`);
    render();
  }
  async function toStep2(){
    const text = $('#gecOffText')?.value || ''; cur.edited = text;
    if (!text.trim()) { msg('No hay texto para narrar.', true); return; }
    busyUi(true, 'Preparando cómo lo leerá la voz…');
    const r = await api.offsPrepare({text});
    busyUi(false, '');
    if (!r || r.ok === false) { msg(r?.error || 'No se pudo preparar el texto.', true); return; }
    prepared = r; cur.spoken = undefined; setStep(2);
  }
  async function generate(){
    const spoken = $('#gecOffSpoken')?.value || ''; cur.spoken = spoken;
    if (!spoken.trim()) { msg('No hay texto para narrar.', true); return; }
    busyUi(true, 'Generando el audio con tu voz…');
    const r = await api.offsGenerate({spoken, written: cur.edited ?? cur.text});
    busyUi(false, '');
    if (!r || r.ok === false) { msg(r?.error || 'No se pudo generar el audio.', true); return; }
    audio = r; msg(''); setStep(3);
  }
  async function save(){
    const r = await api.offsSave({id: audio?.id, name: $('#gecOffName')?.value || cur.name, txt: $('#gecOffTxt')?.checked, srt: $('#gecOffSrt')?.checked, mode: cur.mode});
    if (!r || r.ok === false) { msg(r?.error || 'No se pudo guardar.', true); return; }
    cur.saved = true; st.history = r.history || st.history; cur.lastFile = r.files?.wav;
    msg(`Guardado: ${Object.values(r.files || {}).map(f => f.split(/[\\/]/).pop()).join(' · ')}`);
    const o = $('#gecOffOpen'); if (o) o.style.display = '';
    renderDocs(); renderHistory();
  }
  async function onClick(e){
    const t = e.target, id = t.id;
    if (id === 'gecOffPick') { const r = await api.offsPickFiles(); if (r?.ok) { docs = [...r.docs, ...docs].slice(0, 30); renderDocs(); } return; }
    if (t.dataset.open !== undefined) { const d = docs[Number(t.dataset.open)]; if (!d || d.error) return; cur = d; audio = null; prepared = null; renderDocs(); msg(''); setStep(1); return; }
    if (t.dataset.hplay !== undefined) { const r = st.history[Number(t.dataset.hplay)], u = r && await api.offsFileUrl(r.wav); if (u?.ok) { const a = new Audio(u.url); a.play().catch(() => {}); } else msg(u?.error || 'El archivo ya no existe.', true); return; }
    if (t.dataset.hopen !== undefined) { const r = st.history[Number(t.dataset.hopen)]; await api.offsOpen(r?.wav || ''); return; }
    if (id === 'gecOffCancel') { await api.offsCancel(); msg('Cancelando…'); return; }
    if (id === 'gecOffSummarize') { cur.summary = ''; cur.edited = undefined; return summarize(); }
    if (id === 'gecOffNext1') return toStep2();
    if (id === 'gecOffBack1') { cur.spoken = $('#gecOffSpoken')?.value; setStep(1); return; }
    if (id === 'gecOffGen') return generate();
    if (id === 'gecOffBack2') { setStep(2); return; }
    if (id === 'gecOffFolder') { const r = await api.offsPickFolder(); if (r?.ok) { st.config = r.config; render(); } return; }
    if (id === 'gecOffSave') return save();
    if (id === 'gecOffOpen') { await api.offsOpen(cur?.lastFile || ''); return; }
    if (id === 'gecOffAcrSave') {
      const a = ($('#gecOffAcrA')?.value || '').trim(), b = ($('#gecOffAcrB')?.value || '').trim();
      if (!a || !b) { msg('Escribe la sigla y cómo se dice.', true); return; }
      try { const cur0 = await api.acronymsGet(); const r = await api.acronymsSet({...(cur0?.terms || {}), [a]: b}); if (r?.ok === false) throw new Error(r.error); msg(`Sigla guardada: ${a} → «${b}». Vuelve al texto y pasa otra vez a este paso para aplicarla.`); } catch (err) { msg(`No se pudo guardar la sigla: ${err.message || err}`, true); }
    }
  }
  function onInput(e){
    if (e.target.id === 'gecOffText') { const m = $('#gecOffEst'); if (m) m.textContent = estLine(e.target.value); }
    if (e.target.id === 'gecOffSpoken') { const m = $('#gecOffEst2'); if (m) m.textContent = estLine(e.target.value); }
  }
  function onChange(e){
    const t = e.target;
    if (t.dataset.mode !== undefined) { const d = docs[Number(t.dataset.mode)]; if (d) { d.mode = t.value; if (d === cur) { cur.edited = undefined; cur.summary = ''; prepared = null; audio = null; setStep(1); } } }
    if (t.id === 'gecOffTxt' || t.id === 'gecOffSrt') api.offsSetOptions({txt: $('#gecOffTxt')?.checked, srt: $('#gecOffSrt')?.checked}).then(r => { if (r?.config) st.config = r.config; }).catch(() => {});
  }
  api.on('offs:progress', p => {
    if (!p) return;
    if (p.blocked !== undefined) applyStatus({blocked: p.blocked, reason: p.reason, busy: p.busy});
    const bar = $('#gecOffBar b');
    if (bar && p.total) bar.style.width = `${Math.round(p.index / p.total * 100)}%`;
    if (p.stage === 'generate' && p.total) msg(`Generando el audio con tu voz… párrafo ${p.index} de ${p.total}`);
    if (p.stage === 'prepare' && p.total) msg(`Preparando cómo lo leerá la voz… párrafo ${p.index} de ${p.total}`);
    if (p.stage === 'mix') msg('Uniendo párrafos y dejando el volumen parejo…');
  });

  const tryMount = () => { if (mount()) { refresh(); renderDocs(); render(); return true; } return false; };
  if (!tryMount()) { const mo = new MutationObserver(() => { if (tryMount()) mo.disconnect(); }); mo.observe(document.documentElement, {childList: true, subtree: true}); }
  // al volver a la pestaña se actualiza el estado (bloqueo, historial)
  document.addEventListener('click', e => { if (e.target?.closest?.('button.nav[data-tab="generator"]')) refresh(); });
})();
