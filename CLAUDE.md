Responde siempre en español.

# GEC Automatic News (V2.0 TTS Lab)

App de escritorio Electron (Windows, portable) que arma una emisión automática de noticias: lee RSS, extrae la nota y su imagen, una IA local escribe titular, bajada y guion, un TTS local genera la voz, y la ventana de salida lo emite. Hay también enlatados (videos) y anuncios. La interfaz y los mensajes están en español.

## Cómo se trabaja en este repo

- La app se compila **solo en GitHub Actions** (`.github/workflows/build-windows.yml`, en `windows-latest`) con cada push a `main`. El artefacto es un EXE portable.
- Antes de hacer commit: `npm run check` (checks estáticos y de regresión; exige Node 22 y Python 3.12). Si algo falla, explicar la causa antes de cambiar código.
- El proyecto crece por **archivos versionados** que parchean a los anteriores (`renderer-0324.js` … `renderer-0332.js`, `output-0324.js` … `output-0331.js`, `services/*0329.js`, etc.). No reescribir ni borrar los anteriores: agregar comportamiento nuevo en archivos nuevos o en puntos acotados, y sumar su `node --check` al script `check` de `package.json`.
- `src/preload.js` inyecta los scripts versionados según la página (`control.html`, `output.html`) y expone `window.ECAPI` (API de salida para las páginas de output, API de control para el panel).
- Entrada: `src/bootstrap-v2lab.js` → cadena de bootstraps → `src/main.js`.

## Contrato de la ventana de salida

La salida escucha, vía `window.ECAPI.on`:
- `output:story` → `p.kind` (`news` | `canned`; los anuncios llegan como canned con `p.mediaRole === 'ad'`). Noticia: `p.title` (titular de la IA), `p.summary` (bajada de la IA), `p.category`, `p.pubDate`, `p.isExclusive`, `p.image` / `p.fallbackImage` / `p.preloadImage`, `p.audioUrl` (WAV del TTS, `file://`). Enlatado: `p.videoUrl`.
- `output:design` → colores, tipografías, tamaños, volúmenes, música (ver `output-0324.js` / `output-0325.js`).
- `output:control` → `play` | `pause` | `stop`.

Y **debe** responder `ECAPI.outputPlayback({type:'ended'|'error', source, kind, message})` al terminar o fallar cada pieza; sin eso la automatización no avanza.

La salida también se publica en red local (`services/outputLanServer.js`, EventSource `/events`) para OBS.

## Salida "Merlín" (presentador 3D)

Ver `INTEGRACION_MERLIN.md`. Resumen:
- Archivos: `src/output-merlin.html|js|css`, `src/output-merlin-web.html` (LAN, ruta `/merlin`), `src/renderer-merlin.js` (tarjeta "Modo de salida" en el panel), `src/assets/merlin/` (capas del set, `merlin-model.js` con el GLB incrustado, `presenter-config.js`), `src/vendor/three/` (three.js r147 UMD, sin CDN).
- El modo (`clasico` | `merlin`) se guarda en `data/presenter.json` vía IPC `presenter:get` / `presenter:set` en `main.js`; `createOutputWindow` carga la página según el modo. En 9:16 siempre es la clásica.
- **No modificar la salida clásica** (`output.html` y sus versionados) al trabajar en Merlín.
- `presenter-config.js` contiene `window.MERLIN_CONFIG`, el JSON exportado desde el prototipo web "Merlín en el set" (posiciones, cámaras, luz, lip sync, imagen de apoyo). Los valores de animación y escena salen de ahí, no se hardcodean.
- Dirección de cámaras: plano general al inicio y al volver de un enlatado o anuncio (~4 s), plano medio con la imagen de la nota en recuadro a la derecha y cintillo con solo el titular, alternando con pantalla completa (titular, bajada, categoría, fecha, exclusivo con el diseño de EC1). Primer plano reservado para despedida o pase a corte.
- Huesos usados: `BOCA_INF` (abre en X negativo), `BOCA_SUP` (X positivo), `PARPADOS_MAYA` (X: 0 abierto, 121 cerrado), `OJO_R`/`OJO_L`, `CABEZA`, `COLUMNA`, `ALA_SUP_R`/`ALA_SUP_L` (se reparentan a `COLUMNA` al cargar). Rotaciones relativas a la pose de reposo.
- Respaldos: si WebGL o el modelo fallan, vuelve a `output.html`; si el análisis de audio queda bloqueado, lip sync sintético.

## Intervenciones de Merlín (hechas)

