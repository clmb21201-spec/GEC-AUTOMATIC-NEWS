'use strict';
// Lab.43 · El perfil exportado (.gecprofile / .gecpack) también lleva lo que se guarda fuera de la configuración del perfil:
//   - Noticias con movimiento y sonidos de transición (news-motion.json → profiles[id], Lab.37 / Lab.39);
//   - Intervenciones de la vista clásica (classic-host.json → profiles[id], Lab.38) con su logo y su fondo propio
//     (classic-host/<perfil>/);
//   - Horario automático (broadcast-schedule.json → profiles[id], Lab.33). Al importar queda DESACTIVADO, para que otra
//     computadora no empiece a emitir ni a transmitir a YouTube sola; el operador lo activa en «Horario automático».
// No viajan (son de cada computadora): modo de salida (clásica / Merlín), OBS, control desde el celular, carpeta de audios.
// Va en payload.extrasLab43 = {version, profiles: {<id original>: {newsMotion, classicHost, schedule}}} y los archivos en
// resources «extras/<id>/classic-host/<archivo>». Un GEC anterior ignora ambas cosas (el paquete sigue siendo válido).
// Al importar, installResources recibe el mapa id original → id nuevo; los datos se escriben recién cuando la importación
// terminó bien. Si algo de esto falla, la importación del perfil no se cae: se informa en result.extrasLab43.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NM_FILE = 'news-motion.json', CH_FILE = 'classic-host.json', SCHED_FILE = 'broadcast-schedule.json';
const MAX_ASSET_BYTES = 128 * 1024 * 1024; // mismo tope por archivo que el paquete de perfiles
const ASSET_PREFIX = '@classic-host/';

const safeId = id => String(id || 'default').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'default';
function readJson(f, fb){ try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } }
function writeJson(f, v){ fs.mkdirSync(path.dirname(f), {recursive: true}); const t = `${f}.tmp-${process.pid}`; fs.writeFileSync(t, JSON.stringify(v, null, 2), 'utf8'); fs.renameSync(t, f); }
function readAll(file){ const v = readJson(file, {}); return v && typeof v === 'object' && v.profiles && typeof v.profiles === 'object' ? v : {version: 1, profiles: {}}; }
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function relSafe(v){ const s = String(v || '').replace(/\\/g, '/').replace(/^\/+/, ''), parts = s.split('/'); if (!s || parts.some(x => !x || x === '.' || x === '..')) throw new Error('Ruta insegura'); return parts.join('/'); }

// ---------------------------------------------------------------- exportar
// Devuelve {data, resources, skipped} para un perfil. data es null si el perfil no tiene nada guardado en estos archivos.
function collectExtras(dataDir, id){
  const data = {}, resources = [], skipped = [];
  const nm = readAll(path.join(dataDir, NM_FILE)).profiles[id];
  if (nm && typeof nm === 'object') data.newsMotion = clone(nm);
  const sc = readAll(path.join(dataDir, SCHED_FILE)).profiles[id];
  if (sc && typeof sc === 'object') data.schedule = {enabled: sc.enabled !== false, slots: Array.isArray(sc.slots) ? clone(sc.slots) : []};
  const ch = readAll(path.join(dataDir, CH_FILE)).profiles[id];
  if (ch && typeof ch === 'object') {
    const c = clone(ch);
    const pack = (file, label) => {
      if (!file) return '';
      try {
        const st = fs.statSync(file);
        if (!st.isFile()) return '';
        if (st.size > MAX_ASSET_BYTES) { skipped.push(`${label}: ${path.basename(file)} pesa más de 128 MB y no se incluyó`); return ''; }
        const b = fs.readFileSync(file), name = path.basename(file);
        resources.push({path: relSafe(`extras/${safeId(id)}/classic-host/${name}`), size: b.length, sha256: sha(b), data: b.toString('base64')});
        return ASSET_PREFIX + name;
      } catch { skipped.push(`${label}: no se encontró ${path.basename(String(file))}`); return ''; }
    };
    c.logo = pack(c.logo, 'Logo de las intervenciones');
    c.background = {...(c.background || {})};
    c.background.file = pack(c.background.file, 'Fondo de las intervenciones');
    if (!c.background.file && c.background.mode === 'custom') c.background.mode = 'anim';
    data.classicHost = c;
  }
  return {data: Object.keys(data).length ? data : null, resources, skipped};
}
function addExtrasToPayload(payload, dataDir){
  if (!payload || !Array.isArray(payload.profiles)) return payload;
  const out = {version: 1, profiles: {}, skipped: []};
  payload.resources = Array.isArray(payload.resources) ? payload.resources : [];
  for (const row of payload.profiles) {
    const id = String(row?.meta?.id || ''); if (!id) continue;
    try {
      const r = collectExtras(dataDir, id);
      if (r.data) out.profiles[id] = r.data;
      payload.resources.push(...r.resources);
      out.skipped.push(...r.skipped.map(s => `${row.meta.name || id} · ${s}`));
    } catch (e) { out.skipped.push(`${row?.meta?.name || id} · ${e.message || e}`); }
  }
  if (Object.keys(out.profiles).length) payload.extrasLab43 = out;
  return payload;
}

