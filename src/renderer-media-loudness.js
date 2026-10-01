'use strict';
// Merlín · volumen normalizado de enlatados y anuncios (sección 6B).
// Mide en segundo plano cada video de las carpetas de enlatados y anuncios con Web Audio:
// RMS en bloques de 50 ms ignorando los bloques por debajo de -40 dBFS, y gainDb = clamp(-20 - rmsDb, -12, +6).
// El resultado se guarda en main (media-loudness.json) y viaja a la salida como p.audioGainDb.
(function installMediaLoudness(){
  if (window.__mediaLoudnessInstalled) return; window.__mediaLoudnessInstalled = true;
  const api = window.ECAPI;
  if (!api || typeof api.mediaLoudnessPending !== 'function') return;
  const TARGET_DB = -20, FLOOR = Math.pow(10, -40 / 20), BLOCK_SEC = 0.05;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), {timeout: 5000}) : setTimeout(r, 200)));
  function measure(buffer){
    const ch = buffer.numberOfChannels, n = buffer.length, block = Math.max(1, Math.round(buffer.sampleRate * BLOCK_SEC));
    const data = []; for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
    let sum = 0, cnt = 0;
    for (let start = 0; start < n; start += block) {
      const end = Math.min(n, start + block); let bs = 0;
      for (let c = 0; c < ch; c++) { const d = data[c]; for (let i = start; i < end; i++) bs += d[i] * d[i]; }
      const bc = (end - start) * ch;
      if (bc && Math.sqrt(bs / bc) >= FLOOR) { sum += bs; cnt += bc; }
    }
    if (!cnt) return null;
    const rmsDb = 20 * Math.log10(Math.sqrt(sum / cnt));
    return Math.max(-12, Math.min(6, TARGET_DB - rmsDb));
  }
  async function measureOne(item){
    if (item.tooLarge) return null;
    const bytes = await api.mediaLoudnessRead(item.key);
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const buffer = await ctx.decodeAudioData(bytes);
    return measure(buffer);
  }
  async function loop(){
    await wait(20000);
    for (;;) {
      let list = [];
      try { list = await api.mediaLoudnessPending(); } catch {}
      if (!list || !list.length) { await wait(5 * 60000); continue; }
      for (const item of list) {
        await idle();
        let gain = null;
        try { gain = await measureOne(item); }
        catch (e) { console.warn('[volumen] no se pudo medir', item.name, e && e.message || e); }
        try { await api.mediaLoudnessSet(item.key, gain); } catch {}
        await wait(1500);
      }
    }
  }
  loop();
})();
