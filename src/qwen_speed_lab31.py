# Lab.31 · Velocidad de Qwen3-TTS sin perder entonación.
#
# 1. balanced_chunks: corta solo al final de una oración y reparte las oraciones en fragmentos de
#    tamaño parecido (el lote tarda lo que tarda su fragmento más largo). Si hay lotes, arma
#    tantos fragmentos como entren en el lote sin bajar de min_chars.
# 2. join_pieces: cose las uniones (recorta silencios, pausa fija entre oraciones, fundido corto
#    e iguala el volumen de cada fragmento).
# 3. PredictorGraphs: reemplaza code_predictor.generate (15 pasos por frame, HF generate con
#    mucha espera de Python) por el mismo cálculo desenrollado y grabado en un CUDA graph.
#    Antes de usarlo verifica contra el generate original; ante cualquier falla vuelve al original.
import math
import re
import time
import types

try:
    import numpy as np
except ImportError:  # los checks de CI corren sin numpy; el worker siempre lo tiene
    np = None

SENTENCE_END = re.compile(r"(?<=[.!?…])[\"'»”)\]]*\s+")
SOFT_BREAK = re.compile(r"(?<=[;:,])\s+")


def _split_long(sentence, max_chars):
    """Una oración más larga que max_chars: corta en ; : , (o entre palabras) en tramos parejos."""
    if len(sentence) <= max_chars:
        return [sentence]
    parts = []
    for part in SOFT_BREAK.split(sentence):
        part = part.strip()
        if not part:
            continue
        if len(part) <= max_chars:
            parts.append(part)
            continue
        words = part.split(" ")
        pieces = max(2, math.ceil(len(part) / float(max_chars)))
        bounds = _partition([len(w) for w in words], pieces)
        parts.extend(" ".join(words[a:b]) for a, b in bounds)
    groups = max(1, math.ceil(len(sentence) / float(max_chars)))
    while True:
        bounds = _partition([len(x) for x in parts], groups)
        out = [" ".join(parts[a:b]) for a, b in bounds]
        if max(len(x) for x in out) <= max_chars or groups >= len(parts):
            return out
        groups += 1


def sentences(text, max_chars=360):
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if not text:
        return []
    out = []
    for s in SENTENCE_END.split(text):
        s = s.strip()
        if s:
            out.extend(_split_long(s, max_chars))
    return out


def _partition(lengths, groups):
    """Reparte la lista (en orden) en `groups` tramos contiguos minimizando el tramo más largo."""
    n = len(lengths)
    groups = max(1, min(groups, n))
    prefix = [0]
    for x in lengths:
        prefix.append(prefix[-1] + x)
    INF = float("inf")
    # best[g][i]: mejor máximo usando g tramos para las primeras i oraciones
    best = [[INF] * (n + 1) for _ in range(groups + 1)]
    cut = [[0] * (n + 1) for _ in range(groups + 1)]
    best[0][0] = 0
    for g in range(1, groups + 1):
        for i in range(g, n + 1):
            for j in range(g - 1, i):
                # +1 por el espacio entre oraciones
                cost = max(best[g - 1][j], prefix[i] - prefix[j] + (i - j - 1))
                if cost < best[g][i]:
                    best[g][i] = cost
                    cut[g][i] = j
    bounds, i = [], n
    for g in range(groups, 0, -1):
        j = cut[g][i]
        bounds.append((j, i))
        i = j
    return list(reversed(bounds))


