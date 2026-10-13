# Lab.41 · Murmullos de Qwen3-TTS antes de la primera palabra y retumbo grave en las pausas.
# Al clonar una voz, Qwen a veces genera uno o dos sonidos sueltos («mmm», tonales y graves) y hasta un segundo de
# silencio antes de empezar a leer. Además deja una componente muy grave (20–70 Hz) en algunas pausas.
#   clean_head(audio, sr): busca dónde empieza la voz de verdad (al menos 0,15 s sostenidos con frecuencias de habla)
#       y quita lo anterior solo si es silencio o si parece murmullo: sonidos cortos (≤ 0,5 s en total), casi sin
#       agudos y separados de la primera palabra por una pausa clara (≥ 0,3 s). Si no se cumple, no se toca nada
#       (para no cortar el comienzo de una palabra suave). Deja 60 ms antes de la voz y un fundido de 10 ms.
#   highpass(audio, sr): quita lo que está por debajo de ~60 Hz (rampa 40–70 Hz, sin fase) y la continua.
# Sin torch; usa numpy (el worker siempre lo tiene).
import math

FRAME_SEC = 0.02
HOP_SEC = 0.01
SPEECH_DB = -35.0          # nivel de voz sostenida
SPEECH_WIN_SEC = 0.15      # cuánto tiene que durar para contar como comienzo de la voz
SPEECH_HF_RATIO = 0.08     # parte de la energía entre 800 y 5000 Hz (la voz la tiene; el «mmm» casi no)
BLOB_DB = -50.0            # lo que pase de esto antes de la voz es un sonido suelto
QUIET_DB = -45.0           # pausa clara entre el murmullo y la voz
MAX_BLOB_SEC = 0.5
MIN_GAP_SEC = 0.3
MURMUR_HF_RATIO = 0.10
LEAD_SEC = 0.06
FADE_SEC = 0.01
MAX_CUT_SEC = 3.0


