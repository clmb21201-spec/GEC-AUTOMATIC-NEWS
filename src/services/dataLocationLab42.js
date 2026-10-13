'use strict';
// Lab.42 · Carpeta de datos e IAs que sobrevive a cada versión nueva del EXE.
// GEC guarda todo (IAs, motores de voz, voces, perfiles, diseño, optimización) en «GEC V2 TTS Lab» junto al EXE. Al abrir
// una versión nueva desde otra carpeta (por ejemplo Descargas) empezaba de cero y había que bajar las IAs otra vez.
// Ahora se anota en %APPDATA%\GEC Automatic News\data-location.json la última carpeta usada (y, si el operador la
// eligió en Ajustes, una carpeta fija). Al arrancar (bootstrap-v2lab.js, antes de cualquier otro módulo):
//   1) variable GEC_V2_TTS_LAB_ROOT ya puesta (reinicio controlado) → esa;
//   2) carpeta fija elegida en Ajustes → esa (se crea si falta);
//   3) junto al EXE ya hay datos → esa;
//   4) junto al EXE no hay nada y la última carpeta usada tiene datos → la última (aviso en el panel);
//   5) si no, junto al EXE (como siempre).
// Ajustes → «Carpeta de datos e IAs»: abrir, elegir otra (usar la que ya tiene datos o copiar los actuales) y volver a
// la de junto al EXE. Los cambios reinician GEC, porque todas las rutas se fijan al arrancar.
const fs = require('fs');
const path = require('path');
const {LAB_DIR_NAME, DATA_DIR_NAME, canonicalLabBase, readProfileRegistry} = require('./v2LabDataPath');

const POINTER_DIR = 'GEC Automatic News';
const POINTER_FILE = 'data-location.json';

const pointerPath = appData => path.join(String(appData || ''), POINTER_DIR, POINTER_FILE);
function readPointer(appData){
  try { const v = JSON.parse(fs.readFileSync(pointerPath(appData), 'utf8')); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
function writePointer(appData, value){
  try {
    const file = pointerPath(appData); fs.mkdirSync(path.dirname(file), {recursive: true});
    const tmp = `${file}.tmp-${process.pid}`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8'); fs.renameSync(tmp, file); return true;
  } catch { return false; }
}
const same = (a, b) => !!a && !!b && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const dataDirOf = labBase => path.join(canonicalLabBase(labBase), DATA_DIR_NAME);
function nonEmpty(dir){ try { return fs.readdirSync(dir).length > 0; } catch { return false; } }
// «Tiene datos»: perfiles registrados, una IA de texto descargada o motores de voz instalados
function hasData(labBase){
  if (!labBase) return false;
  const d = dataDirOf(labBase);
  if (!fs.existsSync(d)) return false;
  if (readProfileRegistry(d).count > 0 || nonEmpty(path.join(d, 'models')) || nonEmpty(path.join(d, 'tts-lab', 'models'))) return true;
  // motores de voz instalados: tts-lab/<motor>/site-packages con contenido
  try { for (const it of fs.readdirSync(path.join(d, 'tts-lab'), {withFileTypes: true})) if (it.isDirectory() && nonEmpty(path.join(d, 'tts-lab', it.name, 'site-packages'))) return true; } catch {}
  return false;
}
function writable(dir){
  try { fs.mkdirSync(dir, {recursive: true}); const t = path.join(dir, `.gec-write-test-${process.pid}`); fs.writeFileSync(t, 'ok'); fs.rmSync(t, {force: true}); return true; } catch { return false; }
}

function resolveStartup({rawBase, envBase = '', appData = '', exeDir = ''} = {}){
  const local = canonicalLabBase(rawBase);
  const pointer = readPointer(appData);
  let labBase = local, source = 'local-new';
  if (envBase) { labBase = canonicalLabBase(envBase); source = 'env'; }
  else if (pointer.fixed && pointer.fixedBase && writable(canonicalLabBase(pointer.fixedBase))) { labBase = canonicalLabBase(pointer.fixedBase); source = 'fixed'; }
  else if (hasData(local)) { labBase = local; source = 'local'; }
  else if (pointer.lastBase && !same(pointer.lastBase, local) && hasData(pointer.lastBase)) { labBase = canonicalLabBase(pointer.lastBase); source = 'remembered'; }
  // la carpeta en uso pasa a ser «la última»; la fija se conserva
  const next = {...pointer, version: 1, lastBase: labBase, updatedAt: new Date().toISOString(), lastExeDir: exeDir || ''};
  if (source !== 'env' || !same(pointer.lastBase, labBase)) writePointer(appData, next);
  return {labBase, source, local, pointer: next};
}

// ---------------------------------------------------------------- copia con progreso (sin pisar lo que ya existe igual)
async function listFiles(root){
  const out = []; let bytes = 0;
  async function walk(dir){
    let items = []; try { items = await fs.promises.readdir(dir, {withFileTypes: true}); } catch { return; }
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) await walk(p);
      else if (it.isFile()) { let size = 0; try { size = (await fs.promises.stat(p)).size; } catch {} out.push({p, size}); bytes += size; }
    }
  }
  await walk(root); return {files: out, bytes};
}
async function copyTree(src, dst, onProgress = () => {}){
  const {files, bytes} = await listFiles(src);
  let done = 0, doneBytes = 0, last = 0, copied = 0;
  for (const f of files) {
    const rel = path.relative(src, f.p), target = path.join(dst, rel);
    let skip = false; try { const st = await fs.promises.stat(target); skip = st.size === f.size; } catch {}
    if (!skip) { await fs.promises.mkdir(path.dirname(target), {recursive: true}); await fs.promises.copyFile(f.p, target); copied++; }
    done++; doneBytes += f.size;
    const now = Date.now(); if (now - last > 300 || done === files.length) { last = now; onProgress({done, total: files.length, bytes: doneBytes, totalBytes: bytes}); }
  }
  return {files: files.length, copied, bytes};
}

