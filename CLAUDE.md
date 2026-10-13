Responde siempre en español.

# GEC Automatic News (V2.0 TTS Lab)

App de escritorio Electron (Windows, portable) que arma una emisión automática de noticias: lee RSS, extrae la nota y su imagen, una IA local escribe titular, bajada y guion, un TTS local genera la voz, y la ventana de salida lo emite. Hay también enlatados (videos) y anuncios. La interfaz y los mensajes están en español.

## Cómo se trabaja en este repo

- La app se compila **solo en GitHub Actions** (`.github/workflows/build-windows.yml`, en `windows-latest`) con cada push a `main`. El artefacto es un EXE portable.
- Antes de hacer commit: `npm run check` (checks estáticos y de regresión; exige Node 22 y Python 3.12). Si algo falla, explicar la causa antes de cambiar código.
- El script `check` de `package.json` está al límite de 8191 caracteres de `cmd.exe` en Windows (CI falla con "The command line is too long"): los checks nuevos (Lab.33 en adelante) van en `scripts/check-labs.js`, no en `package.json`.
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

Presentación, pase a corte, regreso y despedida con frases fijas (`src/assets/merlin/presenter-phrases.json`), audio generado con el TTS local y cacheado en `data/presenter-voice/`. Lógica en `presenterHost` (final de `src/main.js`); la salida maneja `p.kind === 'host'` y avisa el fin con `ECAPI.presenterHostPlayback`. La salida clásica tiene sus propias intervenciones por perfil desde Lab.38 (ver más abajo); Merlín conserva estas frases. Ver `INTEGRACION_MERLIN.md`.

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

## Lab.33 (horario automático y transmisión a YouTube)

- `services/broadcastScheduleLab33.js` (se instala al final de `bootstrap-v2lab.js`; usa `global.__gecScheduleApi`, definido al final de `main.js`): franjas por perfil en `broadcast-schedule.json` (carpeta de datos) con días (lunes primero), `prep` / `emit` / `until` en 24 h y `youtube`. "Emitir" vacío = la emisión la inicia el operador; "Hasta" vacío = no se detiene sola; si una hora es menor que la anterior es del día siguiente. Cada 20 s: inicia la Preparación; 60 s antes de emitir pide a OBS que transmita; a la hora de emitir abre la salida e inicia la Emisión (si no hay noticias listas espera hasta 10 min); en "Hasta" detiene la Emisión (en Merlín espera la despedida: `outputBusy`), corta OBS y la Preparación (salvo que otra franja empiece en menos de 1 h). Cada acción se hace una vez por franja: lo que el operador pausa o detiene a mano se respeta. Franjas superpuestas no se guardan.
- `services/obsWebSocketLab33.js`: cliente obs-websocket v5 con el WebSocket nativo (Electron 43 / Node 24), sin dependencias. OBS en la misma PC: `ws://127.0.0.1:4455`. Conexión en `obs-websocket.json` (contraseña cifrada con `safeStorage`).
- Panel (`renderer-schedule-lab33.js`): pastilla junto a OUTPUT en la barra superior (próximo horario o estado; no agrega alto a ninguna pestaña), ventana "Horario automático" (AM/PM) y tarjeta "OBS / YouTube" en la pestaña Salida, debajo de Salida NDI®. IPC `schedule:get|set|state`, `obs:get|set|test|start|stop`; evento `schedule:state`. Prueba: `scripts/check-broadcast-schedule-lab33.js`.

## Lab.34 (voz de Qwen que no se detiene)

