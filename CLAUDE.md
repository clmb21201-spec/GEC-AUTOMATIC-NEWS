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

## Pendiente

- Fase 2 de Merlín: segmentos de presentación y despedida (nuevo tipo `host` con `segment: 'intro' | 'outro'`, textos de la IA local, voz del TTS local, insertados por el planificador al inicio y antes de cada bloque de enlatados o anuncios).
