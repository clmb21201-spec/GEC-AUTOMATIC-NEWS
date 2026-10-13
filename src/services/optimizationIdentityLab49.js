'use strict';
// Lab.49 · La optimización del modelo fine-tuned vuelve sin su modelo al abrir el programa.
// La optimización (optimization0321) se guarda completa en los ajustes generales y, además, en una copia por perfil
// (optimization-lab28.json, Lab.28/Lab.29). Esa copia se escribe antes de que releaseV2Lab le agregue el modelo de voz
// (ttsMode, ttsModelId, ttsModelFingerprint) y, al cargar, reemplaza a la completa. Con Qwen fine-tuned el panel de voz
// compara el modelo elegido con uno vacío y muestra «SIN OPTIMIZAR» / «Pendiente de optimización para este modelo»,
// aunque el perfil de producción sí vale.
// Al cargar, si a la optimización le falta el modelo y es del mismo motor, clave y firma del runtime que la voz actual
// (la firma incluye el modelo y su huella), se completa con el modelo actual. Si es de otro modelo no se toca.
const lab = require('./releaseV2Lab');

const VERSION = 'lab49-identity-1';
const str = v => String(v == null ? '' : v);
const noReference = sig => str(sig).split('|').filter(x => !/^reference=/.test(x)).join('|');

function completeIdentity(settings){
  const o = settings && settings.optimization0321, tts = (settings && settings.tts) || {};
  if (!o || typeof o !== 'object' || str(tts.engine) !== 'qwen3tts' || str(o.ttsEngine) !== 'qwen3tts') return false;
  if (o.ttsModelId && o.ttsMode) return false;
  let key = '', sig = '', id = null;
  try { key = lab.optimizationKey(tts); sig = lab.ttsRuntimeSignature(tts); id = lab.qwenModelIdentity(tts); } catch { return false; }
  if (!id || (id.mode === 'finetuned' && !id.id)) return false;
  if (o.ttsOptimizationKey && str(o.ttsOptimizationKey) !== key) return false;
  if (o.ttsRuntimeSignature && noReference(o.ttsRuntimeSignature) !== noReference(sig)) return false;
  if (id.mode === 'finetuned' && !o.ttsRuntimeSignature) return false;
  Object.assign(o, {ttsOptimizationKey: key, ttsMode: id.mode || '', ttsModelId: id.id || '', ttsModelFingerprint: id.fingerprint || '', ttsRuntimeSignature: sig});
  return true;
}

function installOptimizationIdentityLab49({SettingsStore = null} = {}){
  const S = SettingsStore || require('./settings').SettingsStore, p = S.prototype;
  if (p.__gecLab49Identity) return false;
  Object.defineProperty(p, '__gecLab49Identity', {value: true});
  const baseLoad = p.load;
  p.load = function(...args){
    const s = baseLoad.apply(this, args);
    try { completeIdentity(s); } catch {}
    return s;
  };
  return true;
}

module.exports = {VERSION, completeIdentity, installOptimizationIdentityLab49};