- Síntoma: al terminar una noticia seguía un zumbido grave y distorsionado (encima de la música) y la salida no pasaba a la siguiente. Qwen3-TTS a veces no marca el fin de la locución y genera ruido hasta `max_new_tokens` (antes 2048 fijos = 2 min 44 s por fragmento); ese ruido quedaba dentro del WAV de la noticia.
- `src/qwen_runaway_lab34.py` (lo copia `prepare-windows-runtime.ps1` junto al worker): `max_new_tokens(text)` = tope acorde al texto (~1,15 × `limit_sec`, sin pasar de 2048); `inspect` marca el fragmento descontrolado (`tope`: llegó al tope; `largo`: más de 2 × lo esperado + 6 s, a 14 caracteres/s; `cola`: más de 2,5 s sin voz al final, con voz = energía y ≥ 35 % en 300–3400 Hz); `cut` corta donde termina la voz (o, si el ruido parece voz, en la última pausa antes de 1,5 × lo esperado + 2 s).
- `tts_lab_worker.py`: `_lab34_cap` en las tres llamadas de Qwen (lote, fine-tuned, zero-shot); `fix_runaway` revisa cada fragmento en los dos caminos (lotes y uno por uno), lo regenera una vez con otra semilla y, si vuelve a fallar, recorta el mejor. Se omite en `batchBenchmarkMode`. El resultado trae `runaway` (lista de casos).
- `services/ttsRunawayGuardLab34.js` (se instala al final de `bootstrap-v2lab.js`): registra cada caso en `logs/tts-runaway.log` (carpeta de datos) y, como último control, si el audio completo dura más de 2 × lo esperado + 10 s (mínimo 20 s) lo borra y lanza `TTS_RUNAWAY` (error de voz: la noticia no sale al aire con ruido); en mediciones (`benchmarkSeed`) solo registra.
- Pruebas: `scripts/check-qwen-runaway-lab34.py` (la detección solo si hay numpy) y `scripts/check-tts-runaway-lab34.js`, en `scripts/check-labs.js` (que ahora también corre pasos de Python).

## Lab.35 (control desde el celular con ntfy)