// ---------------------------------------------------------------- IPC (main)
function installDataLocationLab42({startup = global.__gecDataLocation || null, electron = null} = {}){
  if (global.__gecDataLocationLab42) return global.__gecDataLocationLab42;
  const {app, ipcMain, dialog, shell, BrowserWindow} = electron || require('electron');
  const appData = app.getPath('appData');
  const info = () => {
    const p = readPointer(appData), cur = canonicalLabBase(process.env.GEC_V2_TTS_LAB_ROOT || startup?.labBase || '');
    return {ok: true, labBase: cur, dataDir: dataDirOf(cur), source: startup?.source || 'local', local: startup?.local || '', localHasData: hasData(startup?.local || ''),
      fixed: !!p.fixed, fixedBase: p.fixedBase || '', lastBase: p.lastBase || '', pointerFile: pointerPath(appData), busy: !!state.busy, progress: state.progress};
  };
  const state = {busy: false, progress: null};
  const send = (ch, payload) => { for (const w of BrowserWindow.getAllWindows()) try { if (!w.isDestroyed()) w.webContents.send(ch, payload); } catch {} };
  const handle = (k, fn) => { try { ipcMain.removeHandler(k); } catch {} ipcMain.handle(k, fn); };
  async function stopEverything(){
    try { const safety = require('./profileSwitchSafety0329'); const r = await safety.stopStrict(true); if (r && r.ok === false) return false; } catch {}
    const e = global.__ec0329AutomationRef;
    try { e?.providers?.localRuntime?.stop?.('data-location'); } catch {}
    try { await e?.kokoro?.stopAndWait?.('data-location', 7000); } catch {}
    return true;
  }
  async function relaunchInto(labBase){
    process.env.GEC_V2_TTS_LAB_ROOT = labBase; process.env.PORTABLE_EXECUTABLE_DIR = labBase;
    try { await global.__ecPrepareControlledRelaunch?.(); } catch {}
    app.relaunch(); setTimeout(() => app.exit(0), 260);
  }
  handle('dataLocation:get', () => info());
  handle('dataLocation:open', async () => { const d = info().dataDir; const err = await shell.openPath(d); return err ? {ok: false, error: err} : {ok: true}; });
  handle('dataLocation:pick', async e => {
    const win = BrowserWindow.fromWebContents(e.sender) || undefined;
    const r = await dialog.showOpenDialog(win, {title: 'Carpeta para los datos y las IAs de GEC', properties: ['openDirectory', 'createDirectory']});
    if (r.canceled || !r.filePaths?.[0]) return {ok: false, canceled: true};
    const labBase = canonicalLabBase(r.filePaths[0]);
    return {ok: true, folder: r.filePaths[0], labBase, dataDir: dataDirOf(labBase), hasData: hasData(labBase), current: same(labBase, info().labBase), writable: writable(labBase)};
  });
  // mode: 'use' (usar esa carpeta tal como está), 'copy' (copiar ahí los datos actuales y usarla), 'local' (volver a junto al EXE)
  handle('dataLocation:set', async (_e, req = {}) => {
    if (state.busy) return {ok: false, error: 'Ya hay una copia en curso.'};
    const mode = String(req.mode || ''), cur = info().labBase;
    if (mode === 'local') {
      const p = readPointer(appData); writePointer(appData, {...p, fixed: false, fixedBase: ''});
      const target = startup?.local || cur; if (same(target, cur)) return {ok: true, restart: false};
      if (!(await stopEverything())) return {ok: false, error: 'No se pudieron detener la emisión y la preparación.'};
      await relaunchInto(target); return {ok: true, restart: true};
    }
    const labBase = canonicalLabBase(String(req.folder || ''));
    if (!req.folder || !writable(labBase)) return {ok: false, error: 'No se puede escribir en esa carpeta.'};
    if (same(labBase, cur)) { const p = readPointer(appData); writePointer(appData, {...p, fixed: true, fixedBase: labBase}); return {ok: true, restart: false}; }
    if (mode !== 'use' && mode !== 'copy') return {ok: false, error: 'Modo desconocido.'};
    if (!(await stopEverything())) return {ok: false, error: 'No se pudieron detener la emisión y la preparación.'};
    if (mode === 'copy') {
      state.busy = true; state.progress = {done: 0, total: 0, bytes: 0, totalBytes: 0};
      try {
        await copyTree(cur, labBase, pr => { state.progress = pr; send('dataLocation:progress', pr); });
      } catch (err) {
        state.busy = false; send('dataLocation:progress', {error: String(err.message || err)});
        return {ok: false, error: `La copia no terminó: ${err.message || err}. GEC sigue usando la carpeta actual.`};
      }
      state.busy = false;
    }
    const p = readPointer(appData); writePointer(appData, {...p, fixed: true, fixedBase: labBase, lastBase: labBase});
    await relaunchInto(labBase); return {ok: true, restart: true};
  });
  global.__gecDataLocationLab42 = {info};
  return global.__gecDataLocationLab42;
}

module.exports = {resolveStartup, readPointer, writePointer, pointerPath, hasData, copyTree, installDataLocationLab42, POINTER_DIR, POINTER_FILE, LAB_DIR_NAME, DATA_DIR_NAME};
