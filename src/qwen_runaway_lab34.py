# Lab.34 · Qwen3-TTS que no se detiene.
# A veces el talker no emite el fin de la locución: sigue generando sin texto que leer hasta max_new_tokens
# (2048 pasos a 12,5 Hz = 2 min 44 s) y eso sale como un zumbido grave y distorsionado al final del fragmento.
# Para la salida es parte de la noticia, así que no pasa a la siguiente hasta que termina el ruido.
#   max_new_tokens(text): tope de pasos acorde al largo del texto (en vez de 2048 fijos).
#   inspect(audio, sr, text, cap_sec): detecta el fragmento descontrolado (llegó al tope, dura demasiado para su
#       texto o termina en un tramo largo que no es voz) y dónde termina la voz.
#   cut(audio, sr, info): último recurso si regenerar no alcanza: corta donde termina la voz, con fundido corto.
# Sin torch; inspect y cut usan numpy (el worker siempre lo tiene).
import math

FRAME_HZ = 12.5          # pasos del talker por segundo de audio
CHARS_PER_SEC = 14.0     # lectura de noticiero en español (texto ya normalizado)
MIN_LIMIT_SEC = 14.0
TAIL_MAX_SEC = 2.5       # más que esto sin voz al final del fragmento = descontrolado


def _chars(text):
    return len(" ".join(str(text or "").split()))


def expected_sec(text):
    return max(1.0, _chars(text) / CHARS_PER_SEC)


def limit_sec(text):
    """Duración máxima razonable de un fragmento: el doble de lo esperado más un margen."""
    return max(MIN_LIMIT_SEC, expected_sec(text) * 2.0 + 6.0)


def max_new_tokens(text, ceiling=2048):
    """Tope de pasos del talker para el texto (con margen sobre limit_sec, sin pasar del tope original)."""
    return int(min(int(ceiling), max(160, math.ceil(limit_sec(text) * 1.15 * FRAME_HZ))))


def _frames(audio, sr, frame_sec=0.04):
    import numpy as np
    a = np.asarray(audio, dtype=np.float64).reshape(-1)
    hop = max(1, int(sr * frame_sec))
    n = len(a) // hop
    if n <= 0:
        return np.zeros((0, hop)), hop
    return a[: n * hop].reshape(n, hop), hop


def speech_end(audio, sr):
    """Fin (en s) del último tramo con voz: energía suficiente y la mayor parte en la banda de la voz.
    El ruido del talker descontrolado se concentra por debajo de ~250 Hz; la voz, entre 300 y 3400 Hz."""
    import numpy as np
    fr, hop = _frames(audio, sr)
    if not len(fr):
        return 0.0
    win = np.hanning(fr.shape[1])
    spec = np.abs(np.fft.rfft(fr * win, axis=1)) ** 2
    freqs = np.fft.rfftfreq(fr.shape[1], 1.0 / sr)
    total = spec[:, (freqs >= 60) & (freqs <= 8000)].sum(axis=1) + 1e-12
    voice = spec[:, (freqs >= 300) & (freqs <= 3400)].sum(axis=1)
    ratio = voice / total
    db = 10.0 * np.log10(np.mean(fr * fr, axis=1) + 1e-12)
    loud = db > max(-55.0, float(np.percentile(db, 90)) - 35.0)
    speech = loud & (ratio >= 0.35)
    # tramos de al menos 3 cuadros (120 ms) seguidos: un chasquido suelto no cuenta como voz
    end, run = 0, 0
    for i, s in enumerate(speech):
        run = run + 1 if s else 0
        if run >= 3:
            end = i + 1
    return end * hop / float(sr)


def inspect(audio, sr, text, cap_sec=0.0):
    dur = len(audio) / float(sr) if sr else 0.0
    exp = expected_sec(text)
    lim = limit_sec(text)
    v_end = speech_end(audio, sr) if dur > 0 else 0.0
    tail = max(0.0, dur - v_end)
    reasons = []
    if cap_sec and dur >= float(cap_sec) - 0.6:
        reasons.append("tope")
    if dur > lim:
        reasons.append("largo")
    if tail > TAIL_MAX_SEC and v_end > 0:
        reasons.append("cola")
    return {
        "runaway": bool(reasons),
        "reason": "+".join(reasons),
        "audio_sec": round(dur, 2),
        "expected_sec": round(exp, 2),
        "limit_sec": round(lim, 2),
        "voice_end_sec": round(v_end, 2),
        "tail_sec": round(tail, 2),
    }


def score(info):
    """Menor es mejor: cuánto sobra respecto de lo esperado (para elegir entre el original y el regenerado)."""
    return max(float(info.get("tail_sec") or 0), float(info.get("audio_sec") or 0) - float(info.get("limit_sec") or 0))


def cut(audio, sr, info, keep_sec=0.25, fade_sec=0.03):
    """Corta donde termina la voz. Si no hay un final claro (el ruido parece voz), corta en la última pausa
    antes de 1,5 veces lo esperado; si tampoco hay pausa, en ese punto."""
    import numpy as np
    a = np.asarray(audio, dtype=np.float32).reshape(-1)
    dur = len(a) / float(sr)
    v_end = float(info.get("voice_end_sec") or 0)
    hard = float(info.get("expected_sec") or 0) * 1.5 + 2.0
    if 0 < v_end < dur - 0.3 and v_end <= max(hard, float(info.get("limit_sec") or 0)):
        end = v_end + keep_sec
    else:
        end = min(dur, hard)
        fr, hop = _frames(a[: int(end * sr)], sr)
        if len(fr):
            db = 10.0 * np.log10(np.mean(fr.astype(np.float64) ** 2, axis=1) + 1e-12)
            quiet = db < float(np.percentile(db, 90)) - 30.0
            # última pausa de al menos 250 ms en la segunda mitad
            run, best = 0, -1
            for i, q in enumerate(quiet):
                run = run + 1 if q else 0
                if run >= 6 and i * hop > len(fr) * hop / 2:
                    best = i
            if best > 0:
                end = (best - 2) * hop / float(sr)
    n = max(1, min(len(a), int(end * sr)))
    out = a[:n].copy()
    f = max(1, min(n // 2, int(sr * fade_sec)))
    out[-f:] *= np.linspace(1.0, 0.0, f, dtype=np.float32)
    return out
