'use strict';
// Lab.32 · Siglas para la voz: el operador agrega o corrige cómo se leen (una por línea, "SIGLA = lectura").
// Ganan sobre la lista incorporada; se guardan en pronunciation-acronyms.json (services/acronymsSpeechLab32.js).
(function installAcronymsLab32(){
  if (window.__gecAcronymsLab32) return; window.__gecAcronymsLab32 = true;
  const api = window.ECAPI;
  if (!api || typeof api.acronymsGet !== 'function') return;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  let card = null;

  const toLines = terms => Object.entries(terms || {}).sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([k, v]) => `${k} = ${v}`).join('\n');
  function parseLines(text){
    const terms = {}, bad = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      const t = line.trim(); if (!t) return;
      const m = t.match(/^([^=]+?)\s*=\s*(.+)$/);
      if (!m) { bad.push(i + 1); return; }
      terms[m[1].trim()] = m[2].trim();
    });
    return {terms, bad};
  }
  function ensureCard(){
    if (card && card.isConnected) return card;
    const anchor = document.getElementById('pronunciationLearningInfo')?.closest('.subcard'); if (!anchor) return null;
    card = document.createElement('div'); card.id = 'gecAcronyms32'; card.className = 'subcard top-gap';
    card.innerHTML = `<div class="section-head"><h3>Siglas</h3><span id="gecAcronymsCount32" class="mini-pill">0 propias</span></div>
      <div class="note">Una por línea: <b>SIGLA = cómo se lee</b>. Ej.: <code>ONP = o ene pe</code>, <code>TV = tevé</code>, <code>MINSA = Minsa</code>. Ganan sobre la lista incorporada.</div>
      <textarea id="gecAcronymsText32" rows="6" spellcheck="false" style="width:100%;font-family:monospace"></textarea>
      <div class="buttons"><button id="gecAcronymsSave32">Guardar siglas</button></div>
      <label>Probar lectura<input id="gecAcronymsTry32" type="text" placeholder="Resolución N° 000081-2026-PE-ONP sobre la TV"></label>
      <div class="buttons"><button id="gecAcronymsTest32" class="dark">Ver cómo se lee</button></div>
      <div id="gecAcronymsInfo32" class="note"></div>
      <details><summary>Lista incorporada</summary><div id="gecAcronymsBuiltin32" class="note"></div></details>`;
    anchor.insertAdjacentElement('afterend', card);
    card.querySelector('#gecAcronymsSave32').addEventListener('click', save);
    card.querySelector('#gecAcronymsTest32').addEventListener('click', test);
    return card;
  }
  function render(r){
    const c = ensureCard(); if (!c || !r?.ok) return;
    const n = Object.keys(r.terms || {}).length;
    c.querySelector('#gecAcronymsCount32').textContent = `${n} propia${n === 1 ? '' : 's'}`;
    c.querySelector('#gecAcronymsText32').value = toLines(r.terms);
    c.querySelector('#gecAcronymsBuiltin32').innerHTML = Object.entries(r.builtin || {}).map(([k, v]) => `${esc(k)} → ${esc(v)}`).join(' · ');
  }
  const info = msg => { const el = card?.querySelector('#gecAcronymsInfo32'); if (el) el.innerHTML = msg; };
  async function save(){
    const {terms, bad} = parseLines(card.querySelector('#gecAcronymsText32').value);
    const r = await api.acronymsSet(terms).catch(e => ({ok: false, error: e.message}));
    if (!r?.ok) { info(`No se pudo guardar: ${esc(r?.error || 'error')}`); return; }
    render(r);
    const kept = Object.keys(r.terms || {}).length, dropped = Object.keys(terms).length - kept;
    info(`Guardadas ${kept} sigla${kept === 1 ? '' : 's'}.${bad.length ? ` Líneas sin "=" ignoradas: ${bad.join(', ')}.` : ''}${dropped > 0 ? ` ${dropped} no válida${dropped === 1 ? '' : 's'} (la sigla solo admite letras, números, punto y &).` : ''}`);
  }
  async function test(){
    const text = card.querySelector('#gecAcronymsTry32').value.trim(); if (!text) return;
    const r = await api.acronymsTest(text).catch(e => ({ok: false, error: e.message}));
    info(r?.ok ? `Se lee: <b>${esc(r.text)}</b>` : `No se pudo probar: ${esc(r?.error || 'error')}`);
  }
  async function load(){ if (!ensureCard()) return false; render(await api.acronymsGet().catch(() => null)); return true; }
  let tries = 0;
  const tick = async () => { if (await load()) return; if (++tries < 40) setTimeout(tick, 500); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick, {once: true}); else tick();
})();
