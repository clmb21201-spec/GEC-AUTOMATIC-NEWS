'use strict';
// Lab.37 · Ajustes de "Noticias con movimiento" (salida clásica), por perfil. Una fila compacta dentro de la tarjeta
// Transiciones de Diseño de emisión (no agrega una tarjeta nueva) y una ventana con los colores del movimiento y el ticker.
(function installNewsMotionPanelLab37(){
  if (window.__gecNewsMotionPanelLab37) return; window.__gecNewsMotionPanelLab37 = true;
  const api = window.ECAPI;
  if (!api || typeof api.newsMotionGet !== 'function') return;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let cfg = null;

  const css = document.createElement('style');
  css.textContent = `
  #gecNmRow{margin-top:12px;padding-top:12px;border-top:1px solid #303030}
  #gecNmRow .gec-nm-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  #gecNmRow .gec-nm-line select{width:auto;margin:0}
  #gecNmBg{position:fixed;inset:0;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px}
  #gecNmBg.show{display:flex}
  #gecNmModal{background:#1a1a1a;border:1px solid #303030;border-radius:14px;width:min(760px,100%);max-height:92vh;overflow:auto;padding:18px;color:#fff}
  #gecNmModal h3{margin:14px 0 6px;font-size:14px}
  #gecNmModal .gec-nm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 14px}
  #gecNmModal .gec-nm-color{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:#ddd}
  #gecNmModal .gec-nm-color input{width:46px;height:28px;padding:0;margin:0}
  #gecNmModal .gec-nm-color input:disabled{opacity:.5}
  #gecNmModal .gec-nm-check{display:flex;gap:8px;align-items:center;justify-content:flex-start;font-size:13px;color:#ddd;margin:4px 0;text-align:left}
  #gecNmModal input[type=checkbox],#gecNmModal input[type=radio]{width:16px;height:16px;flex:0 0 16px;margin:0;padding:0}
  #gecNmModal .gec-nm-color{margin:0}
  #gecNmModal textarea{width:100%;min-height:70px;resize:vertical}
  #gecNmModal .gec-nm-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}`;
  document.head.appendChild(css);

  const COLORS = [['bar1','Barras de transición · 1'],['bar2','Barras de transición · 2'],['bar3','Barras de transición · 3'],['voiceBg','Indicador de voz · fondo'],['voiceBars','Indicador de voz · barras'],['tickerBg','Etiqueta del ticker · fondo'],['tickerText','Etiqueta del ticker · texto']];
  function anchor(){ const t = $('#transitionType'); return t ? t.closest('.card') : null; }
  function render(){
    const card = anchor(); if (!card) return;
    if ($('#gecNmRow')) return;
    const row = document.createElement('div'); row.id = 'gecNmRow';
    row.innerHTML = `<label class="switch-row"><span><b>Noticias con movimiento</b><small>Salida clásica: planos en las pausas de la voz, datos clave, ticker y golpe de marca.</small></span><input id="gecNmOn" type="checkbox"><span class="switch-ui"></span></label>
      <div class="gec-nm-line"><span class="note" style="margin:0">Movimiento</span><select id="gecNmLevel"><option value="sobrio">Sobrio</option><option value="normal">Normal</option><option value="dinamico">Dinámico</option></select><button type="button" class="dark compact" id="gecNmOpen">Colores y ticker…</button></div>`;
    card.appendChild(row);
    row.addEventListener('change', e => { if (e.target.id === 'gecNmOn' || e.target.id === 'gecNmLevel') save({...cfg, enabled: $('#gecNmOn').checked, level: $('#gecNmLevel').value}); });
    $('#gecNmOpen').addEventListener('click', openModal);
    fill();
  }
  function fill(){ if (!cfg || !$('#gecNmOn')) return; $('#gecNmOn').checked = cfg.enabled !== false; $('#gecNmLevel').value = cfg.level || 'normal'; }
  async function load(){ try { const r = await api.newsMotionGet(); if (r && r.ok) { cfg = r.config; fill(); } } catch {} }
  async function save(next){
    try { const r = await api.newsMotionSet(next); if (r && r.ok === false) { alert(r.error || 'No se pudo guardar.'); return false; } cfg = r.config; fill(); return true; }
    catch (e) { alert(String(e.message || e)); return false; }
  }

  function ensureModal(){
    if ($('#gecNmBg')) return;
    const bg = document.createElement('div'); bg.id = 'gecNmBg';
    bg.innerHTML = `<div id="gecNmModal" role="dialog" aria-modal="true" aria-label="Noticias con movimiento">
      <div class="section-head"><h3 style="margin:0">Noticias con movimiento · este perfil</h3></div>
      <p class="note">Las tipografías, los colores de sección, exclusivo, titular y el fondo del cintillo salen de este Diseño de emisión. Aquí solo van los colores propios del movimiento y el ticker.</p>
      <h3>Elementos</h3>
      <div class="gec-nm-grid">
        <label class="gec-nm-check"><input type="checkbox" data-k="facts"> Datos clave (cifras, personas, lugares)</label>
        <label class="gec-nm-check"><input type="checkbox" data-k="voice"> Indicador de voz</label>
        <label class="gec-nm-check"><input type="checkbox" data-k="progress"> Barra de progreso de la nota</label>
        <label class="gec-nm-check"><input type="checkbox" data-k="clock"> Reloj</label>
        <label class="gec-nm-check"><input type="checkbox" data-k="sting"> Golpe de marca entre noticias</label>
      </div>
      <h3>Colores del movimiento</h3>
      <label class="gec-nm-check"><input type="radio" name="gecNmMode" value="auto"> Tomar del Diseño (barra 1 = sección, barra 2 = exclusivo o titular, barra 3 = fondo del cintillo)</label>
      <label class="gec-nm-check"><input type="radio" name="gecNmMode" value="custom"> Personalizados</label>
      <div class="gec-nm-grid" id="gecNmColors">${COLORS.map(([k, l]) => `<label class="gec-nm-color">${l}<input type="color" data-c="${k}"></label>`).join('')}</div>
      <h3>Ticker</h3>
      <div class="gec-nm-grid">
        <label class="gec-nm-check"><input type="checkbox" data-t="enabled"> Mostrar ticker (solo en 16:9)</label>
        <label class="gec-nm-check"><input type="checkbox" data-t="queue"> Titulares en cola (los escribe la IA)</label>
        <label class="gec-nm-check"><input type="checkbox" data-t="rss"> Otros titulares de los RSS del perfil</label>
      </div>
      <div class="form-grid two"><label>Etiqueta<input id="gecNmLabel" maxlength="24"></label><label>Un mensaje cada<select id="gecNmEvery">${[1,2,3,4,5,6,8,10].map(n => `<option value="${n}">${n} titular${n > 1 ? 'es' : ''}</option>`).join('')}</select></label></div>
      <label>Mensajes del operador (uno por línea)<textarea id="gecNmMsgs" placeholder="Síguenos en @tuprograma"></textarea></label>
      <div class="gec-nm-foot"><button type="button" class="dark" id="gecNmCancel">Cancelar</button><button type="button" id="gecNmSave">Guardar</button></div>
    </div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('show'); });
    bg.addEventListener('change', e => { if (e.target.name === 'gecNmMode') syncColorLock(); });
    $('#gecNmCancel').addEventListener('click', () => bg.classList.remove('show'));
    $('#gecNmSave').addEventListener('click', async () => {
      const b = $('#gecNmSave'); b.disabled = true;
      try {
        const next = {...cfg, colors: {...(cfg.colors || {})}, ticker: {...(cfg.ticker || {})}};
        document.querySelectorAll('#gecNmModal [data-k]').forEach(i => next[i.dataset.k] = i.checked);
        next.colors.mode = document.querySelector('#gecNmModal input[name=gecNmMode]:checked')?.value === 'custom' ? 'custom' : 'auto';
        document.querySelectorAll('#gecNmModal [data-c]').forEach(i => next.colors[i.dataset.c] = i.value.toUpperCase());
        document.querySelectorAll('#gecNmModal [data-t]').forEach(i => next.ticker[i.dataset.t] = i.checked);
        next.ticker.label = $('#gecNmLabel').value; next.ticker.every = Number($('#gecNmEvery').value) || 3;
        next.ticker.messages = $('#gecNmMsgs').value.split(/\r?\n/);
        if (await save(next)) bg.classList.remove('show');
      } finally { b.disabled = false; }
    });
  }
  function syncColorLock(){ const custom = document.querySelector('#gecNmModal input[name=gecNmMode]:checked')?.value === 'custom'; document.querySelectorAll('#gecNmModal [data-c]').forEach(i => i.disabled = !custom); }
  async function openModal(){
    await load(); if (!cfg) return; ensureModal();
    document.querySelectorAll('#gecNmModal [data-k]').forEach(i => i.checked = cfg[i.dataset.k] !== false);
    const mode = cfg.colors?.mode === 'custom' ? 'custom' : 'auto';
    document.querySelectorAll('#gecNmModal input[name=gecNmMode]').forEach(r => r.checked = r.value === mode);
    document.querySelectorAll('#gecNmModal [data-c]').forEach(i => i.value = cfg.colors?.[i.dataset.c] || '#000000');
    document.querySelectorAll('#gecNmModal [data-t]').forEach(i => i.checked = cfg.ticker?.[i.dataset.t] !== false);
    $('#gecNmLabel').value = cfg.ticker?.label || 'ÚLTIMO'; $('#gecNmEvery').value = String(cfg.ticker?.every || 3);
    $('#gecNmMsgs').value = (cfg.ticker?.messages || []).join('\n');
    syncColorLock(); $('#gecNmBg').classList.add('show');
  }
  // al cambiar de perfil, la configuración es otra
  api.on('profile:changed', () => { load(); });
  new MutationObserver(() => { if (anchor() && !$('#gecNmRow')) render(); }).observe(document.documentElement, {childList: true, subtree: true});
  load(); setTimeout(render, 1500);
})();