def _analyze(audio, sr):
    import numpy as np
    x = np.asarray(audio, dtype=np.float32).reshape(-1)
    win, hop = max(16, int(sr * FRAME_SEC)), max(8, int(sr * HOP_SEC))
    if x.size < win:
        return x, hop, np.zeros(0), np.zeros(0), np.zeros(0)
    n = 1 + (x.size - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    frames = x[idx] * np.hanning(win)[None, :].astype(np.float32)
    rms = np.sqrt(np.mean(np.square(x[idx].astype(np.float64)), axis=1))
    db = 20.0 * np.log10(rms + 1e-9)
    spec = np.square(np.abs(np.fft.rfft(frames, axis=1)))
    freqs = np.fft.rfftfreq(win, 1.0 / sr)
    band = (freqs >= 120) & (freqs < 5000)
    hf = (freqs >= 800) & (freqs < 5000)
    band_e = spec[:, band].sum(axis=1)
    hf_e = spec[:, hf].sum(axis=1)
    return x, hop, db, band_e, hf_e


def find_onset(audio, sr):
    """Índice de cuadro donde empieza la voz sostenida, o -1."""
    import numpy as np
    x, hop, db, band_e, hf_e = _analyze(audio, sr)
    w = max(3, int(round(SPEECH_WIN_SEC / HOP_SEC)))
    if db.size < w:
        return -1, x, hop, db, band_e, hf_e
    # umbral relativo para voces grabadas más bajas: 18 dB bajo el nivel típico de la locución, nunca más alto que -35
    thr = min(SPEECH_DB, float(np.percentile(db, 90)) - 18.0)
    loud = db > thr
    for i in range(0, db.size - w + 1):
        seg = slice(i, i + w)
        if loud[seg].mean() < 0.7:
            continue
        ratio = hf_e[seg].sum() / max(band_e[seg].sum(), 1e-12)
        if ratio < SPEECH_HF_RATIO:
            continue
        j = i
        while j > 0 and db[j - 1] > min(BLOB_DB, thr - 15.0):
            j -= 1
        return j, x, hop, db, band_e, hf_e
    return -1, x, hop, db, band_e, hf_e


def clean_head(audio, sr):
    """Devuelve (audio, diag). diag['applied'] indica si se recortó algo."""
    import numpy as np
    diag = {"applied": False, "reason": "", "cut_sec": 0.0, "murmur_sec": 0.0}
    if audio is None or not sr:
        return audio, diag
    onset, x, hop, db, band_e, hf_e = find_onset(audio, sr)
    if onset < 0:
        diag["reason"] = "sin voz clara"
        return audio, diag
    onset_sec = onset * hop / float(sr)
    lead = int(sr * LEAD_SEC)
    if onset_sec * sr <= lead + int(sr * 0.05):
        diag["reason"] = "empieza bien"
        return audio, diag
    pre = db[:onset]
    blob = pre > BLOB_DB
    if blob.any():
        blob_sec = blob.sum() * HOP_SEC
        last_blob = int(np.nonzero(blob)[0][-1])
        gap_sec = (onset - last_blob - 1) * HOP_SEC
        quiet_gap = bool((pre[last_blob + 1:] < QUIET_DB).all()) if last_blob + 1 < onset else False
        ratio = float(hf_e[:onset][blob].sum() / max(band_e[:onset][blob].sum(), 1e-12))
        murmur = blob_sec <= MAX_BLOB_SEC and gap_sec >= MIN_GAP_SEC and quiet_gap and ratio <= MURMUR_HF_RATIO
        if murmur:
            cut = onset * hop - lead
            diag.update(reason="murmullo", murmur_sec=round(blob_sec, 3), murmur_hf_ratio=round(ratio, 3), gap_sec=round(gap_sec, 3))
        else:
            # no parece murmullo: solo se quita el silencio que hay antes del primer sonido
            first = int(np.nonzero(blob)[0][0])
            cut = first * hop - lead
            diag.update(reason="silencio inicial (sonido previo conservado)", murmur_sec=0.0)
    else:
        cut = onset * hop - lead
        diag["reason"] = "silencio inicial"
    cut = int(max(0, min(cut, int(sr * MAX_CUT_SEC))))
    if cut < int(sr * 0.05):
        diag["reason"] = diag["reason"] + " (menos de 50 ms, sin cambios)"
        return audio, diag
    out = np.array(x[cut:], dtype=np.float32, copy=True)
    fade = min(out.size, max(1, int(sr * FADE_SEC)))
    out[:fade] *= np.linspace(0.0, 1.0, fade, dtype=np.float32)
    diag.update(applied=True, cut_sec=round(cut / float(sr), 3), onset_sec=round(onset_sec, 3))
    return out, diag


def highpass(audio, sr, low_hz=40.0, high_hz=70.0):
    """Quita la continua y lo que está por debajo de ~60 Hz (rampa coseno entre low_hz y high_hz, sin desfase)."""
    import numpy as np
    x = np.asarray(audio, dtype=np.float64).reshape(-1)
    if x.size < 64 or not sr:
        return np.asarray(audio, dtype=np.float32), {"applied": False}
    n = 1 << int(math.ceil(math.log2(x.size + int(sr * 0.2))))
    pad = n - x.size
    xp = np.pad(x, (pad // 2, pad - pad // 2), mode="reflect" if x.size > pad else "constant")
    spec = np.fft.rfft(xp)
    f = np.fft.rfftfreq(n, 1.0 / sr)
    gain = np.ones_like(f)
    gain[f < low_hz] = 0.0
    ramp = (f >= low_hz) & (f < high_hz)
    gain[ramp] = 0.5 - 0.5 * np.cos(np.pi * (f[ramp] - low_hz) / (high_hz - low_hz))
    y = np.fft.irfft(spec * gain, n)[pad // 2: pad // 2 + x.size]
    removed = float(np.sqrt(np.mean(np.square(x - y)))) if x.size else 0.0
    return y.astype(np.float32), {"applied": True, "removed_rms_db": round(20.0 * math.log10(removed + 1e-9), 1)}
