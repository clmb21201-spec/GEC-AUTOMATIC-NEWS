'use strict';
// Lab.38 · Panel de las intervenciones de la vista clásica, por perfil. Una fila compacta dentro de la tarjeta Transiciones
// de Diseño de emisión (activar + Editar…) y una ventana con pestañas: Identidad, Intervenciones, Frases, Cierre y Fondo,
// con la vista previa animada a la derecha (output-classic-host-preview.html, el mismo motor que la salida).
(function installClassicHostPanelLab38(){
  if (window.__gecClassicHostPanelLab38) return; window.__gecClassicHostPanelLab38 = true;
  const api = window.ECAPI;
  if (!api || typeof api.classicHostGet !== 'function') return;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let view = null, draft = null, tab = 'id', seg = 'intro', phraseKey = 'intro', fmt = 'h', design = {};
  const SEGS = [['intro','Presentación'],['tit','Titulares'],['pase','Pase a corte'],['reg','Regreso'],['desp','Despedida']];
  const VARS = {
    intro: [['Saludo en movimiento','Barras de color, el saludo en grande y luego EN VIVO con el programa.'],['En vivo con fotos','Fotos de las próximas noticias, sello EN VIVO y cintillo con el saludo.'],['Cuenta regresiva','3, 2, 1, un destello y aparece EN VIVO con el logo.']],
    tit: [['Lista','Los titulares entran en cascada; se resalta el que se lee.'],['Carrusel','Un titular a la vez en una tarjeta grande con foto.'],['Mosaico','Fichas con foto; la que se lee crece.']],
    pase: [['A continuación','Tarjeta con la miniatura del contenido que viene.'],['Cuenta regresiva','Anillo que se vacía con el número y la miniatura.'],['Telón','Dos paneles se cierran y una cinta anuncia lo que viene.']],
    reg: [['Seguimos','Fundido con el programa y la próxima noticia.'],['Zoom','«SEGUIMOS» llega desde grande y sube un cintillo.'],['Línea','Una línea se abre desde el centro y separa el texto.']],
    desp: [['Logo y redes','Logo, «Hasta pronto» y las redes en cascada.'],['Créditos','Los créditos suben: programa, redes, próxima emisión.'],['Contracción al logo','El fondo se encoge hasta el logo y aparece «Hasta pronto».']]
  };
  const PH = [['intro','Presentación'],['titulares_intro','Titulares (entrada)'],['pase','Pase a corte'],['regreso','Regreso'],['despedida','Despedida']];
  const PH_OF_SEG = {intro:'intro',tit:'titulares_intro',pase:'pase',reg:'regreso',desp:'despedida'};

  const css = document.createElement('style');
  css.textContent = `
  #gecChRow{margin-top:12px;padding-top:12px;border-top:1px solid #303030}
  #gecChRow .gec-ch-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  #gecChBg{position:fixed;inset:0;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center;z-index:9999;padding:14px}
  #gecChBg.show{display:flex}
  #gecChModal{background:#1a1a1a;border:1px solid #303030;border-radius:14px;width:min(1180px,100%);height:min(760px,94vh);display:grid;grid-template-rows:auto 1fr auto;color:#fff;overflow:hidden}
  #gecChModal .gec-ch-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #303030}
  #gecChModal .gec-ch-head h3{margin:0;font-size:16px}
  #gecChModal .gec-ch-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);min-height:0}
  #gecChModal .gec-ch-left{display:grid;grid-template-rows:auto 1fr;min-height:0;border-right:1px solid #303030}
  #gecChModal .gec-ch-tabs{display:flex;gap:4px;padding:10px 14px 0;flex-wrap:wrap}
  #gecChModal .gec-ch-tabs button{background:#232323;border:1px solid #333;color:#ddd;border-radius:8px 8px 0 0;padding:7px 12px;font-weight:700;font-size:13px;width:auto;margin:0}
  #gecChModal .gec-ch-tabs button.on{background:#F7C600;color:#000;border-color:#F7C600}
  #gecChModal .gec-ch-pane{overflow:auto;padding:14px 16px;border-top:1px solid #303030}
  #gecChModal label{margin:0;color:#ddd;font-size:13px}
  #gecChModal input,#gecChModal select,#gecChModal textarea{margin:0}
  #gecChModal input[type=checkbox],#gecChModal input[type=radio]{width:16px;height:16px;flex:0 0 16px;padding:0}
  #gecChModal .gec-f{display:block;margin:12px 0 5px;color:#b5b5b5;font-size:12px;font-weight:700}
  #gecChModal .gec-ck{display:flex;gap:8px;align-items:center;font-size:13px;color:#ddd;margin:6px 0}
  #gecChModal .gec-hint{font-size:12px;color:#9a9a9a;line-height:1.45;margin:8px 0 0}
  #gecChModal .gec-logo{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  #gecChModal .gec-logo .box{width:120px;height:74px;border-radius:10px;display:grid;place-items:center;overflow:hidden;border:1px solid #333}
  #gecChModal .gec-logo .dk{background:#0b1d30}#gecChModal .gec-logo .lt{background:#e9e9e9}
  #gecChModal .gec-logo img{max-width:88%;max-height:80%;object-fit:contain}
  #gecChModal .gec-logo .ini{color:#000;background:#F7C600;font-weight:900;border-radius:8px;width:52px;height:52px;display:grid;place-items:center;font-size:20px}
  #gecChModal .gec-seg{border:1px solid #303030;border-radius:10px;padding:10px;margin-bottom:8px;cursor:pointer}
  #gecChModal .gec-seg.sel{border-color:#F7C600}
  #gecChModal .gec-seg .top{display:flex;gap:8px;align-items:center;justify-content:space-between}
  #gecChModal .gec-seg .vs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}
  #gecChModal .gec-seg .vs button{background:#232323;border:1px solid #333;color:#ddd;border-radius:8px;padding:6px 8px;text-align:left;font-size:12px;width:auto;margin:0;line-height:1.3}
  #gecChModal .gec-seg .vs button b{display:block;font-size:12px;color:#fff}
  #gecChModal .gec-seg .vs button.on{border-color:#F7C600;background:#2a2405}#gecChModal .gec-seg .vs button.on b{color:#F7C600}
  #gecChModal .gec-seg.off .vs{opacity:.45}
  #gecChModal .gec-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  #gecChModal .gec-ph{display:flex;gap:6px;margin:6px 0}#gecChModal .gec-ph input{flex:1;min-width:0}
  #gecChModal .gec-ph button,#gecChModal .gec-mini{width:auto;margin:0;padding:6px 10px;font-size:12px}
  #gecChModal .gec-soc{display:grid;grid-template-columns:140px 1fr;gap:6px;margin-bottom:6px}
  #gecChModal .gec-ch-right{display:grid;grid-template-rows:auto 1fr auto;min-height:0;padding:12px 14px;gap:8px}
  #gecChModal .gec-ch-right .bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  #gecChModal .gec-ch-right .bar button{width:auto;margin:0;padding:6px 10px;font-size:12px;background:#232323;color:#ddd;border:1px solid #333}
  #gecChModal .gec-ch-right .bar #gecChPlay{background:#F7C600;color:#000;border-color:#F7C600}
  #gecChModal .gec-ch-right .bar button.on{background:#F7C600;color:#000}
  #gecChModal iframe{width:100%;height:100%;border:0;border-radius:10px;background:#000}
  #gecChModal .gec-ch-foot{display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:12px 18px;border-top:1px solid #303030}
  #gecChModal .gec-ch-foot .note{margin:0 auto 0 0}`;
  document.head.appendChild(css);

  // ---------------------------------------------------------------- fila en Transiciones
  function anchor(){ const t = $('#transitionType'); return t ? t.closest('.card') : null; }
  function render(){
    const card = anchor(); if (!card || $('#gecChRow')) return;
    const row = document.createElement('div'); row.id = 'gecChRow';
    row.innerHTML = `<label class="switch-row"><span><b>Intervenciones de la vista clásica</b><small>Presentación, titulares, pase a corte, regreso y despedida con la voz del perfil.</small></span><input id="gecChOn" type="checkbox"><span class="switch-ui"></span></label>
      <div class="gec-ch-line"><span class="note" id="gecChSum" style="margin:0"></span><button type="button" class="dark compact" id="gecChOpen">Editar…</button></div>`;
    card.appendChild(row);
    $('#gecChOn').addEventListener('change', async e => { if (!view) await load(); const r = await api.classicHostSet({...view.config, enabled: e.target.checked}); if (r?.ok) { view = r; fill(); } });
    $('#gecChOpen').addEventListener('click', openModal);
    fill();
  }
  function fill(){
    if (!view || !$('#gecChOn')) return; const c = view.config;
    $('#gecChOn').checked = c.enabled !== false;
    const on = SEGS.filter(([k]) => c.segs[k]).map(([k, l]) => `${l} ${c.versions[k]}`);
    $('#gecChSum').textContent = c.enabled ? (on.length ? on.join(' · ') : 'Ninguna activada') : 'Desactivadas';
  }
  async function load(){ try { const r = await api.classicHostGet(); if (r?.ok) { view = r; fill(); } } catch {} try { const s = await api.getSettings(); design = s?.visual?.output || {}; } catch {} }

  // ---------------------------------------------------------------- ventana
  function ensureModal(){
    if ($('#gecChBg')) return;
    const bg = document.createElement('div'); bg.id = 'gecChBg';
    bg.innerHTML = `<div id="gecChModal" role="dialog" aria-modal="true" aria-label="Intervenciones de la vista clásica">
      <div class="gec-ch-head"><h3 id="gecChTitle">Intervenciones · este perfil</h3><button type="button" class="dark compact" id="gecChX">✕</button></div>
      <div class="gec-ch-body">
        <div class="gec-ch-left"><div class="gec-ch-tabs">${[['id','Identidad'],['seg','Intervenciones'],['ph','Frases'],['cl','Cierre'],['bg','Fondo']].map(([k, l]) => `<button type="button" data-tab="${k}">${l}</button>`).join('')}</div><div class="gec-ch-pane" id="gecChPane"></div></div>
        <div class="gec-ch-right"><div class="bar"><button type="button" id="gecChPlay">▶ Reproducir</button><button type="button" data-fmt="h">16:9</button><button type="button" data-fmt="v">9:16</button><span class="note" id="gecChPrevLbl" style="margin:0 0 0 auto"></span></div>
          <iframe id="gecChFrame" src="output-classic-host-preview.html" title="Vista previa"></iframe>
          <p class="gec-hint">Vista previa con titulares de ejemplo. En la emisión salen las noticias reales, tu voz y el fondo elegido.</p></div>
      </div>
      <div class="gec-ch-foot"><span class="note" id="gecChMsg"></span><button type="button" class="dark" id="gecChCancel">Cancelar</button><button type="button" id="gecChSave">Guardar</button></div>
    </div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    $('#gecChX').onclick = close; $('#gecChCancel').onclick = close;
    $$('#gecChModal [data-tab]').forEach(b => b.onclick = () => { collect(); tab = b.dataset.tab; paint(); });
    $$('#gecChModal [data-fmt]').forEach(b => b.onclick = () => { fmt = b.dataset.fmt; paintBar(); preview(); });
    $('#gecChPlay').onclick = () => { collect(); preview(); };
    $('#gecChFrame').addEventListener('load', () => preview());
    $('#gecChSave').onclick = save;
    $('#gecChPane').addEventListener('click', onPaneClick);
    $('#gecChPane').addEventListener('change', () => { collect(); if (tab === 'seg' || tab === 'cl' || tab === 'id' || tab === 'bg') preview(); });
  }
  function close(){ $('#gecChBg')?.classList.remove('show'); }
  async function openModal(){
    await load(); if (!view) return; ensureModal();
    draft = JSON.parse(JSON.stringify(view.config)); draft._logoUrl = view.logoUrl; draft._bgUrl = view.backgroundUrl; draft._next = view.nextEmission;
    if (!draft.program) draft.program = '';
    $('#gecChTitle').textContent = `Intervenciones de la vista clásica · perfil ${view.profile}`;
    tab = 'id'; paint(); $('#gecChBg').classList.add('show'); setTimeout(preview, 300);
  }
  function paintBar(){ $$('#gecChModal [data-fmt]').forEach(b => b.classList.toggle('on', b.dataset.fmt === fmt)); const s = SEGS.find(x => x[0] === seg); $('#gecChPrevLbl').textContent = `${s[1]} · ${draft.versions[seg]}`; }
  function paint(){
    $$('#gecChModal [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const p = $('#gecChPane'), c = draft;
    if (tab === 'id') p.innerHTML = `
      <span class="gec-f">Logo del programa</span>
      <div class="gec-logo"><div class="box dk">${c._logoUrl ? `<img src="${esc(c._logoUrl)}" alt="">` : `<span class="ini">${esc(ini(c.program))}</span>`}</div><div class="box lt">${c._logoUrl ? `<img src="${esc(c._logoUrl)}" alt="">` : `<span class="ini">${esc(ini(c.program))}</span>`}</div>
        <div><button type="button" class="dark compact" data-act="logo">Subir logo…</button> <button type="button" class="dark compact" data-act="clearlogo">Quitar</button></div></div>
      <p class="gec-hint">Cuadrado u horizontal: el programa ajusta la caja a la proporción del logo (hasta 3:1). Ideal PNG con fondo transparente o SVG, de 600 px o más en el lado largo. Sin logo se usan las iniciales.</p>
      <label class="gec-f" for="gecChProg">Nombre del programa</label><input id="gecChProg" maxlength="60" value="${esc(c.program)}" placeholder="Noticias al Día">
      <p class="gec-hint">Aparece en la Presentación, el Regreso, la Despedida y en el logo chico de las demás placas. La voz lo dice donde la frase tenga {programa}.</p>`;
    if (tab === 'seg') p.innerHTML = SEGS.map(([k, l]) => `<div class="gec-seg${seg === k ? ' sel' : ''}${c.segs[k] ? '' : ' off'}" data-seg="${k}"><div class="top"><label class="gec-ck"><input type="checkbox" data-segon="${k}"${c.segs[k] ? ' checked' : ''}> <b>${l}</b></label></div>
        <div class="vs">${VARS[k].map((x, i) => { const L = 'ABC'[i]; return `<button type="button" data-v="${k}:${L}" class="${c.versions[k] === L ? 'on' : ''}"><b>${L} · ${x[0]}</b>${x[1]}</button>`; }).join('')}</div>
        ${k === 'tit' ? `<div class="gec-row2" style="margin-top:8px"><label>Cada<select id="gecChTitEvery">${[15,20,25,30,45,60].map(n => `<option value="${n}"${c.titulares.everyMin === n ? ' selected' : ''}>${n} minutos</option>`).join('')}</select></label><label>Cantidad<select id="gecChTitCount">${[3,4,5].map(n => `<option value="${n}"${c.titulares.count === n ? ' selected' : ''}>${n} titulares</option>`).join('')}</select></label></div>` : ''}</div>`).join('');
    if (tab === 'ph') { const list = c.phrases[phraseKey] || [];
      p.innerHTML = `<label class="gec-f">Intervención<select id="gecChPhKey">${PH.map(([k, l]) => `<option value="${k}"${k === phraseKey ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <div id="gecChPhList">${list.map((t, i) => `<div class="gec-ph"><input data-ph="${i}" value="${esc(t)}" maxlength="240"><button type="button" class="dark" data-act="speak" data-i="${i}">▶ Escuchar</button><button type="button" class="dark" data-act="delph" data-i="${i}">✕</button></div>`).join('')}</div>
        <button type="button" class="dark compact" data-act="addph">+ Agregar frase</button>
        <p class="gec-hint">Si hay varias, se alternan. Comodines: <b>{saludo}</b> (buenos días / tardes / noches), <b>{programa}</b>, <b>{dia}</b> (martes 13 de octubre) y <b>{hora}</b> («son las ocho y diez de la noche»; solo en Presentación y Despedida, porque esa frase se genera en el momento). Merlín conserva sus propias frases.</p>
        <audio id="gecChAudio" style="display:none"></audio>`; }
    if (tab === 'cl') p.innerHTML = `
      <label class="gec-f" for="gecChBig">Texto grande (versiones A, B y C)</label><input id="gecChBig" maxlength="40" value="${esc(c.closing.big)}">
      <label class="gec-f" for="gecChThanks">Agradecimiento (versión B)</label><input id="gecChThanks" maxlength="60" value="${esc(c.closing.thanks)}">
      <span class="gec-f">Redes y enlaces (hasta 3; versiones A y B)</span>
      ${[0,1,2].map(i => `<div class="gec-soc"><input data-soc="${i}:0" maxlength="24" placeholder="Síguenos" value="${esc(c.closing.social[i]?.[0] || '')}"><input data-soc="${i}:1" maxlength="60" placeholder="@tuprograma" value="${esc(c.closing.social[i]?.[1] || '')}"></div>`).join('')}
      <span class="gec-f">Próxima emisión (versiones A y B)</span>
      <label class="gec-ck"><input type="radio" name="gecChNext" value="schedule"${c.closing.nextMode === 'schedule' ? ' checked' : ''}> Tomarla del Horario automático ${c._next ? `(ahora: <b>${esc(c._next)}</b>)` : '(no hay una próxima franja con «Emitir»)'}</label>
      <label class="gec-ck"><input type="radio" name="gecChNext" value="text"${c.closing.nextMode === 'text' ? ' checked' : ''}> Escribirla: <input id="gecChNextText" maxlength="40" style="flex:1" value="${esc(c.closing.nextText)}" placeholder="Hoy · 6:00 PM"></label>
      <label class="gec-ck"><input type="radio" name="gecChNext" value="none"${c.closing.nextMode === 'none' ? ' checked' : ''}> No mostrar</label>`;
    if (tab === 'bg') p.innerHTML = `
      <span class="gec-f">Fondo de las intervenciones (de este perfil)</span>
      <label class="gec-ck"><input type="radio" name="gecChBgMode" value="standby"${c.background.mode === 'standby' ? ' checked' : ''}> Video de espera del perfil (el mismo de la salida en reposo)</label>
      <label class="gec-ck"><input type="radio" name="gecChBgMode" value="anim"${c.background.mode === 'anim' ? ' checked' : ''}> Fondo animado con los colores del perfil</label>
      <label class="gec-ck"><input type="radio" name="gecChBgMode" value="custom"${c.background.mode === 'custom' ? ' checked' : ''}${c._bgUrl ? '' : ' disabled'}> Imagen o video propio${c._bgUrl ? `: <b>${esc(decodeURIComponent(c._bgUrl.split('/').pop() || ''))}</b>` : ' (elige un archivo)'}</label>
      <div style="margin:6px 0 0 24px"><button type="button" class="dark compact" data-act="bgfile">Elegir archivo…</button> <button type="button" class="dark compact" data-act="clearbg">Quitar</button></div>
      <span class="gec-f">Música durante las intervenciones</span>
      <label class="gec-ck"><input type="radio" name="gecChMusic" value="low"${c.music !== 'none' ? ' checked' : ''}> La música de fondo de la emisión, más baja</label>
      <label class="gec-ck"><input type="radio" name="gecChMusic" value="none"${c.music === 'none' ? ' checked' : ''}> Sin música</label>`;
    paintBar();
  }
  const ini = p => String(p || 'Noticias').split(/\s+/).filter(w => w.length > 2).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'N';
  function collect(){
    if (!draft) return; const c = draft, v = id => $(id)?.value;
    if (tab === 'id' && $('#gecChProg')) c.program = v('#gecChProg').trim();
    if (tab === 'seg') { $$('#gecChModal [data-segon]').forEach(i => c.segs[i.dataset.segon] = i.checked); if ($('#gecChTitEvery')) { c.titulares.everyMin = +v('#gecChTitEvery'); c.titulares.count = +v('#gecChTitCount'); } }
    if (tab === 'ph' && $('#gecChPhList')) c.phrases[phraseKey] = $$('#gecChModal [data-ph]').map(i => i.value.trim()).filter(Boolean);
    if (tab === 'cl' && $('#gecChBig')) { c.closing.big = v('#gecChBig'); c.closing.thanks = v('#gecChThanks'); c.closing.social = [0,1,2].map(i => [v(`[data-soc="${i}:0"]`) || '', v(`[data-soc="${i}:1"]`) || '']).filter(x => x[1].trim()); c.closing.nextMode = document.querySelector('input[name=gecChNext]:checked')?.value || 'schedule'; c.closing.nextText = v('#gecChNextText') || ''; }
    if (tab === 'bg' && document.querySelector('input[name=gecChBgMode]')) { c.background.mode = document.querySelector('input[name=gecChBgMode]:checked')?.value || 'anim'; c.music = document.querySelector('input[name=gecChMusic]:checked')?.value || 'low'; }
  }
  async function onPaneClick(e){
    const t = e.target.closest('button,[data-seg]'); if (!t) return;
    if (t.dataset.v) { const [k, L] = t.dataset.v.split(':'); collect(); draft.versions[k] = L; seg = k; paint(); preview(); return; }
    if (t.dataset.seg && !e.target.closest('input')) { collect(); seg = t.dataset.seg; paint(); preview(); return; }
    const act = t.dataset.act; if (!act) return; collect();
    if (act === 'addph') { (draft.phrases[phraseKey] = draft.phrases[phraseKey] || []).push(''); paint(); $$('#gecChModal [data-ph]').pop()?.focus(); return; }
    if (act === 'delph') { draft.phrases[phraseKey].splice(+t.dataset.i, 1); paint(); return; }
    if (act === 'speak') { const text = draft.phrases[phraseKey][+t.dataset.i]; if (!text) return; t.disabled = true; msg('Generando la voz…');
      try { const r = await api.classicHostSpeak(text); if (r?.ok) { const a = $('#gecChAudio'); a.src = r.url; a.play().catch(() => {}); msg(`«${r.text}»`); } else msg(r?.error || 'No se pudo generar la voz.'); } finally { t.disabled = false; } return; }
    const assets = {logo: 'classicHostPickLogo', clearlogo: 'classicHostClearAsset', bgfile: 'classicHostPickBackground', clearbg: 'classicHostClearAsset'};
    if (assets[act]) { const r = act.startsWith('clear') ? await api.classicHostClearAsset(act === 'clearlogo' ? 'logo' : 'background') : await api[assets[act]]();
      if (r?.ok) { view = r; draft._logoUrl = r.logoUrl; draft._bgUrl = r.backgroundUrl; draft.logo = r.config.logo; draft.background.file = r.config.background.file; if (act === 'bgfile') draft.background.mode = 'custom'; if (act === 'clearbg' && draft.background.mode === 'custom') draft.background.mode = 'anim'; paint(); preview(); }
      else if (r && !r.canceled) msg(r.error || 'No se pudo usar el archivo.'); }
  }
  $('body') && document.addEventListener('change', e => { if (e.target.id === 'gecChPhKey') { collect(); phraseKey = e.target.value; paint(); } });
  function msg(t){ const m = $('#gecChMsg'); if (m) m.textContent = t; }
  function fillText(t){ const d = new Date(), h = d.getHours(), prog = draft.program || 'el noticiero';
    return String(t || '').replace(/\{saludo\}/g, h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches').replace(/\{programa\}/g, prog).replace(/\{dia\}/g, d.toLocaleDateString('es-PE', {weekday: 'long', day: 'numeric', month: 'long'})).replace(/\{hora\}/g, 'son las ' + (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0')); }
  function preview(){
    const f = $('#gecChFrame'); if (!f?.contentWindow || !draft) return;
    const L = draft.versions[seg] || 'A', text = fillText((draft.phrases[PH_OF_SEG[seg]] || [])[0] || '') + (seg === 'tit' ? ' Titular uno. Titular dos. Titular tres.' : '');
    const m = {type: 'gec-classic-host-preview', seg, v: 'ABC'.indexOf(L), fmt, tt: fmt === 'v' && !!design.tiktokSafe, count: draft.titulares.count, text,
      colors: {catBg: design.categoryBgColor || '#F7C600', catTx: design.categoryTextColor || '#000000', font: design.titleFontFamily || design.fontFamily || ''},
      data: {program: draft.program || 'Noticias', logoUrl: draft._logoUrl || '', closing: draft.closing, nextEmission: draft.closing.nextMode === 'text' ? draft.closing.nextText : draft.closing.nextMode === 'none' ? '' : draft._next || '',
        bg: {mode: draft.background.mode, url: draft._bgUrl || '', video: /\.(mp4|webm|mov|m4v)$/i.test(draft._bgUrl || ''), standbyUrl: design.standbyVideoUrl || ''}}};
    try { f.contentWindow.postMessage(m, '*'); } catch {}
    paintBar();
  }
  async function save(){
    collect(); const b = $('#gecChSave'); b.disabled = true;
    try { const {_logoUrl, _bgUrl, _next, ...cfg} = draft; const r = await api.classicHostSet(cfg); if (r?.ok) { view = r; fill(); close(); } else msg(r?.error || 'No se pudo guardar.'); }
    finally { b.disabled = false; }
  }
  api.on('profile:changed', () => { load(); });
  new MutationObserver(() => { if (anchor() && !$('#gecChRow')) render(); }).observe(document.documentElement, {childList: true, subtree: true});
  load(); setTimeout(render, 1500);
})();
