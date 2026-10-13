# Lab.41 · murmullos de Qwen antes de la primera palabra y retumbo grave (qwen_onset_lab41.py y su conexión con el worker).
# Sin torch. La detección se prueba con señales sintéticas solo si hay numpy (en CI puede no estar).
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, os.path.join(ROOT, "src"))
import qwen_onset_lab41 as O

checks = 0


def ok(cond, msg):
    global checks
    checks += 1
    if not cond:
        raise SystemExit("check-qwen-onset-lab41.py: " + msg)


worker = open(os.path.join(ROOT, "src", "tts_lab_worker.py"), encoding="utf-8").read()
ok("import qwen_onset_lab41 as ONSET" in worker, "el worker no importa qwen_onset_lab41")
ok(worker.count("audio_item = clean_onset(idx, audio_item, sr)") == 2, "falta limpiar el inicio en uno de los dos caminos (lotes / uno por uno)")
ok("batchBenchmarkMode" in worker.split("onset_on =")[1].split("\n")[0], "la limpieza debe omitirse en el modo de medición por lotes")
ok("ONSET.highpass(audio, sample_rate)" in worker and '"onset": onset_events' in worker, "falta el filtro grave o el informe de la limpieza")
ps1 = open(os.path.join(ROOT, "scripts", "prepare-windows-runtime.ps1"), encoding="utf-8").read()
ok("qwen_onset_lab41.py" in ps1, "prepare-windows-runtime.ps1 no copia qwen_onset_lab41.py junto al worker")
guard = open(os.path.join(ROOT, "src", "services", "ttsRunawayGuardLab34.js"), encoding="utf-8").read()
ok("r?.onset" in guard and "murmullo de" in guard, "los murmullos quitados no quedan en logs/tts-runaway.log")

try:
    import numpy as np
except Exception:
    np = None

if np is not None:
    sr = 24000
    rng = np.random.default_rng(7)
    t = lambda sec: np.arange(int(sr * sec)) / sr
    sil = lambda sec: np.zeros(int(sr * sec), np.float32)

    def speech(sec):
        # «voz»: ruido filtrado 300–4000 Hz con sílabas de ~0,2 s (frecuencias de habla, sostenida)
        n = int(sr * sec)
        spec = np.fft.rfft(rng.standard_normal(n))
        f = np.fft.rfftfreq(n, 1 / sr)
        spec[(f < 300) | (f > 4000)] = 0
        x = np.fft.irfft(spec, n)
        env = 0.55 + 0.45 * np.abs(np.sin(np.pi * t(sec) / 0.2))
        x = x / np.max(np.abs(x)) * 0.5 * env
        return x.astype(np.float32)

    def murmur(sec, f0=300):
        # «mmm»: tono grave con un armónico, casi sin agudos
        x = 0.05 * np.sin(2 * np.pi * f0 * t(sec)) + 0.015 * np.sin(2 * np.pi * 2 * f0 * t(sec))
        return (x * np.hanning(len(x))).astype(np.float32)

    v = speech(3.0)
    out, d = O.clean_head(np.concatenate([sil(1.0), murmur(0.2), sil(0.5), v]), sr)
    ok(d["applied"] and d["reason"] == "murmullo" and abs(len(out) / sr - (3.0 + O.LEAD_SEC)) < 0.08, "no quita el murmullo de antes de la voz: %s" % d)
    out, d = O.clean_head(np.concatenate([sil(0.02), v]), sr)
    ok(not d["applied"], "tocó una voz que empieza bien: %s" % d)
    out, d = O.clean_head(np.concatenate([sil(0.8), v]), sr)
    ok(d["applied"] and d["reason"] == "silencio inicial" and len(out) >= len(v), "el silencio inicial no se recorta o se pierde voz: %s" % d)
    out, d = O.clean_head(np.concatenate([sil(0.3), murmur(0.2), sil(0.15), v]), sr)
    ok(len(out) >= len(v) + int(sr * 0.3), "con una pausa corta el sonido previo debe conservarse: %s" % d)
    out, d = O.clean_head(np.concatenate([sil(0.2), murmur(0.8), sil(0.5), v]), sr)
    ok(len(out) >= len(v) + int(sr * 0.8), "un sonido previo largo no es murmullo: %s" % d)
    word = speech(0.3)
    out, d = O.clean_head(np.concatenate([sil(0.2), word, sil(0.45), v]), sr)
    ok(len(out) >= len(v) + len(word), "cortó una palabra real antes de la pausa: %s" % d)
    out, d = O.clean_head(np.concatenate([sil(0.5), murmur(0.2) * 0.25, sil(0.4), v * 0.25]), sr)
    ok(d["reason"] == "murmullo" and len(out) >= len(v), "con una voz grabada más baja no detecta el murmullo: %s" % d)
    ok(np.abs(out[:int(sr * 0.002)]).max() < 0.05, "el inicio debe entrar con fundido (sin chasquido)")
    hum = (0.05 * np.sin(2 * np.pi * 35 * t(2.0))).astype(np.float32)
    y, h = O.highpass(np.concatenate([v[: sr], hum, v[: sr]]), sr)
    seg = y[sr + 2400: sr + int(sr * 1.8)]
    ok(h["applied"] and float(np.sqrt(np.mean(seg ** 2))) < 0.004, "el filtro no quita el retumbo de 35 Hz")
    core = y[int(sr * 0.2): int(sr * 0.8)]
    ref = v[int(sr * 0.2): int(sr * 0.8)]
    ok(float(np.sqrt(np.mean((core - ref) ** 2))) < 0.01 * float(np.sqrt(np.mean(ref ** 2))) + 1e-3, "el filtro cambia la voz")
    detail = "detección con numpy"
else:
    detail = "sin numpy: solo la conexión"

print("check-qwen-onset-lab41.py OK (%d verificaciones) · %s" % (checks, detail))