Presentación, pase a corte, regreso y despedida con frases fijas (`src/assets/merlin/presenter-phrases.json`), audio generado con el TTS local y cacheado en `data/presenter-voice/`. Lógica en `presenterHost` (final de `src/main.js`); la salida maneja `p.kind === 'host'` y avisa el fin con `ECAPI.presenterHostPlayback`. En la salida clásica se omiten. Ver `INTEGRACION_MERLIN.md`.

## Merlín: subtítulos, cintillo, reloj, cámara, expresión, volumen y titulares (hechos)

Ver `INTEGRACION_MERLIN.md` (secciones "Diseño en pantalla", "Cámara", "Expresión", "Volumen normalizado" y "Titulares periódicos"). Opciones nuevas en `presenter-config.js`: `subtitulos`, `reloj`, `titulares`, `volumen`, `expresion`, `camaras.planoMedioCentradoAuto`.

- Tono (`p.tone`): lo devuelve la IA editorial (`editorial.js`) y se agrega a todos los payloads de noticia. Volumen de enlatados y anuncios: `renderer-media-loudness.js` mide con Web Audio, `services/mediaLoudnessMerlin.js` guarda en `data/media-loudness.json` y `main.js` agrega `p.audioGainDb` al payload `kind:'canned'`.

## Merlín: rig ampliado, animación orgánica, saludo y parallax (hechos)

Ver `INTEGRACION_MERLIN.md`, sección "Modelo y animación". Opciones nuevas en `presenter-config.js`: `gestos.saludo`, `apariencia.colorParpados`, `expresion.cejas.levantar`, `camaras.parallax`. La salida expone `window.__merlinOutput.setWavePoses / holdWave / playWave` (usadas por la herramienta de poses).

## Lab.30 (correcciones)

- Merlín: NDI solo en la vista clásica (`presenterNdiGuard` al final de `main.js` + `renderer-merlin-ndi-lab30.js`); vista previa de Merlín en el área de Diseño (`renderer-merlin-preview-lab30.js` carga `output-merlin-preview.html`, muda, con `output-merlin-preview-adapter.js`).
- Optimización: `services/releaseV2GpuIsolationLab30.js` libera la GPU entre voz e IA de texto (espera la salida real de los procesos), aborta si otro programa ocupa más de 2,5 GB de VRAM, mide la voz Qwen con 3 repeticiones sin la configuración de diagnóstico, descarta antes las configuraciones lentas de la IA de texto y permite cancelar (`renderer-optimization-lab30.js`: botón, tiempo transcurrido y restante).
- Qwen zero-shot: `tts_lab_worker.py` pasa a `qwen_tts` los `VoiceClonePromptItem` con la transcripción (con el dict fallaba con `'NoneType' object is not subscriptable`).
- Instalación de motores: `removeTorchShadow` es asíncrono (borrar PyTorch con `rmSync` congelaba la ventana).
- Limpieza de pausas de Chatterbox (`chatterbox_pause_cleanup_lab29.py`): se copia a `resources/runtime/tts-lab/` (`extraResources`) porque Python no puede leerla dentro de `app.asar`; antes no se ejecutaba en el EXE. Cada limpieza o fallo queda en `logs/chatterbox-cleanup.log`. Solo silencia bursts tipo ruido; los fragmentos tipo voz no se tocan para no cortar palabras.
- Subtítulos de Merlín: muestran lo mismo que lee la voz (titular + guion) y avanzan con la voz real: `presenterHost` manda `p.speechSegments` (tramos con voz del WAV) y la automatización `p.ttsScript`; cada oración se ancla a su pausa.
- Merlín: al ocultar un contenido o anuncio (pase, despedida) el video se pausa en el acto. Normalización: voz, contenidos y anuncios usan `p.audioGainDb`; la música de fondo no.

## Lab.31 (velocidad de Qwen3-TTS)

- `src/qwen_speed_lab31.py` (lo copia `prepare-windows-runtime.ps1` junto al worker; el worker lo importa agregando su carpeta a `sys.path`):
  - `balanced_chunks`: solo fine-tuned con `chunkMode:'sentences'`. Corta al final de una oración en fragmentos parejos de hasta `chunkChars` (360) y, con lotes, arma tantos como entren en el lote sin bajar de `minChunkChars` (200).
  - `join_pieces`: recorta silencios, pausa fija `joinPauseMs` (300), fundido de 15 ms y volumen parejo (±3 dB).
  - `PredictorGraphs`: el predictor de código (15 pasos por frame) desenrollado y grabado en un CUDA graph por tamaño de lote. Se verifica contra el `generate` original (greedy, forzado con las mismas fichas) en 8 frames reales, que mientras tanto genera el original: exige ≥ 60 % de fichas idénticas y ≥ 98 % idénticas o casi empatadas (logit a ≤ 0,5 del mejor en bf16). En bf16 el argmax de los últimos códigos cambia por redondeo; el criterio anterior (≥ 85 % en un solo frame de 15 fichas) rechazaba el fine-tuned con 73,3 %. Ante cualquier falla vuelve al original. Parámetro `predictorCudaGraphs`.
