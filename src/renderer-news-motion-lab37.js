'use strict';
// Lab.37 · Ajustes de "Noticias con movimiento" (salida clásica), por perfil. Una fila compacta dentro de la tarjeta
// Transiciones de Diseño de emisión (no agrega una tarjeta nueva) y una ventana con los colores del movimiento, el ticker y
// (Lab.39) los sonidos de transición, cuyo volumen va en Audio y locución → Música y mezcla.
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
  #gecNmModal{background:#1a1a1a;border:1px solid #303030;border-radius:14px;width:min(1280px,100%);height:min(880px,94vh);display:flex;flex-direction:column;overflow:hidden;padding:18px;color:#fff}
  #gecNmModal .gec-nm-cols{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:18px;margin-top:8px}
  #gecNmModal .gec-nm-left{overflow:auto;padding-right:8px;min-height:0}
  #gecNmModal .gec-nm-right{display:flex;flex-direction:column;gap:8px;min-height:0}
  #gecNmModal .gec-nm-pbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  #gecNmModal .gec-nm-seg{display:inline-flex;border:1px solid #3a3a3a;border-radius:8px;overflow:hidden}
  #gecNmModal .gec-nm-seg button{background:#232323;color:#ddd;border:0;border-right:1px solid #3a3a3a;border-radius:0;padding:6px 11px;font-size:12px;font-weight:700;margin:0}
  #gecNmModal .gec-nm-seg button:last-child{border-right:0}
  #gecNmModal .gec-nm-seg button.on{background:#F7C600;color:#000}
  #gecNmModal .gec-nm-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:#000;border:1px solid #2a2a2a;border-radius:10px;overflow:hidden}
  #gecNmModal .gec-nm-stage iframe{border:0;display:block;width:100%;aspect-ratio:16/9;max-height:100%}
  #gecNmModal .gec-nm-stage.v iframe{width:auto;height:100%;aspect-ratio:9/16;max-width:100%}
  #gecNmModal .gec-nm-now{font-size:12px;color:#a9a9a9}
  #gecNmModal .gec-nm-now b{color:#fff}
  @media (max-width:980px){#gecNmModal{height:auto;max-height:94vh;overflow:auto}#gecNmModal .gec-nm-cols{grid-template-columns:1fr}#gecNmModal .gec-nm-right{order:-1}#gecNmModal .gec-nm-stage{min-height:240px}}
  #gecNmModal h3{margin:14px 0 6px;font-size:14px}
  #gecNmModal .gec-nm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 14px}
  #gecNmModal .gec-nm-color{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:#ddd}
  #gecNmModal .gec-nm-color input{width:46px;height:28px;padding:0;margin:0}
  #gecNmModal .gec-nm-color input:disabled{opacity:.5}
  #gecNmModal .gec-nm-check{display:flex;gap:8px;align-items:center;justify-content:flex-start;font-size:13px;color:#ddd;margin:4px 0;text-align:left}
  #gecNmModal input[type=checkbox],#gecNmModal input[type=radio]{width:16px;height:16px;flex:0 0 16px;margin:0;padding:0}
  #gecNmModal .gec-nm-color{margin:0}
  #gecNmModal textarea{width:100%;min-height:70px;resize:vertical}
  #gecNmModal .gec-nm-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
  #gecNmModal .gec-nm-try{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}
  #gecNmModal .gec-nm-try button{padding:5px 9px;font-size:12px}
  #gecNmModal small.gec-nm-hint{color:#8f8f8f;font-size:11px}
  #gecNmModal #gecNmSfx.off{opacity:.45;pointer-events:none}
  .gec-nm-obs{display:none;margin:8px 0 0;padding:7px 10px;border:1px solid #4b4020;background:#17150d;border-radius:8px;color:#e8dca8;font-size:12px;line-height:1.4}
  body.gec-nm-active .gec-nm-obs{display:block}
  body.gec-nm-active #imageAnimation,body.gec-nm-active #motionSpeed{opacity:.55}`;
  document.head.appendChild(css);

  const COLORS = [['bar1','Barras de transición · 1'],['bar2','Barras de transición · 2'],['bar3','Barras de transición · 3'],['voiceBg','Indicador de voz · fondo'],['voiceBars','Indicador de voz · barras'],['tickerBg','Etiqueta del ticker · fondo'],['tickerText','Etiqueta del ticker · texto']];
  function anchor(){ const t = $('#transitionType'); return t ? t.closest('.card') : null; }
  function render(){
    const card = anchor(); if (!card) return;
    if ($('#gecNmRow')) return;
    const row = document.createElement('div'); row.id = 'gecNmRow';
    row.innerHTML = `<label class="switch-row"><span><b>Noticias con movimiento</b><small>Salida clásica: planos en las pausas de la voz, datos clave, ticker y golpe de marca.</small></span><input id="gecNmOn" type="checkbox"><span class="switch-ui"></span></label>
      <div class="gec-nm-line"><span class="note" style="margin:0">Movimiento</span><select id="gecNmLevel"><option value="sobrio">Sobrio</option><option value="normal">Normal</option><option value="dinamico">Dinámico</option><option value="custom">Personalizado</option></select><button type="button" class="dark compact" id="gecNmOpen">Colores, ticker y sonidos…</button></div>`;
    card.appendChild(row);
    row.addEventListener('change', async e => { if (e.target.id === 'gecNmOn' || e.target.id === 'gecNmLevel') { const ok = await save({...cfg, enabled: $('#gecNmOn').checked, level: $('#gecNmLevel').value}); if (ok && e.target.id === 'gecNmLevel' && e.target.value === 'custom') openModal(); } });
    $('#gecNmOpen').addEventListener('click', openModal);
    fill();
  }
  function fill(){ fillMix(); syncDesignNotes(); if (!cfg || !$('#gecNmOn')) return; $('#gecNmOn').checked = cfg.enabled !== false; $('#gecNmLevel').value = cfg.level || 'normal'; }
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
      <p class="note">Las tipografías, los colores de sección, exclusivo, titular y el fondo del cintillo salen de este Diseño de emisión. Aquí solo van los colores propios del movimiento, el ticker y los sonidos. La vista previa muestra los cambios al instante; nada se guarda hasta tocar Guardar.</p>
      <div class="gec-nm-cols"><div class="gec-nm-left">
      <h3>Elementos</h3>
      <div class="gec-nm-grid">
        <label class="gec-nm-check"><input type="checkbox" data-k="facts"> Datos clave (cifras, personas, lugares)</label>
        <label class="gec-nm-check"><input type="checkbox" data-k="voice"> Indicador de voz</label>
        <label class="gec-nm-check"><input type="checkbox" data-k="progress"> Barra de progreso de la nota</label>
        <label class="gec-nm-check"><input type="checkbox" data-k="clock"> Reloj</label>
        <label class="gec-nm-check"><input type="checkbox" data-k="sting"> Golpe de marca entre noticias</label>
      </div>
      <h3>Movimiento</h3>
      <label class="gec-nm-check" style="gap:10px">Nivel <select id="gecNmLvl" style="width:auto"><option value="sobrio">Sobrio (planos de 9 s, fundido)</option><option value="normal">Normal (6 s, barrido)</option><option value="dinamico">Dinámico (4 s, barrido)</option><option value="custom">Personalizado</option></select></label>
      <div id="gecNmCustom">
        <p class="note" style="margin:6px 0 4px">Planos que se usan en cada noticia:</p>
        <div class="gec-nm-grid">
          <label class="gec-nm-check"><input type="checkbox" data-p="full"> Foto completa</label>
          <label class="gec-nm-check"><input type="checkbox" data-p="side"> Recuadro (foto al costado)</label>
          <label class="gec-nm-check"><input type="checkbox" data-p="zoom"> Detalle (acercamiento)</label>
          <label class="gec-nm-check"><input type="checkbox" data-p="dato"> Dato en grande</label>
        </div>
        <div class="gec-nm-grid" style="margin-top:6px">
          <label class="gec-nm-check" style="gap:10px">Cambiar de plano cada <select id="gecNmMin" style="width:auto">${[3,4,5,6,8,10,12,15].map(n => `<option value="${n}">${n} s o más</option>`).join('')}</select></label>
          <label class="gec-nm-check"><input type="radio" name="gecNmTr" value="wipe"> Con barrido</label>
          <label class="gec-nm-check"><input type="radio" name="gecNmTr" value="fade"> Con fundido</label>
        </div>
        <p class="note">Los cambios siempre caen en una pausa de la voz. Si apagas la foto completa, la noticia empieza con el primer plano marcado.</p>
      </div>
      <h3>Sonidos</h3>
      <label class="gec-nm-check"><input type="checkbox" id="gecNmSfxOn"> Efectos de sonido en las transiciones</label>
      <div id="gecNmSfx">
        <label class="gec-nm-check" style="gap:10px">Estilo <select id="gecNmSfxStyle" style="width:auto"><option value="suave">Suave (woosh corto, sin grave)</option><option value="normal">Normal</option><option value="marcado">Marcado (más largo y presente)</option></select></label>
        <div class="gec-nm-grid">
          <label class="gec-nm-check"><input type="checkbox" data-e="sting"> Golpe de marca entre noticias <small class="gec-nm-hint">woosh</small></label>
          <label class="gec-nm-check"><input type="checkbox" data-e="plane"> Cambios de plano <small class="gec-nm-hint">solo con barrido</small></label>
          <label class="gec-nm-check"><input type="checkbox" data-e="dato"> Dato en grande <small class="gec-nm-hint">golpe grave</small></label>
          <label class="gec-nm-check"><input type="checkbox" data-e="ex"> Exclusivo <small class="gec-nm-hint">impacto con brillo</small></label>
          <label class="gec-nm-check"><input type="checkbox" data-e="host"> Intervenciones de la vista clásica <small class="gec-nm-hint">woosh suave</small></label>
          <label class="gec-nm-check"><input type="checkbox" data-e="card"> Datos clave <small class="gec-nm-hint">clic, suena sobre la voz</small></label>
        </div>
        <div class="gec-nm-try"><span class="note" style="margin:0">Probar:</span>${[['sting','Golpe de marca'],['plane','Cambio de plano'],['dato','Dato'],['ex','Exclusivo'],['host','Intervención'],['card','Dato clave']].map(([k, l]) => `<button type="button" class="dark compact" data-try="${k}">${l}</button>`).join('')}</div>
        <p class="note">El volumen se ajusta en Audio y locución → Música y mezcla. Un mismo efecto no se repite antes de 3 s; el cambio de plano no suena justo después del golpe de marca. Los audios de voz para edición siguen siendo solo voz.</p>
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
      </div>
      <div class="gec-nm-right">
        <div class="gec-nm-pbar">
          <span class="gec-nm-seg" id="gecNmPStory"><button type="button" data-i="0" class="on">Noticia</button><button type="button" data-i="1">Con cifras</button><button type="button" data-i="2">Exclusiva</button></span>
          <span class="gec-nm-seg" id="gecNmPFmt"><button type="button" data-f="16:9" class="on">16:9</button><button type="button" data-f="9:16">9:16</button></span>
          <button type="button" class="dark compact" id="gecNmPRestart">⟲ Desde el inicio</button>
          <button type="button" class="dark compact" id="gecNmPSound">🔇 Sonido apagado</button>
        </div>
        <div class="gec-nm-stage" id="gecNmPStage"><iframe id="gecNmPFrame" title="Vista previa de Noticias con movimiento"></iframe></div>
        <div class="gec-nm-now">Plano: <b id="gecNmPPlane">—</b> · <span id="gecNmPTime">0:00</span> · La vista previa usa la salida real con tu Diseño; la voz va muda y las fotos son de ejemplo. Pasa sola a la siguiente noticia para mostrar el golpe de marca.</div>
      </div></div>
      <div class="gec-nm-foot"><button type="button" class="dark" id="gecNmCancel">Cancelar</button><button type="button" id="gecNmSave">Guardar</button></div>
    </div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
    bg.addEventListener('change', e => { if (e.target.name === 'gecNmMode') syncColorLock(); if (e.target.id === 'gecNmLvl') syncCustom(); if (e.target.id === 'gecNmSfxOn') syncSfx(); if (e.target.closest('.gec-nm-left')) schedulePreview(true); });
    bg.addEventListener('input', e => { if (e.target.closest('.gec-nm-left') && e.target.matches('input[type=color],input:not([type]),textarea')) schedulePreview(false); });
    $('#gecNmPStory').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pStory = Number(b.dataset.i) || 0; paintPreviewBar(); refreshPreview(true); });
    $('#gecNmPFmt').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pFmt = b.dataset.f; paintPreviewBar(); refreshPreview(true); });
    $('#gecNmPRestart').addEventListener('click', () => refreshPreview(true));
    $('#gecNmPSound').addEventListener('click', () => { pSound = !pSound; paintPreviewBar(); refreshPreview(false); });
    $('#gecNmPFrame').addEventListener('load', () => { if ($('#gecNmPFrame').getAttribute('src')) refreshPreview(true); });
    window.addEventListener('message', e => { const m = e.data; if (!m || m.type !== 'gec-nm-preview-state' || e.source !== $('#gecNmPFrame')?.contentWindow) return;
      if (m.index !== pStory) { pStory = m.index; paintPreviewBar(); }
      $('#gecNmPPlane').textContent = PLANE_NAME[m.plane] || (m.on ? '—' : 'Cintillo clásico (movimiento apagado)');
      const t = Math.floor(m.time || 0); $('#gecNmPTime').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; });
    bg.addEventListener('click', e => { const b = e.target.closest('[data-try]'); if (b) tryFx(b.dataset.try, $('#gecNmSfxStyle').value); });
    $('#gecNmCancel').addEventListener('click', closeModal);
    $('#gecNmSave').addEventListener('click', async () => {
      const b = $('#gecNmSave'); b.disabled = true;
      try {
        const next = draftFromModal();
        if (!Object.values(next.custom.planes).some(Boolean)) { alert('Marca al menos un plano.'); return; }
        if (await save(next)) closeModal();
      } finally { b.disabled = false; }
    });
  }
  // Lo que está en la ventana, sin guardar (para Guardar y para la vista previa)
  function draftFromModal(){
        const next = {...cfg, colors: {...(cfg.colors || {})}, ticker: {...(cfg.ticker || {})}};
        document.querySelectorAll('#gecNmModal [data-k]').forEach(i => next[i.dataset.k] = i.checked);
        next.level = $('#gecNmLvl').value;
        next.custom = {planes: {}, minSec: Number($('#gecNmMin').value) || 6, transition: document.querySelector('#gecNmModal input[name=gecNmTr]:checked')?.value === 'fade' ? 'fade' : 'wipe'};
        document.querySelectorAll('#gecNmModal [data-p]').forEach(i => next.custom.planes[i.dataset.p] = i.checked);
        next.colors.mode = document.querySelector('#gecNmModal input[name=gecNmMode]:checked')?.value === 'custom' ? 'custom' : 'auto';
        document.querySelectorAll('#gecNmModal [data-c]').forEach(i => next.colors[i.dataset.c] = i.value.toUpperCase());
        document.querySelectorAll('#gecNmModal [data-t]').forEach(i => next.ticker[i.dataset.t] = i.checked);
        next.ticker.label = $('#gecNmLabel').value; next.ticker.every = Number($('#gecNmEvery').value) || 3;
        next.ticker.messages = $('#gecNmMsgs').value.split(/\r?\n/);
        next.sfx = {...(cfg.sfx || {}), enabled: $('#gecNmSfxOn').checked, style: $('#gecNmSfxStyle').value, events: {...(cfg.sfx?.events || {})}};
        document.querySelectorAll('#gecNmModal [data-e]').forEach(i => next.sfx.events[i.dataset.e] = i.checked);
        return next;
  }
  // ---- Lab.40 · vista previa en vivo (output-news-motion-preview.html: la salida real con noticias de ejemplo)
  const PLANE_NAME = {full: 'Foto completa', side: 'Recuadro', zoom: 'Detalle', dato: 'Dato en grande'};
  let pStory = 0, pFmt = '16:9', pSound = false, pTimer = 0, pSeq = 0;
  function paintPreviewBar(){
    document.querySelectorAll('#gecNmPStory button').forEach(b => b.classList.toggle('on', Number(b.dataset.i) === pStory));
    document.querySelectorAll('#gecNmPFmt button').forEach(b => b.classList.toggle('on', b.dataset.f === pFmt));
    $('#gecNmPStage').classList.toggle('v', pFmt === '9:16');
    $('#gecNmPSound').textContent = pSound ? '🔊 Sonido encendido' : '🔇 Sonido apagado';
  }
  function schedulePreview(replay){ clearTimeout(pTimer); pTimer = setTimeout(() => refreshPreview(replay), replay ? 150 : 350); }
  async function refreshPreview(replay){
    const f = $('#gecNmPFrame'); if (!f || !$('#gecNmBg').classList.contains('show') || !f.getAttribute('src') || typeof api.newsMotionPreview !== 'function') return;
    const seq = ++pSeq, draft = draftFromModal();
    let r = null, d = {};
    try { r = await api.newsMotionPreview(draft); } catch {}
    try { const st = await api.getSettings(); d = (st && st.visual && st.visual.output) || {}; } catch {}
    if (seq !== pSeq || !r || !r.ok) return;
    const nm = {...r.config, sfx: {...(r.config.sfx || {}), enabled: pSound && r.config.sfx?.enabled !== false}};
    const msg = {type: 'gec-nm-preview', design: {...d, format: pFmt, newsMotion: nm}, stories: r.stories};
    if (replay) msg.play = pStory;
    try { f.contentWindow.postMessage(msg, '*'); } catch {}
  }
  function openPreview(){ const f = $('#gecNmPFrame'); paintPreviewBar(); if (f.getAttribute('src')) refreshPreview(true); else f.setAttribute('src', 'output-news-motion-preview.html'); }
  // al cerrar la ventana la vista previa se descarga (no gasta GPU ni suena en segundo plano)
  function closeModal(){ clearTimeout(pTimer); pSeq++; $('#gecNmBg').classList.remove('show'); const f = $('#gecNmPFrame'); if (f) f.removeAttribute('src'); try { f.src = 'about:blank'; f.removeAttribute('src'); } catch {} }
  function syncSfx(){ $('#gecNmSfx').classList.toggle('off', !$('#gecNmSfxOn').checked); }
  // «Probar»: suena en el panel con el estilo elegido y el volumen de Música y mezcla (no hace falta guardar)
  let tester = null;
  function tryFx(k, style){ try { tester = tester || window.GECSfx?.create(); if (!tester) return; tester.setConfig({style, volume: cfg?.sfx?.volume ?? 45}); tester.test(k); } catch {} }

  // Lab.39 · Volumen de los efectos en Audio y locución → Música y mezcla, junto a música, locución y videos
  function renderMix(){
    const cv = $('#cannedVolume'), grid = cv && cv.closest('label')?.parentElement; if (!grid || $('#gecNmSfxVol')) return;
    const l = document.createElement('label'); l.id = 'gecNmSfxVolBox';
    l.innerHTML = `Volumen efectos de transición<input id="gecNmSfxVol" type="range" min="0" max="100" step="1"><span id="gecNmSfxVolValue" class="range-value">45%</span>`;
    grid.appendChild(l); grid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
    const r = $('#gecNmSfxVol');
    r.addEventListener('input', () => { $('#gecNmSfxVolValue').textContent = r.value + '%'; });
    r.addEventListener('change', async () => { if (!cfg) return; if (await save({...cfg, sfx: {...(cfg.sfx || {}), volume: Number(r.value)}})) tryFx('sting', cfg.sfx?.style || 'normal'); });
    fillMix();
  }
  function fillMix(){ const r = $('#gecNmSfxVol'); if (!r || !cfg) return; const v = cfg.sfx?.volume ?? 45; r.value = String(v); $('#gecNmSfxVolValue').textContent = v + '%'; r.title = cfg.sfx?.enabled === false ? 'Los efectos están apagados en Noticias con movimiento → Colores, ticker y sonidos' : ''; }

  // Lab.39 · Opciones del Diseño que cambian de efecto con Noticias con movimiento activado (salida clásica)
  function obsNote(id, text, where){ if ($('#' + id) || !where) return; const d = document.createElement('div'); d.id = id; d.className = 'gec-nm-obs'; d.textContent = text; where(d); }
  function syncDesignNotes(){
    const tr = $('#transitionEnabled')?.closest('label')?.querySelector('small');
    if (tr) tr.textContent = 'Se aplica entre noticias y contenidos o anuncios.';
    const anim = $('#imageAnimation')?.closest('label');
    obsNote('gecNmObsAnim', 'Con Noticias con movimiento activado, la salida clásica usa el movimiento propio de cada plano: «Animación de imagen» y «Velocidad» solo se aplican a Merlín.', d => anim?.parentElement?.insertAdjacentElement('afterend', d));
    obsNote('gecNmObsPrev', 'Al aire, con Noticias con movimiento activado, este cintillo se reemplaza por los planos del movimiento, con estos mismos colores y tipografías.', d => $('#designPreview')?.insertAdjacentElement('beforebegin', d));
    obsNote('gecNmObsTr', 'Con Noticias con movimiento activado, entre noticia y noticia va el golpe de marca (o un fundido propio si está apagado); este fundido queda para contenidos y anuncios.', d => $('#transitionDuration')?.closest('label')?.insertAdjacentElement('afterend', d));
    document.body.classList.toggle('gec-nm-active', !!cfg && cfg.enabled !== false);
  }
  function syncCustom(){ $('#gecNmCustom').style.display = $('#gecNmLvl').value === 'custom' ? '' : 'none'; }
  function syncColorLock(){ const custom = document.querySelector('#gecNmModal input[name=gecNmMode]:checked')?.value === 'custom'; document.querySelectorAll('#gecNmModal [data-c]').forEach(i => i.disabled = !custom); }
  async function openModal(){
    await load(); if (!cfg) return; ensureModal();
    document.querySelectorAll('#gecNmModal [data-k]').forEach(i => i.checked = cfg[i.dataset.k] !== false);
    $('#gecNmLvl').value = cfg.level || 'normal'; const cu = cfg.custom || {};
    document.querySelectorAll('#gecNmModal [data-p]').forEach(i => i.checked = cu.planes?.[i.dataset.p] !== false);
    $('#gecNmMin').value = String(cu.minSec || 6); document.querySelectorAll('#gecNmModal input[name=gecNmTr]').forEach(r => r.checked = r.value === (cu.transition === 'fade' ? 'fade' : 'wipe')); syncCustom();
    const mode = cfg.colors?.mode === 'custom' ? 'custom' : 'auto';
    document.querySelectorAll('#gecNmModal input[name=gecNmMode]').forEach(r => r.checked = r.value === mode);
    document.querySelectorAll('#gecNmModal [data-c]').forEach(i => i.value = cfg.colors?.[i.dataset.c] || '#000000');
    document.querySelectorAll('#gecNmModal [data-t]').forEach(i => i.checked = cfg.ticker?.[i.dataset.t] !== false);
    $('#gecNmLabel').value = cfg.ticker?.label || 'ÚLTIMO'; $('#gecNmEvery').value = String(cfg.ticker?.every || 3);
    $('#gecNmMsgs').value = (cfg.ticker?.messages || []).join('\n');
    const fx = cfg.sfx || {}; $('#gecNmSfxOn').checked = fx.enabled !== false; $('#gecNmSfxStyle').value = fx.style || 'normal';
    document.querySelectorAll('#gecNmModal [data-e]').forEach(i => i.checked = fx.events?.[i.dataset.e] === true); syncSfx();
    syncColorLock(); $('#gecNmBg').classList.add('show'); openPreview();
  }
  // al cambiar de perfil, la configuración es otra
  api.on('profile:changed', () => { load(); });
  new MutationObserver(() => { if (anchor() && !$('#gecNmRow')) render(); if ($('#cannedVolume') && !$('#gecNmSfxVol')) renderMix(); if (cfg && $('#imageAnimation') && !$('#gecNmObsAnim')) syncDesignNotes(); }).observe(document.documentElement, {childList: true, subtree: true});
  load(); setTimeout(render, 1500);
})();
