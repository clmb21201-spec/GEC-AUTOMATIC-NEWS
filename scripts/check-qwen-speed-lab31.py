# Lab.31 · corte por oraciones y uniones de Qwen3-TTS (qwen_speed_lab31.py). Sin torch; las uniones solo si hay numpy.
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))
import qwen_speed_lab31 as L

checks = 0


def ok(cond, msg):
    global checks
    checks += 1
    if not cond:
        raise SystemExit("check-qwen-speed-lab31.py: " + msg)


S = [
    "El Ministerio de Economía anunció este martes un paquete de medidas para reactivar la inversión privada en las regiones del sur del país.",
    "Según el titular del sector, el plan incluye incentivos tributarios y la simplificación de trámites para proyectos de infraestructura.",
    "La medida fue recibida con cautela por los gremios empresariales, que pidieron conocer los detalles antes de pronunciarse.",
    "Por su parte, los gobernadores regionales señalaron que esperan una mayor coordinación con el Ejecutivo.",
    "El paquete será publicado en las próximas semanas en el diario oficial, según informó el ministerio.",
    "Los analistas estiman que el impacto se verá recién el próximo año. ¿Será suficiente?",
    "El debate, según los expertos, recién comienza.",
]
text = " ".join(S)
norm = lambda t: " ".join(t.split())

for batch in (1, 2, 4, 8):
    parts = L.balanced_chunks(text, 360, 200, batch)
    ok(norm(" ".join(parts)) == norm(text), f"el corte perdió o cambió texto (lote {batch})")
    ok(all(len(p) <= 360 for p in parts), f"fragmento mayor a 360 (lote {batch})")
    # solo corta al final de una oración
    ok(all(p.rstrip()[-1] in ".!?…" for p in parts), f"cortó a mitad de oración (lote {batch}): {parts}")

# fragmentos parejos: el más largo no supera en mucho al promedio (el lote tarda lo que el más largo)
parts = L.balanced_chunks(text, 360, 200, 4)
avg = sum(len(p) for p in parts) / len(parts)
ok(max(len(p) for p in parts) <= avg * 1.35, f"fragmentos desparejos: {[len(p) for p in parts]}")
# ~730 caracteres con lote 4: 3 fragmentos parejos (con 4 bajarían de ~200 caracteres)
ok(len(parts) == 3, f"se esperaban 3 fragmentos para {len(text)} caracteres con lote 4: {[len(p) for p in parts]}")

# con lotes, una nota larga se reparte en tantos fragmentos como entren sin bajar de ~200 caracteres
long_text = text + " " + text
parts = L.balanced_chunks(long_text, 360, 200, 8)
ok(len(parts) == min(8, len(long_text) // 200), f"no llenó el lote: {[len(p) for p in parts]}")
parts1 = L.balanced_chunks(long_text, 360, 200, 1)
ok(len(parts1) == -(-len(long_text) // 360) or len(parts1) == -(-len(long_text) // 360) + 1, f"sin lotes debe usar el mínimo de fragmentos: {[len(p) for p in parts1]}")

# oración única corta y oración larga sin puntos
ok(L.balanced_chunks("Una sola frase corta.", 360, 200, 8) == ["Una sola frase corta."], "frase corta")
huge = "palabra, " * 120 + "fin."
parts = L.balanced_chunks(huge, 360, 200, 4)
ok(all(len(p) <= 360 for p in parts) and min(len(p) for p in parts) > 150, f"oración larga mal repartida: {[len(p) for p in parts]}")
ok(norm(" ".join(parts)) == norm(huge), "la oración larga perdió texto")
ok(L.balanced_chunks("", 360, 200, 4) == [], "texto vacío")

if L.np is not None:
    np = L.np
    sr = 24000
    tone = lambda sec, amp: (amp * np.sin(2 * np.pi * 220 * np.arange(int(sr * sec)) / sr)).astype(np.float32)
    a = np.concatenate([np.zeros(int(sr * .3), np.float32), tone(1, .3), np.zeros(int(sr * .4), np.float32)])
    b = np.concatenate([np.zeros(int(sr * .1), np.float32), tone(1, .15), np.zeros(int(sr * .2), np.float32)])
    out, d = L.join_pieces([a, b], sr, 0.30)
    ok(d.get("join_pieces") == 2 and d.get("join_pause_ms") == 300, "diagnóstico de la unión")
    ok(abs(len(out) / sr - 2.38) < 0.15, f"recorte de silencios y pausa fija: {len(out) / sr:.2f} s")
    ok(all(abs(g) <= 3.0 for g in d["join_gains_db"]), "ajuste de volumen limitado a ±3 dB")
    ok(float(np.max(np.abs(out))) <= 0.99, "sin saturación")
    single, _ = L.join_pieces([a], sr)
    ok(len(single) == len(a), "un solo fragmento no se toca")

print(f"check-qwen-speed-lab31.py OK ({checks} verificaciones)")