def balanced_chunks(text, max_chars=360, min_chars=200, batch_size=1):
    sents = sentences(text, max_chars)
    if not sents:
        return []
    total = sum(len(s) for s in sents) + len(sents) - 1
    groups = max(1, math.ceil(total / float(max_chars)))
    if batch_size > 1:
        # llenar el lote sin bajar de min_chars por fragmento
        groups = max(groups, min(batch_size, int(total // max(1, min_chars))))
    groups = min(groups, len(sents))
    while True:
        bounds = _partition([len(s) for s in sents], groups)
        parts = [" ".join(sents[a:b]) for a, b in bounds]
        if max(len(p) for p in parts) <= max_chars or groups >= len(sents):
            return parts
        groups += 1


def _frame_db(audio, sr, frame_sec=0.02):
    hop = max(1, int(sr * frame_sec))
    n = len(audio) // hop
    if n <= 0:
        return np.zeros(0), hop
    frames = audio[: n * hop].astype(np.float64).reshape(n, hop)
    rms = np.sqrt(np.mean(frames * frames, axis=1) + 1e-12)
    return 20.0 * np.log10(rms + 1e-12), hop


def _trim(audio, sr, keep_sec=0.04):
    """Recorta el silencio de las puntas (relativo al pico del fragmento)."""
    db, hop = _frame_db(audio, sr)
    if not len(db):
        return audio
    voiced = np.where(db > max(-60.0, float(np.max(db)) - 42.0))[0]
    if not len(voiced):
        return audio
    keep = int(sr * keep_sec)
    start = max(0, voiced[0] * hop - keep)
    end = min(len(audio), (voiced[-1] + 1) * hop + keep)
    return audio[start:end]


def _voiced_rms(audio, sr):
    db, _ = _frame_db(audio, sr)
    if not len(db):
        return 0.0
    voiced = db[db > float(np.max(db)) - 30.0]
    if not len(voiced):
        return 0.0
    return float(np.mean(10.0 ** (voiced / 20.0)))


def join_pieces(pieces, sr, pause_sec=0.30, fade_sec=0.015, max_gain_db=3.0):
    pieces = [np.asarray(p, dtype=np.float32) for p in pieces if p is not None and len(p)]
    if not pieces:
        return np.zeros(0, dtype=np.float32), {}
    if len(pieces) == 1:
        return pieces[0], {"join_pieces": 1}
    trimmed = [_trim(p, sr) for p in pieces]
    levels = [_voiced_rms(p, sr) for p in trimmed]
    ref = float(np.median([x for x in levels if x > 0])) if any(x > 0 for x in levels) else 0.0
    fade = max(1, int(sr * fade_sec))
    ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
    out, gains = [], []
    for idx, (p, lvl) in enumerate(zip(trimmed, levels)):
        gain_db = 0.0
        if ref > 0 and lvl > 0:
            gain_db = max(-max_gain_db, min(max_gain_db, 20.0 * math.log10(ref / lvl)))
        p = p * np.float32(10.0 ** (gain_db / 20.0))
        if len(p) > 2 * fade:
            p = p.copy()
            if idx > 0:
                p[:fade] *= ramp
            if idx < len(trimmed) - 1:
                p[-fade:] *= ramp[::-1]
        gains.append(round(gain_db, 2))
        if out:
            out.append(np.zeros(int(sr * pause_sec), dtype=np.float32))
        out.append(p.astype(np.float32))
    audio = np.concatenate(out)
    peak = float(np.max(np.abs(audio))) if len(audio) else 0.0
    if peak > 0.99:
        audio = audio * np.float32(0.99 / peak)
    return audio, {"join_pieces": len(pieces), "join_pause_ms": int(pause_sec * 1000), "join_gains_db": gains}


# ---------------------------------------------------------------- CUDA graphs del predictor

class PredictorGraphs:
    MAX_GRAPHS = 12
    MIN_AGREEMENT = 0.85

    def __init__(self, predictor):
        import torch
        from qwen_tts.core.models.modeling_qwen3_tts import apply_rotary_pos_emb, repeat_kv
        self.torch = torch
        self.rope = apply_rotary_pos_emb
        self.repeat_kv = repeat_kv
        self.p = predictor
        self.orig = predictor.generate
        self.cfg = predictor.config
        self.steps = int(self.cfg.num_code_groups) - 1
        self.positions = self.steps + 1  # 2 de entrada + (steps - 1) pasos
        self.model = predictor.model
        if getattr(self.model, "has_sliding_layers", False):
            raise RuntimeError("el predictor usa atención deslizante")
        param = next(predictor.parameters())
        self.device, self.dtype = param.device, param.dtype
        pos = torch.arange(self.positions, device=self.device).unsqueeze(0)
        probe = torch.zeros(1, self.positions, int(self.cfg.hidden_size), device=self.device, dtype=self.dtype)
        with torch.inference_mode():
            self.cos, self.sin = self.model.rotary_emb(probe, pos)
        self.enabled = True
        self.active = True
        self.verified = False
        self.reason = ""
        self.graphs = {}
        self.pool = None
        self.stats = {"captures": 0, "replays": 0, "fallbacks": 0, "capture_ms": 0, "agreement": None}

    # cálculo desenrollado: mismo orden que Qwen3TTSTalkerCodePredictorModel + lm_head[paso]
    def _layers(self, x, pos0, n, kc, vc):
        torch = self.torch
        cos, sin = self.cos[:, pos0:pos0 + n], self.sin[:, pos0:pos0 + n]
        for li, layer in enumerate(self.model.layers):
            attn = layer.self_attn
            residual = x
            hs = layer.input_layernorm(x)
            b = hs.shape[0]
            shape = (b, n, -1, attn.head_dim)
            q = attn.q_norm(attn.q_proj(hs).view(shape)).transpose(1, 2)
            k = attn.k_norm(attn.k_proj(hs).view(shape)).transpose(1, 2)
            v = attn.v_proj(hs).view(shape).transpose(1, 2)
            q, k = self.rope(q, k, cos, sin)
            kc[li][:, :, pos0:pos0 + n].copy_(k)
            vc[li][:, :, pos0:pos0 + n].copy_(v)
            keys = self.repeat_kv(kc[li][:, :, :pos0 + n], attn.num_key_value_groups)
            vals = self.repeat_kv(vc[li][:, :, :pos0 + n], attn.num_key_value_groups)
            weights = torch.matmul(q, keys.transpose(2, 3)) * attn.scaling
            if n > 1:
                mask = torch.ones(n, pos0 + n, dtype=torch.bool, device=x.device).tril(diagonal=pos0)
                weights = weights.masked_fill(~mask, float("-inf"))
            weights = torch.softmax(weights, dim=-1, dtype=torch.float32).to(q.dtype)
            out = torch.matmul(weights, vals).transpose(1, 2).reshape(b, n, -1)
            x = residual + attn.o_proj(out)
            x = x + layer.mlp(layer.post_attention_layernorm(x))
        return self.model.norm(x)

    def _sample(self, logits, skey):
        torch = self.torch
        do_sample, temperature, top_k, top_p = skey
        scores = logits.float()
        if not do_sample:
            return scores.argmax(-1)
        if temperature != 1.0:
            scores = scores / temperature
        if top_k > 0:
            k = min(top_k, scores.shape[-1])
            kth = torch.topk(scores, k, dim=-1).values[..., -1:]
            scores = scores.masked_fill(scores < kth, float("-inf"))
        if top_p < 1.0:
            sorted_scores, sorted_idx = torch.sort(scores, descending=False, dim=-1)
            cum = sorted_scores.softmax(dim=-1).cumsum(dim=-1)
            remove = cum <= (1.0 - top_p)
            remove[..., -1:] = False
            scores = scores.masked_fill(remove.scatter(-1, sorted_idx, remove), float("-inf"))
        probs = torch.softmax(scores, dim=-1)
        # muestreo multinomial con la exponencial (equivalente y apto para CUDA graphs)
        noise = torch.empty_like(probs).exponential_(1.0)
        return (probs / noise).argmax(-1)

    def _cache(self, b):
        torch = self.torch
        shape = (b, int(self.cfg.num_key_value_heads), self.positions, int(getattr(self.cfg, "head_dim", self.cfg.hidden_size // self.cfg.num_attention_heads)))
        kc = [torch.zeros(shape, device=self.device, dtype=self.dtype) for _ in self.model.layers]
        vc = [torch.zeros(shape, device=self.device, dtype=self.dtype) for _ in self.model.layers]
        return kc, vc

    def _run(self, embeds, kc, vc, skey, forced=None):
        torch = self.torch
        emb = self.model.get_input_embeddings()
        x = self.p.small_to_mtp_projection(embeds)
        h = self._layers(x, 0, x.shape[1], kc, vc)
        logits = self.p.lm_head[0](h[:, -1])
        tok = self._sample(logits, skey)
        toks = [tok]
        for s in range(1, self.steps):
            feed = forced[:, s - 1] if forced is not None else tok
            x = self.p.small_to_mtp_projection(emb[s - 1](feed.unsqueeze(1)))
            h = self._layers(x, s + 1, 1, kc, vc)
            tok = self._sample(self.p.lm_head[s](h[:, -1]), skey)
            toks.append(tok)
        return torch.stack(toks, dim=1)

    def _skey(self, kwargs):
        gc = getattr(self.p, "generation_config", None)
        def pick(name, default):
            v = kwargs.get(name)
            if v is None and gc is not None:
                v = getattr(gc, name, None)
            return default if v is None else v
        do_sample = bool(pick("do_sample", False))
        return (do_sample, float(pick("temperature", 1.0)), int(pick("top_k", 50) or 0), float(pick("top_p", 1.0)))

    def _verify(self, embeds):
        """Compara contra el generate original (greedy, con las mismas fichas como entrada)."""
        torch = self.torch
        ref = self.orig(inputs_embeds=embeds, max_new_tokens=self.steps, do_sample=False,
                        output_hidden_states=False, return_dict_in_generate=True).sequences
        kc, vc = self._cache(embeds.shape[0])
        mine = self._run(embeds, kc, vc, (False, 1.0, 0, 1.0), forced=ref)
        agreement = float((mine == ref).float().mean().item())
        self.stats["agreement"] = round(agreement, 4)
        if agreement < self.MIN_AGREEMENT:
            raise RuntimeError(f"la verificación numérica no coincide ({agreement * 100:.1f}%)")
        self.verified = True

    def _capture(self, b, dim, skey):
        torch = self.torch
        key = (b, dim, skey)
        entry = self.graphs.get(key)
        if entry is not None:
            return entry
        if len(self.graphs) >= self.MAX_GRAPHS:
            self.graphs.clear()
        started = time.perf_counter()
        static_in = torch.zeros(b, 2, dim, device=self.device, dtype=self.dtype)
        kc, vc = self._cache(b)
        side = torch.cuda.Stream()
        side.wait_stream(torch.cuda.current_stream())
        with torch.cuda.stream(side):
            for _ in range(2):
                self._run(static_in, kc, vc, skey)
        torch.cuda.current_stream().wait_stream(side)
        graph = torch.cuda.CUDAGraph()
        with torch.cuda.graph(graph, pool=self.pool):
            static_out = self._run(static_in, kc, vc, skey)
        self.pool = graph.pool()
        entry = (graph, static_in, static_out, kc, vc)
        self.graphs[key] = entry
        self.stats["captures"] += 1
        self.stats["capture_ms"] += round((time.perf_counter() - started) * 1000)
        return entry

    def generate(self, *args, **kwargs):
        embeds = kwargs.get("inputs_embeds")
        if (not self.enabled or not self.active or args or embeds is None or embeds.device.type != "cuda"
                or embeds.dim() != 3 or embeds.shape[1] != 2 or int(kwargs.get("max_new_tokens") or 0) != self.steps):
            if self.enabled and self.active:
                self.stats["fallbacks"] += 1
            return self.orig(*args, **kwargs)
        torch = self.torch
        try:
            with torch.inference_mode():
                if not self.verified:
                    self._verify(embeds)
                graph, static_in, static_out, _, _ = self._capture(int(embeds.shape[0]), int(embeds.shape[2]), self._skey(kwargs))
                static_in.copy_(embeds)
                graph.replay()
                self.stats["replays"] += 1
                return types.SimpleNamespace(sequences=static_out.clone())
        except Exception as exc:
            self.active = False
            self.reason = str(exc)[:300]
            self.graphs.clear()
            self.pool = None
            return self.orig(*args, **kwargs)

    def status(self):
        return {"enabled": self.enabled, "active": self.enabled and self.active, "verified": self.verified,
                "reason": self.reason, **self.stats}


def apply_predictor_graphs(model, enabled):
    """Instala o desactiva los CUDA graphs en el predictor del modelo Qwen3TTSModel cargado."""
    core = getattr(model, "model", None)
    talker = getattr(core, "talker", None) if core is not None else None
    predictor = getattr(talker, "code_predictor", None) if talker is not None else None
    if predictor is None:
        return {"enabled": bool(enabled), "active": False, "reason": "el modelo no expone el predictor"}
    graphs = getattr(predictor, "_gec_lab31_graphs", None)
    if not enabled:
        if graphs is not None:
            graphs.enabled = False
            return graphs.status()
        return {"enabled": False, "active": False, "reason": ""}
    if graphs is None:
        try:
            import torch
            if not torch.cuda.is_available():
                return {"enabled": True, "active": False, "reason": "sin GPU CUDA"}
            graphs = PredictorGraphs(predictor)
        except Exception as exc:
            return {"enabled": True, "active": False, "reason": f"no se pudo preparar: {exc}"[:300]}
        predictor._gec_lab31_graphs = graphs
        predictor.generate = graphs.generate
    graphs.enabled = True
    return graphs.status()


def predictor_graphs_status(model):
    core = getattr(model, "model", None)
    talker = getattr(core, "talker", None) if core is not None else None
    predictor = getattr(talker, "code_predictor", None) if talker is not None else None
    graphs = getattr(predictor, "_gec_lab31_graphs", None) if predictor is not None else None
    return graphs.status() if graphs is not None else {"enabled": False, "active": False, "reason": ""}
