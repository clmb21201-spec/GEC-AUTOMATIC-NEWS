'use strict';
// Lab.31 · Resultado de la aceleración de Qwen3-TTS en la tarjeta de optimización: CUDA graphs del predictor,
// RTF con notas realistas (fine-tuned) y prueba de escucha del corte actual (360) contra el corte por oraciones.
(function installQwenSpeedLab31(){
  if (window.__gecQwenSpeedLab31) return; window.__gecQwenSpeedLab31 = true;
  const api = window.ECAPI;
  if (!api || typeof api.qwenSpeedGet !== 'function') return;
  const $ = s => document.querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const rtf = n => Number(n) > 0 ? Number(n).toFixed(2) : '—';
  let card = null, busy = false;

  async function qwenParams(){
    try { const s = await api.getSettings(); if (String(s?.tts?.engine || '') !== 'qwen3tts') return null; return s?.tts?.engineParams?.qwen3tts || {}; } catch { return null; }
  }
  function ensureCard(){
    const anchor = $('#gecOptimizeLive30') || $('#ecOptimizeResult0321'); if (!anchor) return null;
    if (card && card.isConnected) return card;
    card = document.createElement('div'); card.id = 'gecQwenSpeed31'; card.className = 'subcard top-gap';
    anchor.insertAdjacentElement('afterend', card);
    card.addEventListener('change', async ev => {
      const t = ev.target; if (!t || t.name !== 'gecQwenChunk31' || busy) return;
      busy = true;
      try { const p = await qwenParams(); const r = await api.qwenSpeedSetChunkMode(p || {}, t.value); if (r?.ok) render(r.entry); }
      catch {} finally { busy = false; }
    });
    return card;
  }
  function notesLine(label, n){
    if (!n || !n.runs || !n.runs.length) return '';
    const chunks = Array.isArray(n.chunks) && n.chunks.length ? ` → ${n.chunks.length} fragmento${n.chunks.length === 1 ? '' : 's'}` : '';
    return `<div>${esc(label)} (${Number(n.chars) || 0} caracteres${chunks}): <b>RTF ${rtf(n.rtf)}</b>${n.ok === false ? ' ⚠ audio no válido' : ''}</div>`;
  }
  function render(entry){
    const c = ensureCard(); if (!c) return;
    if (!entry) { c.style.display = 'none'; c.innerHTML = ''; return; }
    c.style.display = '';
    const g = entry.graphs || {}, notes = entry.notes, ab = entry.ab;
    const graphLine = g.enabled
      ? `<div>Sin aceleración: RTF ${rtf(g.baselineRtf)}</div><div>Con aceleración: <b>RTF ${rtf(g.graphRtf)}</b> ✔ activada${g.gainPct ? ` (${Number(g.gainPct).toFixed(0)}% más rápido)` : ''}</div>`
      : `<div>Sin aceleración: RTF ${rtf(g.baselineRtf)}</div><div>${g.graphRtf > 0 ? `Con aceleración: RTF ${rtf(g.graphRtf)} · ` : ''}No activada: ${esc(g.reason || 'no compatible')}. La voz se genera en el modo normal.</div>`;
    let html = `<div class="section-head"><h3>Aceleración de Qwen3-TTS</h3><span class="mini-pill ${g.enabled ? 'ok' : ''}">${g.enabled ? 'CUDA GRAPHS ✓' : 'MODO NORMAL'}</span></div>`;
    html += `<div class="note"><b>Aceleración del predictor (CUDA graphs)</b>${graphLine}</div>`;
    if (notes) {
      html += `<div class="note top-gap"><b>Notas realistas (fine-tuned${entry.chunkMode === 'sentences' ? ', corte por oraciones' : ''})</b>${notesLine('Nota típica', notes.typical)}${notesLine('Nota corta', notes.short)}${notes.error ? `<div>⚠ ${esc(notes.error)}</div>` : ''}</div>`;
    }
    if (ab && (ab.fixedUrl || ab.sentencesUrl)) {
      const choice = entry.chunkMode === 'sentences' ? 'sentences' : 'fixed';
      const player = (url, label, value, r) => `<div style="margin-top:6px"><label style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><input type="radio" name="gecQwenChunk31" value="${value}" ${choice === value ? 'checked' : ''}> <b>${esc(label)}</b> · RTF ${rtf(r)}</label>${url ? `<audio controls preload="none" src="${esc(url)}" style="width:100%;max-width:520px;margin-top:4px"></audio>` : '<div class="note">Audio no disponible.</div>'}</div>`;
      html += `<div class="note top-gap"><b>Prueba de escucha</b><div>La misma nota con los dos cortes. Escúchalos y elige con cuál emitir; el cambio se aplica desde la próxima noticia.</div>`;
      html += player(ab.fixedUrl, 'Corte actual (360 caracteres)', 'fixed', ab.fixedRtf);
      html += player(ab.sentencesUrl, 'Corte por oraciones', 'sentences', ab.sentencesRtf);
      html += '</div>';
    }
    c.innerHTML = html;
  }
  let refreshing = false, lastRefresh = 0;
  async function refresh(force){
    const now = Date.now();
    if (refreshing || (!force && now - lastRefresh < 2000)) return;
    refreshing = true; lastRefresh = now;
    try {
      const p = await qwenParams();
      if (!p) { render(null); return; }
      const r = await api.qwenSpeedGet(p); if (r?.ok) render(r.entry);
    } catch {} finally { refreshing = false; }
  }

  api.on('tts-lab:event', e => {
    if (!e || e.type !== 'tts-lab-benchmark') return;
    const ph = String(e.phase || '');
    if (ph === 'lab31-done') { setTimeout(() => refresh(true), 300); return; }
    if (ph !== 'lab31-graphs' && ph !== 'lab31-note') return;
    // mensaje de la fase en el resumen en vivo de la optimización (renderer-0321 no conoce estas fases)
    const box = $('#ecOptimizeResult0321'); if (!box || !box.dataset.live) return;
    const rep = Number(e.repeatTotal) ? ` · repetición ${Number(e.repeatIndex) || 1} / ${Number(e.repeatTotal)}` : '';
    box.innerHTML = `<b>1/3 · ${ph === 'lab31-graphs' ? 'Aceleración del predictor' : 'Notas realistas'} · paso ${Number(e.index) || 1} / ${Number(e.total) || 1}.</b> ${esc(e.label || '')}${rep}`;
  });
  document.addEventListener('change', e => { const id = e.target && e.target.id; if (['v2TtsEngine', 'v2QwenVoiceMode', 'v2FineTunedModel'].includes(id)) setTimeout(() => refresh(true), 900); }, true);
  // la tarjeta de optimización se construye después y se reconstruye al terminar: se vuelve a colocar
  new MutationObserver(() => { if ((!card || !card.isConnected) && $('#ecOptimizeResult0321')) refresh(); }).observe(document.documentElement, {childList: true, subtree: true});
  setTimeout(() => refresh(true), 1500);
})();