- `services/releaseV2QwenSpeedLab31.js`:
  - Después de la optimización de Lab.30 mide "Aceleración del predictor" (3 repeticiones con el mismo texto) y, solo en fine-tuned, una nota típica, una corta y la prueba de escucha. Los audios van a `data/tts-lab/ab-test/`.
  - Lo elegido se guarda por modelo en `data/tts-lab/qwen-speed-lab31.json` y se inyecta en cada `generate` de Qwen; la medición base siempre parte sin eso.
  - IPC `qwenSpeed:get` / `qwenSpeed:setChunkMode`; panel en `renderer-qwen-speed-lab31.js`.
- Insignia "SIN OPTIMIZAR" con el fine-tuned: el optimizador guardaba `optimization0321` sin `ttsOptimizationKey` y `releaseV2Lab` lo reemplazaba por la optimización anterior en caché. Ahora la clave se completa antes de guardar.

- Perfil de producción por modelo de voz (`services/releaseV2ProfileByModelLab31.js`, se instala al final): `tts-lab/active-production-profile.json` es uno solo por computadora y atado al modelo; cada perfil válido se archiva por modelo en `tts-lab/production-profiles-by-model.json` y al cargar la configuración con otro modelo se repone el suyo si sigue siendo compatible (misma computadora, runtime y modelo). Así zero-shot y fine-tuned no obligan a reoptimizar al alternar. `optimization-v2:clear` borra también el archivo. La voz de referencia (Qwen zero-shot, Chatterbox) no cuenta como otro modelo: el mismo módulo envuelve `fidelity.compatibility` para ignorarla (clave `qwen3tts:reference:base`, firma del runtime sin `reference=`).

## Lab.32 (lectura de códigos de documentos)

- `services/documentCodesSpeechLab32.js` (se instala al final de `bootstrap-v2lab.js`, envolviendo `PronunciationNormalizer.prototype.normalize`): antes de la pronunciación pasa a palabras los códigos de documentos oficiales. "N° 000081-2026-PE-ONP" → "número ochenta y uno, dos mil veintiséis, pe e, o ene pe": sin ceros a la izquierda, tramos separados por coma, siglas deletreadas salvo las que se dicen como palabra (4+ letras, 2+ vocales: Minsa, Sunat, Onpe). Reconoce N°/Nº/N.º/Nro./Núm./número, "No." con guion, y el tipo de documento (Decreto Supremo, Resolución…, Ley, Expediente, Oficio, D.S., R.M., Exp.…; las abreviaturas se dicen completas). Sin prefijo exige guion o barra. Prueba: `scripts/check-document-codes-lab32.js`.
- Siglas sueltas (`services/acronymsSpeechLab32.js`, aplicado en el mismo envoltorio): diccionario incorporado de prensa peruana (TV → "tevé", ONP → "o ene pe", ONPE → "Onpe", MINSA → "Minsa"…) más las del operador, que ganan. Las desconocidas sin vocales se deletrean (salvo números romanos); las demás siguen el camino de siempre. Panel: tarjeta "Siglas" bajo "Aprendizaje guardado" (`renderer-acronyms-lab32.js`, IPC `acronyms:get|set|test`), guardadas en `pronunciation-acronyms.json` en la carpeta de datos (`dataRoot()` de Lab.29).

## Promo de YouTube en Merlín

- `output-merlin.html` y `output-merlin-web.html` cargan los mismos archivos de la promo que la clásica (`output-youtube-promo*.js|css`, `output-stabilization-lab28.css`); el recuadro se monta sobre `#stage` y usa `#cannedVideo`. Antes solo se inyectaba en `output.html` y en Merlín nunca aparecía. `outputLanServer.js` sirve esos archivos. Prueba: `scripts/check-merlin-youtube-promo.js`.

## Pendiente

- Integrar en modo Merlín el envío por NDI (hoy NDI queda bloqueado con aviso en modo Merlín).