- `services/remoteNtfyLab35.js` (se instala al final de `bootstrap-v2lab.js`; usa `global.__gecScheduleApi` y, para OBS, `global.__gecScheduleLab33.obsOps`): GEC solo hace conexiones de salida al servidor ntfy (por defecto https://ntfy.sh), así que funciona fuera de la oficina sin abrir puertos. Publica en el tema de avisos (aleatorio, `gec-…`; el operador se suscribe en la app ntfy) mensajes con hasta 3 botones `http` que hacen POST al tema oculto `<tema>-cmd` con `{"gec":<clave>,"c":<orden>}`; escucha los dos temas por stream JSON (`/<tema>,<tema>-cmd/json?since=…`, reconexión con espera creciente) e ignora sus propios avisos (etiqueta `gec`), los de más de 2 min y los botones con otra clave.
- Órdenes: pausar / reanudar (`pauseEmission` / `resumeEmission`), siguiente (`skipCurrent`), ver pantalla (captura de la salida con `__gecScheduleApi.monitorFrame`, que no abre la salida si está cerrada; se sube como adjunto con PUT y los parámetros en la URL), detener la preparación (`stopProcessing`) e iniciar / cortar la transmisión de OBS (`obsOps.start` / `obsOps.stop`); estas tres piden confirmación con un segundo botón. Menús: principal [Pausar|Reanudar] [Siguiente] [Más opciones] → [Ver pantalla] [Transmisión] [Detener preparación] → [Iniciar transmisión] [Cortar transmisión] [Estado].
- Avisos automáticos (cada 4 s, `watch`): salida trabada (la pieza al aire lleva más de 1,1 × su duración + 75 s, sin contar pausas; un segundo aviso 5 min después), transmisión cortada sin que GEC la cortara (se consulta OBS cada ~30 s si `obs-websocket.json` existe; los inicios y cortes pedidos desde GEC marcan `lastObsAction`) y cada mensaje nuevo de error del horario (`engine.message`). Órdenes escritas en el tema de avisos solo con el PIN («pausar 1234»); sin PIN responde «Falta el PIN». Al iniciar o terminar la emisión manda el panel de botones (opción `notifyStart`).
- `remote-ntfy.json` (carpeta de datos): servidor, tema, clave de botones, PIN y token (cifrados con `safeStorage`). "Generar tema nuevo" cambia tema y clave (los botones viejos dejan de valer). IPC `remote:get|set|test|newTopic`; evento `remote:state`.
- Panel: tarjeta "Control desde el celular (ntfy)" en la pestaña Salida, debajo de OBS / YouTube (`renderer-remote-ntfy-lab35.js`). Prueba: `scripts/check-remote-ntfy-lab35.js` (servidor ntfy simulado en local).

## Lab.36 (audios de voz para edición)

- `services/voiceArchiveLab36.js` (se instala al final de `bootstrap-v2lab.js`): envuelve `removeItem` de la automatización (donde está definido en la cadena de prototipos de la instancia; reintenta si todavía no existe) y, solo para noticias con estado `EMITIDA` (vale para la salida clásica y para Merlín), copia el WAV del TTS antes de que se borre: solo la voz, la música se mezcla en la salida. Carpeta `<carpeta>/AAAA-MM-DD/HH-MM-SS · Titular.{wav,txt,srt}` (por defecto `Documentos/GEC Audios de voz`); el .txt (UTF-8 con BOM) trae titular, bajada, categoría, fuente, enlace, fechas, duración, el guion de la IA y la locución exacta (`ttsScript`); el .srt usa los tramos con voz del WAV (PCM 16 bits o float 32), bloques de hasta 2 líneas de ~42 caracteres cortados en fin de oración / comas, con los cortes anclados a la pausa más cercana. Limpieza opcional por días (solo carpetas `AAAA-MM-DD` y archivos .wav/.txt/.srt). Configuración en `voice-archive.json`; IPC `voiceArchive:get|set|pick|open`; evento `voiceArchive:state`. Panel: tarjeta en la pestaña Audio y locución, debajo de «Voz y locución» (`renderer-voice-archive-lab36.js`; se ancla a la tarjeta que contiene `#voice`, que con Lab.29 es `.ec27-card` y no `.card`: antes de corregirlo la tarjeta no aparecía). Prueba: `scripts/check-voice-archive-lab36.js`.
- Merlín solo con su página: `presenterHost.active()` además exige que la ventana de salida muestre `output-merlin.html` (`merlinPage()`). Si WebGL o el modelo fallan, la salida vuelve a `output.html` con el modo aún en `merlin`; antes las intervenciones de Merlín llegaban a la clásica como una noticia vacía (se oía la voz de Merlín) y su `ended` se tomaba como el fin de la noticia real.

## Lab.37 (noticias con movimiento en la salida clásica)

- `services/newsMotionLab37.js` (se instala al final de `bootstrap-v2lab.js`): configuración por perfil en `news-motion.json` (carpeta de datos, `profiles[id]`): `enabled`, `level` (`sobrio` 9 s · `normal` 6 s · `dinamico` 4 s de mínimo por plano · `custom`: `custom.planes` {`full`,`side`,`zoom`,`dato`} elegidos por el operador, `custom.minSec` 3–15 y `custom.transition` `wipe`|`fade`), `facts`, `voice`, `clock`, `progress`, `sting`, `colors` (`mode:'auto'` toma del Diseño: barra 1 = sección, barra 2 = exclusivo o titular si son iguales, barra 3 = fondo del cintillo; `custom` usa los suyos) y `ticker` (`queue`, `rss`, `label`, `every`, `messages`). IPC `newsMotion:get|set`.
- Al final de `main.js`: `enrichDesign` agrega `design.newsMotion` y `deliverToOutput` (envoltorio más externo) agrega a cada noticia `p.motion = {sentences, facts, ticker, segments}`. Las oraciones (titular + guion) se anclan a las pausas de la voz del WAV (tramos de `voiceArchiveLab36.speechSegments`, mismo criterio que los subtítulos de Merlín); `cut` es la mitad de la pausa. No toca `p.speechSegments` (Merlín calcula los suyos).
- Datos clave sin IA (para no alargar ni arriesgar el JSON de la IA editorial, que tiene tope de 650 fichas): cifras con S/, US$, %, cantidades con unidad, marcadores (solo con contexto deportivo), persona con cargo, sigla con su nombre entre paréntesis, lugares (distrito, estadio…) y fechas. Hasta 4 por nota, uno por oración, 5,2 s entre uno y otro; el principal es la cifra del titular o la bajada.
- Ticker: titulares `LISTA` de la cola (exclusivas marcadas), titulares de `automation.cachedItems` más nuevos primero, sin la nota al aire ni repetidos, y un mensaje del operador cada N. Vacío → no se muestra. Solo en 16:9.
- Salida: `output-news-motion-lab37.js|css` (preload los inyecta en `output.html`; `output-web.html` y `outputLanServer.js` los sirven para OBS). Se monta sobre `setStoryContent` y `revealStoryFromStory` sin tocar `output.html`/`output.js`; capa `#nmLayer` dentro de `#storyLayer` (oculta `#image`, `#shade`, `#lower` con `#stage.nm-on`) y `#nmSting` en `#stage` (z 26, debajo del loop). La línea de tiempo es `audio.currentTime`. Planos: foto completa → recuadro → detalle (sin imagen, solo foto completa), dato en grande en la oración de la cifra principal (dura desde 3 s), cortes solo en pausas (entre oraciones o de ≥ 0,35 s dentro de una). Exclusivo: etiqueta del Diseño con brillo, sello al empezar, golpe de marca con «EXCLUSIVO». 9:16 respeta las zonas de TikTok si el Diseño las tiene activadas. `ended`/`error` los sigue mandando `output.js`.
- Panel: fila "Noticias con movimiento" dentro de la tarjeta Transiciones de Diseño de emisión (activar y nivel) y ventana "Colores, ticker y sonidos…" (`renderer-news-motion-lab37.js`). Prueba: `scripts/check-news-motion-lab37.js`.

## Lab.38 (intervenciones en la vista clásica, por perfil)

- `services/classicHostLab38.js` (se instala al final de `bootstrap-v2lab.js`): configuración por perfil en `classic-host.json` (carpeta de datos, `profiles[id]`): `enabled`, `program` (vacío = nombre del perfil), `segs` y `versions` (A/B/C) de `intro`, `tit`, `pase`, `reg`, `desp`, `titulares` (cada 15–60 min, 3–5), `phrases` (`intro`, `titulares_intro`, `pase`, `regreso`, `despedida`), `closing` (texto grande, agradecimiento, hasta 3 redes, próxima emisión: del Horario automático, escrita o ninguna), `background` (`standby` = video de espera del perfil, `anim`, `custom` = imagen o video propio) y `music` (`low` | `none`). El logo y el fondo propio se copian a `classic-host/<perfil>/`. Sin lema. IPC `classicHost:get|set|pickLogo|pickBackground|clearAsset|speak`.
- Comodines: `{saludo}`, `{programa}`, `{dia}` y `{hora}` («son las ocho y diez de la noche»; solo en Presentación y Despedida, se genera en el momento con hasta 12 s de espera; si no llega, otra frase o se sigue sin intervención). Las demás frases se generan con anticipación (los tres saludos) y quedan en caché en `presenter-voice/`.
- `presenterHost` (main.js) en puntos acotados: `active()` de Merlín sin cambios; `classicOn()` (perfil activado, sin Merlín y con `output.html` en la salida) y `hostActive()`; frases, cadencia de titulares, intervención apagada por perfil y datos extra para la placa (`hostFlavor:'clasica'`, `upcoming`, `next`, `nextEmission`). Merlín conserva sus frases. Al final de `main.js`: `design.classicHost` (datos para la salida), `__gecPresenterHost` (voz para «Escuchar») y preparación de frases al guardar, al cambiar de perfil y cada 10 min.
- Salida: `output-classic-host-render-lab38.js` (motor de las 15 placas, compartido con la vista previa) + `output-classic-host-lab38.js|css` (preload los inyecta en `output.html`; también `output-web.html` y `outputLanServer.js`, que sirve logo, fondo e imágenes). Envuelve `showStory`/`showCanned`: `p.kind === 'host'` se dibuja en `#chLayer` (z 22) con la voz en `#audio` (`activeKind='host'`) y avisa el fin con `ECAPI.presenterHostPlayback`, nunca con `outputPlayback`. El logo cuadrado u horizontal ajusta su caja a la proporción (1:1 a 3:1). 9:16 con zonas de TikTok si el Diseño las tiene. El CSS se generó del motor de la maqueta: todo bajo `#chLayer` y animaciones con prefijo `ch`.
- Panel: fila "Intervenciones de la vista clásica" en la tarjeta Transiciones (activar, resumen, Editar…) y ventana con pestañas Identidad, Intervenciones, Frases, Cierre y Fondo + vista previa animada (`output-classic-host-preview.html`) (`renderer-classic-host-lab38.js`). Prueba: `scripts/check-classic-host-lab38.js`.

## Lab.39 (sonidos de transición, opciones que cambian con el movimiento y Claude Haiku 5.5)

- Sonidos: `src/gec-sfx-lab39.js` (`window.GECSfx.create()`, Web Audio, sin archivos: woosh, golpe grave, impacto con brillo, clic) + `src/output-sfx-lab39.js` (`window.__gecSfx.play(tipo, opciones)` en la salida clásica, `output-web.html` y la ventana de NDI). Configuración por perfil en `news-motion.json` → `sfx: {enabled, style: suave|normal|marcado, volume 0–100, events: {sting, plane, dato, ex, card, host}}` (datos clave apagado por defecto), que llega como `design.newsMotion.sfx`. Ganchos: `playSting` y `showPlane` / datos clave en `output-news-motion-lab37.js` (el exclusivo suena 0,6 s después, con el sello) y `showHost` en `output-classic-host-lab38.js`. Reglas del motor: el cambio de plano suena solo con barrido y no en los 2 s siguientes al golpe de marca; un mismo tipo no se repite antes de 3 s; tipos distintos sí suenan juntos; en pausa no suena. En la ventana de NDI se suma a la mezcla de `output-ndi-audio.js` (`window.__GEC_NDI_AUDIO__`). Los audios de voz para edición siguen siendo solo voz.
- Panel: sección «Sonidos» (activar, estilo, eventos, «Probar») en la ventana del movimiento y «Volumen efectos de transición» en Audio y locución → Música y mezcla (se guarda al soltar, en `news-motion.json`).
- Con Noticias con movimiento activado (`body.gec-nm-active`): nota en «Animación de imagen» y «Velocidad» (solo Merlín), en la Vista previa de emisión (el cintillo se reemplaza por los planos) y en Transiciones (el fundido queda para contenidos y anuncios); el texto del fundido dice «Se aplica entre noticias y contenidos o anuncios».
- Claude: `claude-haiku-5-5` (antes `claude-haiku-4-5-20251001`). `claudeBody` le apaga el pensamiento (piensa por defecto y cuenta en `max_tokens`) y sube el tope ~30 % (mismo texto, más fichas); no se envían `temperature` ni prefill. Los ajustes guardados con Haiku 4.5 pasan solos a 5.5.
- Prueba: `scripts/check-sfx-lab39.js`.

## Lab.40 (vista previa de Noticias con movimiento en el panel)

- La ventana «Colores, ticker y sonidos…» (`renderer-news-motion-lab37.js`) tiene a la derecha la salida real en un iframe (`output-news-motion-preview.html`: `output.js` + versionados + Lab.37 + Lab.39, sin música). `output-news-motion-preview-adapter.js` define un `ECAPI` propio alimentado por `postMessage` (`gec-nm-preview`: `design`, `stories`, `play`, `control`), crea la voz como un WAV mudo con la duración de cada nota, usa fotos de ejemplo en SVG, pasa sola a la siguiente noticia al recibir `ended` (así se ve el golpe de marca) y devuelve `gec-nm-preview-state` (plano y tiempo).
- Datos: IPC `newsMotion:preview` (`previewStories` en `services/newsMotionLab37.js`): tres noticias de ejemplo (deportes, cifras, exclusiva) con tramos de voz simulados (14 caracteres/s, 0,45 s entre oraciones), el plan real (`buildMotion`) con la configuración que se está editando y el ticker de la cola. El diseño es `getSettings().visual.output` con el formato elegido (16:9 / 9:16) y `newsMotion` de la ventana; el sonido va apagado salvo que se encienda en la barra.
- `draftFromModal()` arma la configuración tanto para Guardar como para la vista previa; cada cambio la actualiza al instante sin guardar. Al cerrar la ventana el iframe se descarga.
- Colores del movimiento en modo «Tomar del Diseño»: los selectores muestran los que salen del Diseño (`deriveColors`, misma regla que `applyColors` de la salida) y no los últimos personalizados guardados; al pasar a «Personalizados» se parte de esos.
- Colores del Diseño que volvían al amarillo: los demás «Guardar» del panel (Audio y locución, Ajustes, probar Claude…) mandan `settings` con la copia de `visual.output.noteDesign` que el panel cargó al abrirse y pisaban lo que había guardado el editor de Diseño. Ahora `settings:save` (main.js) descarta `noteDesign`, `youtubePromoDesign` y `youtubePromoCtaText` salvo que el guardado traiga `__designV2` (lo ponen `renderer-emission-design-v2.js` y el guardado de la promo en `renderer-stabilization-lab28.js`).
- Prueba: `scripts/check-news-motion-preview-lab40.js`.

## Lab.41 (murmullos de Qwen antes de la primera palabra)

- Síntoma: al inicio de algunas notas (y en la prueba de voz) se oían uno o dos «mmm» y hasta 1 s de silencio antes de la primera palabra; en algunas pausas quedaba un retumbo de 20–70 Hz.
- `src/qwen_onset_lab41.py` (lo copia `prepare-windows-runtime.ps1` junto al worker): `clean_head(audio, sr)` busca el comienzo de la voz (≥ 0,15 s con ≥ 70 % de cuadros sobre min(-35 dB, p90 − 18 dB) y ≥ 8 % de la energía entre 800 y 5000 Hz) y quita lo anterior solo si es silencio o murmullo: sonidos previos ≤ 0,5 s, con ≤ 10 % de agudos y separados de la voz por ≥ 0,3 s bajo -45 dB; si no, solo recorta el silencio antes del primer sonido. Deja 60 ms antes de la voz, fundido de 10 ms y nunca más de 3 s. `highpass(audio, sr)`: rampa coseno 40–70 Hz por FFT, sin desfase.
- `tts_lab_worker.py`: `clean_onset` después de `fix_runaway` en los dos caminos (lotes y uno por uno), y el filtro sobre el audio unido antes de escribir el WAV; se omite en `batchBenchmarkMode`. El resultado trae `onset`. `services/ttsRunawayGuardLab34.js` registra los murmullos quitados en `logs/tts-runaway.log`.
- Prueba: `scripts/check-qwen-onset-lab41.py` (la detección, con señales sintéticas, solo si hay numpy).

## Lab.42 (carpeta de datos e IAs entre versiones del EXE)

- Antes: todo vive en `<carpeta del EXE>\GEC V2 TTS Lab\EC Automatic News Data`; abrir un EXE nuevo desde otra carpeta (Descargas) empezaba de cero y había que bajar las IAs otra vez.
- `services/dataLocationLab42.js`: puntero en `%APPDATA%\GEC Automatic News\data-location.json` (`lastBase`, `fixed`, `fixedBase`). `resolveStartup` se llama al inicio de `bootstrap-v2lab.js` (solo `app.isPackaged`, antes de fijar `GEC_V2_TTS_LAB_ROOT`): reinicio (variable ya puesta) → esa; carpeta fija → esa; datos junto al EXE → esos; si no, la última carpeta con datos (`source:'remembered'`, aviso en el panel); si no, junto al EXE. «Tiene datos» = perfiles registrados, `models/` o algún `tts-lab/<motor>/site-packages` con contenido. `GEC_V2_EXE_DIR` guarda la carpeta real del EXE para los reinicios.
- IPC `dataLocation:get|open|pick|set` (`set`: `use` una carpeta que ya tiene datos, `copy` copia los actuales con progreso `dataLocation:progress` sin pisar lo que ya está igual, `local` vuelve a junto al EXE). Antes de cambiar: `profileSwitchSafety0329.stopStrict`, se apagan IA local y voz, y se reinicia con `GEC_V2_TTS_LAB_ROOT` apuntando a la nueva. La carpeta anterior no se borra.
- Panel: tarjeta «Carpeta de datos e IAs» en Ajustes, debajo de la optimización (`renderer-data-location-lab42.js`). Prueba: `scripts/check-data-location-lab42.js`.

## Pendiente

- Integrar en modo Merlín el envío por NDI (hoy NDI queda bloqueado con aviso en modo Merlín).
