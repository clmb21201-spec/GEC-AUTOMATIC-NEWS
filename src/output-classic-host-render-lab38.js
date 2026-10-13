'use strict';
// Lab.38 · Motor de las placas de intervención de la vista clásica (las 15 versiones de la maqueta aprobada).
// Lo usan la salida (output-classic-host-lab38.js) y la vista previa del panel (output-classic-host-preview.html).
// mount(root,{seg,v,fmt,tt,data}) dibuja la placa dentro de root (#chLayer) y devuelve {update(t),destroy()}; update recibe
// el segundo de la voz y mueve subtítulos, titular resaltado, carrusel y cuenta regresiva.
// seg: intro | tit | pase | reg | desp · v: 0 (A) | 1 (B) | 2 (C) · fmt: h | v · tt: zonas seguras de TikTok en 9:16.
(function(){
  if (window.GECClassicHostRender) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TH = ['linear-gradient(135deg,#1f6f3f,#0b2a18)','linear-gradient(135deg,#7a1f2b,#2a0b10)','linear-gradient(135deg,#1f4f7a,#0b1d2a)','linear-gradient(135deg,#7a5c1f,#2a1f0b)','linear-gradient(135deg,#4a1f7a,#160b2a)'];
  const saludo = (d = new Date()) => { const h = d.getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
  const hora = (d = new Date()) => { let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${m} ${ap}`; };
  const fecha = (d = new Date()) => d.toLocaleDateString('es-PE', {weekday: 'long', day: 'numeric', month: 'long'});
  const words = s => esc(s).split(/\s+/).filter(Boolean).map(w => `<span class="word">${w}</span>`).join(' ');
  // va dentro de style="…": la URL entre comillas simples y sin caracteres que corten el atributo
  const bgImg = (url, i) => url ? `background-image:url('${String(url).replace(/['"()\s<>]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))}')` : `background:${TH[i % TH.length]}`;
  const cleanName = t => String(t || '').replace(/\.(mp4|mov|m4v|webm|mkv|avi)$/i, '').replace(/[_]+/g, ' ').trim();

  function mount(root, {seg = 'intro', v = 0, fmt = 'h', tt = false, data = {}} = {}){
    const D = data || {}, prog = String(D.program || 'Noticias').trim(), P = esc(prog), C = D.closing || {};
    const heads = (Array.isArray(D.heads) && D.heads.length ? D.heads : []).slice(0, 5).map(h => ({title: String(h.title || ''), category: String(h.category || '').toUpperCase(), image: h.image || ''}));
    const H = heads.length ? heads : [{title: '', category: '', image: ''}];
    const next = D.next || {}, nextTitle = cleanName(next.title) || (heads[0]?.title || '');
    const ini = prog.split(/\s+/).filter(w => w.length > 2).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'N';
    const logoCls = D.logoUrl ? ' img' : '', markInner = D.logoUrl ? `<img src="${esc(D.logoUrl)}" alt="">` : esc(ini);
    const bug = `<div class="bug"><div class="m${logoCls}">${markInner}</div>${esc(prog.toUpperCase())}</div><div class="clock">${hora()}</div>`;
    const nextEm = String(D.nextEmission || '');
    const social = (Array.isArray(C.social) ? C.social : []).filter(x => x && x[1]);
    const big = String(C.big || 'Hasta pronto'), thanks = C.thanks == null ? 'Gracias por acompañarnos' : String(C.thanks);
    const nextThumb = next.videoUrl ? `<video muted preload="metadata" playsinline src="${esc(String(next.videoUrl).split('#')[0])}#t=3"></video>` : '';
    const nextStyle = next.videoUrl ? 'background:#111' : bgImg(next.image || heads[0]?.image, 2);
    let html = '';
    if (seg === 'intro') {
      if (v === 0) html = `${bug}<div class="bars"><i></i><i></i><i></i></div><div class="layer center iA"><div class="gw">${esc(saludo().toUpperCase()).split(/\s+/).map((w, i) => `<span class="ln"><b style="animation-delay:${.75 + i * .28}s">${w}</b></span>`).join('')}</div><div class="fin"><div class="live"><i></i>EN VIVO</div><div class="pname">${words(prog)}</div><div class="ul"></div><div class="tag">${esc(fecha())}<span class="sep"> · </span><br class="vbr">${hora()}</div></div></div>`;
      else if (v === 1) html = `<div class="mont">${H.slice(0, 3).map((h, i) => `<div class="ph" style="${bgImg(h.image, i)};background-size:cover;background-position:center;animation-delay:${i * 2.2}s"></div>`).join('')}<div class="shade"></div></div>${bug}<div class="layer iB"><div class="stamp"><i></i>EN VIVO</div><div class="l3"><div class="k">${esc(saludo().toUpperCase())}</div><div class="n pname">${words(prog)}</div><div class="d">${esc(fecha())} · ${hora()}</div></div></div>`;
      else html = `<div class="layer center iC"><div class="blk"></div><div class="cd">${[3, 2, 1].map((n, i) => `<b style="animation-delay:${.1 + i * .8}s">${n}</b>`).join('')}</div><div class="flash"></div><div class="after"><div class="live"><i></i>EN VIVO</div><div class="mark${logoCls}">${markInner}</div><div class="pname">${words(prog)}</div><div class="tag">${esc(fecha())} · ${hora()}</div></div></div>`;
    } else if (seg === 'tit') {
      if (v === 0) html = `${bug}<div class="layer tA"><div class="kicker fade tk">Titulares</div><div class="list n${H.length}">${H.map((h, i) => `<div class="row up" style="animation-delay:${.2 + i * .18}s" data-i="${i}"><div class="th" style="${bgImg(h.image, i)}"></div><div>${h.category ? `<span class="cat">${esc(h.category)}</span>` : ''}<div class="t">${esc(h.title)}</div></div></div>`).join('')}</div></div>`;
      else if (v === 1) html = `${bug}<div class="layer tB"><div class="kicker" style="position:absolute;left:0;right:0;top:7cqw;text-align:center">Titulares</div><div class="car"></div><div class="dots">${H.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div></div>`;
      else html = `${bug}<div class="layer tC"><div class="kicker" style="position:absolute;left:0;right:0;top:6cqw;text-align:center">Titulares</div><div class="grid">${H.map((h, i) => `<div class="tile" style="animation-delay:${.15 + i * .15}s" data-i="${i}"><div class="th" style="${bgImg(h.image, i)}"></div><div class="tx">${h.category ? `<span class="cat">${esc(h.category)}</span>` : ''}<div class="t">${esc(h.title)}</div></div></div>`).join('')}</div></div>`;
    } else if (seg === 'pase') {
      const ttl = esc(nextTitle || 'Un contenido especial');
      if (v === 0) html = `${bug}<div class="layer center xA"><div class="kicker up">Ya volvemos</div><div class="big up d1" style="margin-top:.6cqw">${words('A continuación')}</div><div class="next"><div class="th play" style="${nextStyle}">${nextThumb}</div><div><div class="kicker" style="font-size:1.4cqw;letter-spacing:.2em">${next.kind === 'ad' ? 'PUBLICIDAD' : 'CONTENIDO'}</div><div class="t">${ttl}</div><div class="d dur"></div></div></div></div>`;
      else if (v === 1) html = `${bug}<div class="layer center xB"><div class="kicker fade" style="margin-bottom:2cqw">Ya volvemos</div><div class="ring"><svg viewBox="0 0 36 36"><circle class="track" cx="18" cy="18" r="15.9155"/><circle class="prog" cx="18" cy="18" r="15.9155" pathLength="100"/></svg><div class="num"><b class="count">5</b></div></div><div class="mini up d2"><div class="th play" style="${nextStyle}">${nextThumb}</div><div><div class="kicker" style="font-size:1.2cqw">A CONTINUACIÓN</div><div class="t">${ttl}</div></div></div></div>`;
      else html = `<div class="layer xC"><div class="curtain top"></div><div class="curtain bot"></div><div class="over"><div class="kicker" style="opacity:0;animation:chfade .5s .8s forwards">${P}</div><div class="big" style="font-size:8cqw;margin-top:1cqw">${words('Pausa')}</div></div><div class="ticker"><span>A CONTINUACIÓN · ${ttl.toUpperCase()} · NO SE VAYA, YA VOLVEMOS · A CONTINUACIÓN · ${ttl.toUpperCase()}</span></div></div>`;
    } else if (seg === 'reg') {
      const n = next.title ? next : (heads[0] || {}), nt = esc(n.title || ''), nc = esc(String(n.category || '').toUpperCase()), nimg = bgImg(n.image, 0);
      if (v === 0) html = `${bug}<div class="layer center rA"><div class="kicker fade">Seguimos</div><div class="big fade d1" style="margin-top:.6cqw">${words(prog)}</div>${nt ? `<div class="next up d3"><div class="th" style="${nimg}"></div><div><div class="kicker" style="font-size:1.4cqw;letter-spacing:.2em">LA PRÓXIMA NOTICIA</div><div class="t">${nt}</div></div></div>` : ''}</div>`;
      else if (v === 1) html = `${bug}<div class="layer center rB"><div class="zoom">SEGUIMOS</div>${nt ? `<div class="lower"><div class="k">A CONTINUACIÓN</div><div class="t">${nt}</div></div>` : ''}</div>`;
      else html = `${bug}<div class="layer center rC"><div class="above"><div class="big" style="font-size:7cqw;margin-bottom:1.4cqw">${words('Seguimos')}</div></div><div class="line"></div><div class="below"><div>${nt ? `<div class="t">${nt}</div>` : `<div class="t">${P}</div>`}${nc ? `<div style="text-align:center;margin-top:1cqw"><span class="cat">${nc}</span></div>` : ''}</div></div></div>`;
    } else {
      if (v === 0) html = `<div class="layer center dA"><div class="row up"><div class="mark${logoCls}">${markInner}</div><div class="pname">${words(prog)}</div></div><div class="big up d2" style="margin-top:3cqw">${words(big)}</div><div class="social">${social.map((x, i) => `<span class="chip up d${3 + i}">${esc(x[1])}</span>`).join('')}${nextEm ? `<span class="chip y up d6">Próxima emisión · ${esc(nextEm)}</span>` : ''}</div></div>`;
      else if (v === 1) html = `<div class="layer dB"><div class="roll"><div class="mark${logoCls}" style="margin-bottom:2cqw">${markInner}</div><div><div class="l">PROGRAMA</div><div class="v">${P}</div></div>${thanks ? `<div><div class="l">${esc(thanks.toUpperCase())}</div><div class="v">${esc(big)}</div></div>` : ''}${social.map(x => `<div><div class="l">${esc((x[0] || 'SÍGUENOS').toUpperCase())}</div><div class="v">${esc(x[1])}</div></div>`).join('')}${nextEm ? `<div><div class="l">PRÓXIMA EMISIÓN</div><div class="v">${esc(nextEm)}</div></div>` : ''}</div></div>`;
      else html = `<div class="layer center dC"><div class="glow"></div><div class="lc"><div class="mark${logoCls}">${markInner}</div></div><div class="bye"><div class="big">${words(big)}</div><div class="tag" style="margin-top:1cqw">${P}</div></div></div>`;
    }
    // fondo del perfil
    const bgd = D.bg || {}, mode = bgd.mode === 'standby' || bgd.mode === 'custom' ? bgd.mode : 'anim';
    let bg = `<div class="bg anim"></div>`;
    if (mode === 'standby' && bgd.standbyUrl) bg = `<div class="bg standby"><video autoplay muted loop playsinline src="${esc(bgd.standbyUrl)}"></video><div class="dim"></div></div>`;
    else if (mode === 'standby') bg = `<div class="bg standby"></div>`;
    else if (mode === 'custom' && bgd.url) bg = `<div class="bg custom">${bgd.video ? `<video autoplay muted loop playsinline src="${esc(bgd.url)}"></video>` : `<img src="${esc(bgd.url)}" alt="">`}<div class="dim"></div></div>`;
    const st = document.createElement('div');
    st.className = 'chs' + (fmt === 'v' ? ' v' : '') + (tt ? ' tt' : '') + (seg === 'desp' && v === 2 ? ' closing' : '');
    st.innerHTML = `${bg}${html}<div class="subs"></div>`;
    root.replaceChildren(st);
    // logo cuadrado u horizontal: la caja toma la proporción de la imagen (de 1:1 hasta 3:1)
    if (D.logoUrl) { const im = new Image(); im.onload = () => { const r = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1; st.style.setProperty('--lr', String(Math.max(1, Math.min(3, r)).toFixed(3))); fit(); }; im.src = D.logoUrl; }
    st.querySelectorAll('video[preload="metadata"]').forEach(vd => vd.addEventListener('loadedmetadata', () => { const d = st.querySelector('.dur'); if (d && Number.isFinite(vd.duration)) { const s = Math.round(vd.duration); d.textContent = `Duración ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; } }, {once: true}));
    function fit(){
      st.querySelectorAll('.pname,.big,.zoom').forEach(el => { el.style.fontSize = ''; const box = el.closest('.layer') || st, max = box.clientWidth * .9; let f = parseFloat(getComputedStyle(el).fontSize), n = 0;
        const widest = () => { let w = el.scrollWidth; el.querySelectorAll('.word').forEach(x => { w = Math.max(w, x.scrollWidth); }); return w; };
        while (n++ < 24 && widest() > max + 1) { f *= .93; el.style.fontSize = f + 'px'; } });
    }
    fit(); setTimeout(fit, 80); if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => {});
    // subtítulos: la locución avanza con la voz (tramos con voz del WAV) o, sin ellos, con el tiempo
    const text = String(D.text || ''), ws = text.split(/\s+/).filter(Boolean), chunk = fmt === 'v' ? 7 : 11;
    const hideSubs = seg === 'tit' || (seg === 'desp' && v !== 0);
    const segs = (Array.isArray(D.segments) ? D.segments : []).filter(x => Array.isArray(x) && x[1] > x[0]);
    const T = segs.reduce((a, x) => a + x[1] - x[0], 0), dur = Number(D.duration) || 0;
    const frac = t => { if (T > 0) { let v2 = 0; for (const [a, b] of segs) { if (t <= a) break; v2 += Math.min(t, b) - a; } return Math.min(1, v2 / T); } return dur > 0 ? Math.min(1, t / dur) : 0; };
    const marks = (Array.isArray(D.marks) ? D.marks : []).map(Number);
    const subs = st.querySelector('.subs'), car = st.querySelector('.car');
    let lastIdx = -2, lastSaid = -1, lastCount = -1;
    function update(t){
      t = Math.max(0, Number(t) || 0);
      if (!hideSubs && ws.length) { const said = Math.round(frac(t) * ws.length); if (said !== lastSaid) { lastSaid = said; const start = Math.max(0, Math.floor((Math.max(1, said) - 1) / chunk) * chunk), part = ws.slice(start, start + chunk), k = said - start;
        subs.innerHTML = said ? esc(part.slice(0, k).join(' ')) + (k < part.length ? ' <span class="f">' + esc(part.slice(k).join(' ')) + '</span>' : '') : ''; } }
      if (seg === 'tit') {
        let idx = -1; if (marks.length) { for (let i = 0; i < marks.length; i++) if (t >= marks[i]) idx = i; } else if (dur) idx = Math.min(H.length - 1, Math.floor(t / (dur / H.length)));
        if (idx !== lastIdx) { lastIdx = idx;
          st.querySelectorAll('.tA .row').forEach((r, i) => { r.classList.toggle('on', idx === i); r.classList.toggle('done', idx > i); });
          st.querySelectorAll('.tC .tile').forEach((r, i) => { r.classList.toggle('on', idx === i); r.classList.toggle('dim', idx >= 0 && idx !== i); });
          if (car) { const i = Math.max(0, idx), h = H[i]; car.innerHTML = `<div class="card"><div class="th" style="${bgImg(h.image, i)}"></div><div class="tx"><div class="n">${i + 1}</div>${h.category ? `<span class="cat" style="align-self:flex-start">${esc(h.category)}</span>` : ''}<div class="t">${esc(h.title)}</div></div></div>`; st.querySelectorAll('.tB .dots i').forEach((d, k) => d.classList.toggle('on', k === i)); } } }
      if (seg === 'pase' && v === 1) { const c = Math.max(1, Math.min(5, Math.ceil((dur || 5) - t))); if (c !== lastCount) { lastCount = c; const b = st.querySelector('.count'); if (b) { b.textContent = c; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; } } }
      const clock = st.querySelector('.clock'); if (clock) { const h = hora(); if (clock.textContent !== h) clock.textContent = h; }
    }
    update(0);
    return {update, fit, el: st, destroy(){ st.querySelectorAll('video').forEach(x => { try { x.pause(); x.removeAttribute('src'); x.load(); } catch {} }); st.remove(); }};
  }
  window.GECClassicHostRender = {mount, saludo, hora, fecha};
})();
