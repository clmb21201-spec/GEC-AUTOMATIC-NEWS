# Lab.34 · voz de Qwen que no se detiene (qwen_runaway_lab34.py y su conexión con el worker).
# Sin torch. La detección y el recorte se prueban solo si hay numpy (en CI puede no estar).
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, os.path.join(ROOT, "src"))
import qwen_runaway_lab34 as R

checks = 0


def ok(cond, msg):
    global checks
    checks += 1
    if not cond:
        raise SystemExit("check-qwen-runaway-lab34.py: " + msg)


# tope de pasos acorde al texto (antes 2048 fijos = 2 min 44 s)
ok(R.max_new_tokens("a" * 360) < 2048, "un fragmento de 360 caracteres sigue con el tope de 2048 pasos")
ok(R.max_new_tokens("a" * 360) / R.FRAME_HZ > R.limit_sec("a" * 360), "el tope no deja margen sobre el límite del fragmento")
ok(R.max_new_tokens("a" * 360) / R.FRAME_HZ >= 360 / 10.0 + 10, "el tope cortaría una lectura lenta (10 caracteres/s)")
ok(R.max_new_tokens("a" * 40) >= 160, "el tope de un texto corto es demasiado bajo")
ok(R.max_new_tokens("a" * 5000) == 2048, "el tope pasa del original con un texto muy largo")
ok(R.max_new_tokens("a" * 5000, 1000) == 1000, "no respeta el tope configurado")
ok(R.limit_sec("") >= R.MIN_LIMIT_SEC, "límite mínimo")
ok(abs(R.expected_sec("palabra  " * 10) - len(" ".join(["palabra"] * 10)) / R.CHARS_PER_SEC) < 1e-6, "los espacios repetidos cuentan como texto")

# conexión con el worker y con el EXE
worker = open(os.path.join(ROOT, "src", "tts_lab_worker.py"), encoding="utf-8").read()
ok("import qwen_runaway_lab34 as RUNAWAY" in worker, "el worker no importa qwen_runaway_lab34")
ok(worker.count("cap_sec = _lab34_cap(generation, text)") == 2, "el tope no se aplica en las dos llamadas de un fragmento (fine-tuned y zero-shot)")
ok("cap_sec = _lab34_cap(generation, texts)" in worker, "el tope no se aplica en los lotes")
ok(worker.count("audio_item = fix_runaway(") == 2, "falta revisar los fragmentos en uno de los dos caminos (lotes / uno por uno)")
ok('"runaway": runaway_events' in worker, "el resultado no informa los fragmentos corregidos")
ok("batchBenchmarkMode" in worker.split("runaway_on =")[1].split("\n")[0], "la revisión debe omitirse en el modo de medición por lotes")
ps1 = open(os.path.join(ROOT, "scripts", "prepare-windows-runtime.ps1"), encoding="utf-8").read()
ok("qwen_runaway_lab34.py" in ps1, "prepare-windows-runtime.ps1 no copia qwen_runaway_lab34.py junto al worker")

try:
    import numpy as np
except Exception:
    np = None

if np is not None:
    sr = 24000
    rng = np.random.default_rng(7)

    def speechlike(sec):
        t = np.arange(int(sec * sr)) / sr
        car = sum(np.sin(2 * np.pi * f * t + rng.random() * 6) for f in (120, 240, 360, 700, 1100, 1700, 2500)) / 7
        env = (0.5 + 0.5 * np.sin(2 * np.pi * 4 * t)) ** 2 * ((t % 5) < 4.6)
        return (car * env * 0.3).astype(np.float32)

    def drone(sec):
        # el ruido del talker descontrolado: grave, parejo, con un bache cada ~3 s
        t = np.arange(int(sec * sr)) / sr
        d = sum(np.sin(2 * np.pi * f * t) * a for f, a in ((55, 1), (62, .8), (70, .7), (78, .5), (172, .3)))
        return (d * 0.12 * (1 - 0.6 * ((t % 3) < 0.4))).astype(np.float32)

    text = "palabra " * 35  # ~20 s esperados
    sp = speechlike(20)
    clean = np.concatenate([sp, np.zeros(int(.3 * sr), np.float32)])
    info = R.inspect(clean, sr, text)
    ok(not info["runaway"], f"marcó como descontrolado un fragmento sano: {info}")

    noisy = np.concatenate([sp, drone(30)])
    info = R.inspect(noisy, sr, text)
    ok(info["runaway"] and "cola" in info["reason"], f"no detectó el ruido grave al final: {info}")
    ok(abs(info["voice_end_sec"] - 19.6) < 0.6, f"no ubicó el fin de la voz: {info}")
    out = R.cut(noisy, sr, info)
    ok(19.0 < len(out) / sr < 20.5, f"el recorte no quedó donde termina la voz: {len(out) / sr:.2f} s")
    ok(abs(float(out[-1])) < 1e-3, "el recorte no termina con fundido")

    short = np.concatenate([sp, drone(10)])
    ok(R.inspect(short, sr, text)["runaway"], "no detectó 10 s de ruido (por debajo del límite de duración)")

    silent_tail = np.concatenate([sp, np.zeros(int(6 * sr), np.float32)])
    ok(R.inspect(silent_tail, sr, text)["reason"] == "cola", "no detectó 6 s de silencio al final")

    cap = R.max_new_tokens(text) / R.FRAME_HZ
    at_cap = np.concatenate([sp, drone(60)])[: int(cap * sr)]
    ok("tope" in R.inspect(at_cap, sr, text, cap)["reason"], "no detectó un fragmento que llegó al tope de pasos")

    # el ruido parece voz (no hay fin claro): corta en una pausa antes de 1,5 veces lo esperado
    babble = np.concatenate([sp, speechlike(60)])
    info = R.inspect(babble, sr, text)
    ok(info["runaway"] and "largo" in info["reason"], f"no detectó un fragmento demasiado largo: {info}")
    ok(len(R.cut(babble, sr, info)) / sr <= R.expected_sec(text) * 1.5 + 2.1, "el recorte de último recurso no respeta el máximo")
    ok(R.score(R.inspect(clean, sr, text)) < R.score(R.inspect(noisy, sr, text)), "score no prefiere el fragmento sano")
    with_numpy = "con numpy"
else:
    with_numpy = "sin numpy: detección no probada"

print(f"check-qwen-runaway-lab34.py OK ({checks} verificaciones, {with_numpy})")