// ---------------------------------------------------------------- importar
// idMap: id original → id nuevo (el que armó importFile). Escribe en los tres archivos y copia logo / fondo.
function applyExtras(dataDir, pkg, idMap, mods = {}){
  const ex = pkg && pkg.extrasLab43, summary = {applied: [], scheduleDisabled: [], notes: []};
  if (!ex || !ex.profiles || typeof ex.profiles !== 'object') return summary;
  const nmMod = mods.newsMotion || tryRequire('./newsMotionLab37'), chMod = mods.classicHost || tryRequire('./classicHostLab38');
  const schedMod = mods.schedule === undefined ? tryRequire('./broadcastScheduleLab33') : mods.schedule;
  const res = new Map((pkg.resources || []).filter(r => /^extras\//.test(String(r.path || ''))).map(r => [r.path, r]));
  const nmFile = path.join(dataDir, NM_FILE), chFile = path.join(dataDir, CH_FILE), scFile = path.join(dataDir, SCHED_FILE);
  const nmAll = readAll(nmFile), chAll = readAll(chFile), scAll = readAll(scFile);
  let nmDirty = false, chDirty = false, scDirty = false;
  for (const [oldId, d] of Object.entries(ex.profiles)) {
    const newId = idMap.get(oldId); if (!newId || !d || typeof d !== 'object') continue;
    const done = [];
    try {
      if (d.newsMotion && typeof d.newsMotion === 'object') {
        nmAll.profiles[newId] = nmMod?.normalizeConfig ? nmMod.normalizeConfig(d.newsMotion) : d.newsMotion; nmDirty = true; done.push('movimiento y sonidos');
      }
      if (d.classicHost && typeof d.classicHost === 'object') {
        const c = clone(d.classicHost), dir = path.join(dataDir, 'classic-host', safeId(newId));
        const unpack = ref => {
          const s = String(ref || ''); if (!s.startsWith(ASSET_PREFIX)) return '';
          const name = path.basename(s.slice(ASSET_PREFIX.length)), r = res.get(`extras/${safeId(oldId)}/classic-host/${name}`);
          if (!r) return '';
          const buf = Buffer.from(String(r.data || ''), 'base64');
          if (buf.length !== Number(r.size) || sha(buf) !== String(r.sha256)) { summary.notes.push(`Archivo dañado: ${name}`); return ''; }
          fs.mkdirSync(dir, {recursive: true});
          const kind = name.split('-')[0];
          // como al elegirlo en el panel: un solo logo y un solo fondo por perfil
          try { for (const f of fs.readdirSync(dir)) if (f !== name && f.startsWith(kind + '-')) fs.rmSync(path.join(dir, f), {force: true}); } catch {}
          const dest = path.join(dir, name); fs.writeFileSync(dest, buf); return dest;
        };
        c.logo = unpack(c.logo);
        c.background = {...(c.background || {})}; c.background.file = unpack(c.background.file);
        if (!c.background.file && c.background.mode === 'custom') c.background.mode = 'anim';
        chAll.profiles[newId] = chMod?.normalizeConfig ? chMod.normalizeConfig(c) : c; chDirty = true; done.push('intervenciones');
      }
      if (d.schedule && typeof d.schedule === 'object') {
        let slots = Array.isArray(d.schedule.slots) ? d.schedule.slots.slice(0, 14) : [];
        if (schedMod?.normalizeSchedule) { const n = schedMod.normalizeSchedule({enabled: true, slots}); if (!(schedMod.validate?.(n) || []).length) slots = n.slots; }
        scAll.profiles[newId] = {enabled: false, slots}; scDirty = true;
        if (slots.length) { done.push('horario (desactivado)'); if (d.schedule.enabled !== false) summary.scheduleDisabled.push(newId); }
      }
    } catch (e) { summary.notes.push(String(e.message || e)); }
    if (done.length) summary.applied.push({id: newId, items: done});
  }
  if (nmDirty) writeJson(nmFile, nmAll);
  if (chDirty) writeJson(chFile, chAll);
  if (scDirty) writeJson(scFile, scAll);
  return summary;
}
function tryRequire(m){ try { return require(m); } catch { return null; } }

// ---------------------------------------------------------------- instalación sobre ProfilePackage0329
function installProfileExtrasLab43({ProfilePackage = null} = {}){
  const P = ProfilePackage || require('./profilePackage0329').ProfilePackage0329, p = P.prototype;
  if (p.__gecProfileExtrasLab43) return true;
  Object.defineProperty(p, '__gecProfileExtrasLab43', {value: true});
  const profilePayload = p.profilePayload, allPayload = p.allPayload, installResources = p.installResources, importFile = p.importFile;
  p.profilePayload = function(...args){ return addExtrasToPayload(profilePayload.apply(this, args), this.dataDir); };
  p.allPayload = function(...args){ return addExtrasToPayload(allPayload.apply(this, args), this.dataDir); };
  // importFile llama a installResources con el paquete y el mapa de ids: se guarda para aplicarlo al final
  p.installResources = function(pkg, idMap, ...rest){ this.__lab43Pending = {pkg, idMap: new Map(idMap || [])}; return installResources.call(this, pkg, idMap, ...rest); };
  p.importFile = function(...args){
    this.__lab43Pending = null;
    let result;
    try { result = importFile.apply(this, args); }
    catch (e) { this.__lab43Pending = null; throw e; }
    const pend = this.__lab43Pending; this.__lab43Pending = null;
    if (pend && result && typeof result === 'object') {
      try {
        const s = applyExtras(this.dataDir, pend.pkg, pend.idMap);
        if (s.applied.length || s.notes.length) result.extrasLab43 = s;
        try { global.__gecClassicHostRefresh?.(); } catch {}
      } catch (e) { result.extrasLab43 = {applied: [], scheduleDisabled: [], notes: [String(e.message || e)]}; }
    }
    return result;
  };
  return true;
}

module.exports = {installProfileExtrasLab43, collectExtras, addExtrasToPayload, applyExtras, ASSET_PREFIX, NM_FILE, CH_FILE, SCHED_FILE};
