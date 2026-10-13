'use strict';
// Lab.44 · Meta de RTF y optimización rápida.
// Meta (los dos modos): al medir las variantes de la voz Qwen, si la configuración que se elegiría ya llega a RTF 0,65
// de forma estable (mediana ≤ 0,65 y peor corrida ≤ 0,75), las variantes que faltan no se miden. Para una variante
// cuenta lo mismo que exige la elección final: comparable con la base (frames y duración ±5 %) y al menos 5 % más rápida.
// Optimización rápida (botón aparte en Ajustes; IPC optimization:setMode 'quick' antes de iniciar la optimización normal):
//   - voz: 2 repeticiones por variante (antes 3) y solo la base + «hidden OFF · top-k 20»; lotes B1 y B4 (antes B1–B8);
//     aceleración del predictor con 2 repeticiones (antes 3). La nota típica, la corta y la prueba de escucha se mantienen.
//   - IA de texto: configuración actual + GPU completa equilibrada + GPU completa rápida (antes 5 configuraciones).
// El modo vuelve solo a 'full' a las 3 h o cuando el panel lo pide al terminar.
const RTF_TARGET = 0.65, RTF_WORST = 0.75;
const QUICK = {sampleLimit: 2, candidateIds: ['baseline', 'subk20'], batchSizes: [1, 4], localIds: ['current', 'gpu-full-balanced', 'gpu-full-fast']};
const MODE_TTL_MS = 3 * 60 * 60 * 1000;
const state = {mode: 'full', at: 0};

function mode(){ if (state.mode === 'quick' && Date.now() - state.at > MODE_TTL_MS) state.mode = 'full'; return state.mode; }
function setMode(m){ state.mode = m === 'quick' ? 'quick' : 'full'; state.at = Date.now(); return mode(); }

const num = v => Number(v || 0);
function okRow(r){ return r && r.safe && !r.error && num(r.rtf) > 0 && num(r.rtf) < 999; }
// ¿lo que se elegiría con lo medido hasta ahora ya llega a la meta? Devuelve el motivo para las variantes omitidas.
function targetReached(results, target = RTF_TARGET, worstLimit = RTF_WORST){
  const base = results.find(r => r && r.id === 'baseline') || results[0];
  if (!okRow(base)) return null;
  const stable = r => num(r.rtf) <= target && num(r.worstRealtimeFactor || r.rtf) <= worstLimit && num(r.runCount) >= 2;
  const within = (a, b) => !a || !b || Math.abs(a - b) / b <= 0.05;
  let pick = base;
  for (const r of results) {
    if (r === base || !okRow(r) || r.eligible === false) continue;
    const comparable = within(num(r.talkerStepsMedian), num(base.talkerStepsMedian)) && within(num(r.medianDurationSec), num(base.medianDurationSec));
    if (comparable && num(r.rtf) <= num(base.rtf) * 0.95 && num(r.rtf) < num(pick.rtf)) pick = r;
  }
  if (!stable(pick)) return null;
  return `Omitida: «${pick.label || pick.id}» ya llega a la meta (RTF ${num(pick.rtf).toFixed(2)} ≤ ${target.toFixed(2)})`;
}

// IA de texto: en la rápida solo la configuración actual y las dos de GPU completa
function wrapLocalCandidates(p){
  const baseCand = p && p.__ec0320BenchmarkCandidates;
  if (typeof baseCand !== 'function' || p.__gecLab44Quick) return false;
  Object.defineProperty(p, '__gecLab44Quick', {value: true});
  p.__ec0320BenchmarkCandidates = function(...args){
    const list = baseCand.apply(this, args);
    if (mode() !== 'quick' || !Array.isArray(list)) return list;
    const few = list.filter(c => QUICK.localIds.includes(c.id));
    return few.length ? few : list;
  };
  return true;
}

function installOptimizationQuickLab44({electron = null, TTSLabRuntime = null, LocalRuntime = null} = {}){
  if (global.__gecOptimizationLab44) return global.__gecOptimizationLab44;
  const T = TTSLabRuntime || require('./ttsLabRuntime').TTSLabRuntime, t = T.prototype;
  const baseBench = t.benchmarkQwenPerformance;
  if (typeof baseBench === 'function') t.benchmarkQwenPerformance = async function(options = {}, ...rest){
    const quick = mode() === 'quick';
    const next = {...options, stopWhen: results => targetReached(results)};
    if (quick) Object.assign(next, {quickOptimization: true, sampleLimit: QUICK.sampleLimit, candidateIds: QUICK.candidateIds, batchSizes: QUICK.batchSizes});
    const r = await baseBench.call(this, next, ...rest);
    if (r && typeof r === 'object') { r.rtfTarget = RTF_TARGET; r.optimizationMode = quick ? 'quick' : 'full'; r.targetSkipped = (r.results || []).filter(x => x && x.skipped).map(x => x.id); }
    return r;
  };
  try { wrapLocalCandidates((LocalRuntime || require('./localRuntime').LocalRuntime).prototype); } catch {}
  try {
    const {ipcMain} = electron || require('electron');
    const handle = (k, fn) => { try { ipcMain.removeHandler(k); } catch {} ipcMain.handle(k, fn); };
    handle('optimization:setMode', (_e, m) => ({ok: true, mode: setMode(m), rtfTarget: RTF_TARGET}));
    handle('optimization:getMode', () => ({ok: true, mode: mode(), rtfTarget: RTF_TARGET}));
  } catch {}
  global.__gecOptimizationLab44 = {mode, setMode, targetReached, RTF_TARGET};
  return global.__gecOptimizationLab44;
}

module.exports = {installOptimizationQuickLab44, wrapLocalCandidates, targetReached, setMode, mode, RTF_TARGET, RTF_WORST, QUICK};
