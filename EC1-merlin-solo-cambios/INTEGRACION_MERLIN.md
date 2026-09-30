# Salida "Merlín" (presentador 3D) en GEC Automatic News

Merlín es un modo de salida alternativo. Usa exactamente los mismos datos que la salida clásica: el audio del TTS local mueve el pico, la imagen extraída de la nota se usa como apoyo, y el titular y la bajada son los que genera la IA local de texto. El motor de automatización no cambia.

## Cómo activarlo

1. Abre EC Automatic News.
2. En el panel de control, junto a la **Vista previa de emisión**, aparece la tarjeta **Modo de salida**.
3. Elige **Merlín en el set (presentador 3D)**. Si la ventana de salida está abierta, se recarga sola con Merlín.

El modo se guarda en `data/presenter.json`. En formato vertical 9:16 se usa siempre la salida clásica.

## Cómo se comporta

| Situación | Qué se ve |
|---|---|
| Primera noticia, o noticia justo después de un enlatado o anuncio | Plano general unos 4 s y luego plano medio |
| Noticia | Plano medio con Merlín a la izquierda, la imagen de la nota en un recuadro a la derecha y el titular en el cintillo. Alterna con la imagen a pantalla completa (titular, bajada, categoría, fecha y exclusivo con el diseño de EC1) |
| Noticia sin imagen | Plano medio sin recuadro |
| Enlatado o anuncio | Video a pantalla completa, igual que la salida clásica |

La imagen de la nota también aparece en el cuadro de la pared y en la tablet del set.

Colores, tipografías (incluidas las importadas), tamaños y pesos del titular, bajada, categoría, fecha y exclusivo se toman del diseño configurado en EC1. El volumen de voz, de enlatados y la música también.

## Tus ajustes del prototipo

`src/assets/merlin/presenter-config.js` trae los valores por defecto. Para usar los tuyos:

1. Abre la página **Merlín en el set** y copia todo el texto de **Valores para Claude Code**.
2. Abre `src/assets/merlin/presenter-config.js` y reemplaza el objeto después de `window.MERLIN_CONFIG =` (desde la primera `{` hasta la última `}`), dejando el `;` final.

Opcional: `camaras.generalAlVolverSeg` (segundos de plano general al volver de una pausa, por defecto 4).

## Salida por red local (OBS)

Con la salida LAN activada, Merlín está en `http://IP-DEL-PC:PUERTO/merlin?k=CLAVE` (misma IP, puerto y clave que la salida web actual). En OBS: fuente de navegador de 1920×1080 con "Controlar audio mediante OBS".

## Archivos

Nuevos:
- `src/output-merlin.html`, `src/output-merlin.js`, `src/output-merlin.css` — la salida.
- `src/output-merlin-web.html` — la misma salida para la red local.
- `src/renderer-merlin.js` — tarjeta "Modo de salida" en el panel de control.
- `src/assets/merlin/` — capas del set, modelo (`merlin-model.js`, con las texturas y los pesos corregidos) y `presenter-config.js`.
- `src/vendor/three/` — three.js r147 para funcionar sin internet.
- `scripts/check-merlin-output.js` — verificación incluida en `npm run check`.

Modificados:
- `src/main.js` — `createOutputWindow` carga `output-merlin.html` o `output.html` según el modo; IPC `presenter:get` / `presenter:set`.
- `src/preload.js` — expone la API de salida a `output-merlin.html`, agrega `presenterGet` / `presenterSet` al panel e inyecta `renderer-merlin.js`.
- `src/services/outputLanServer.js` — sirve los archivos de Merlín y la ruta `/merlin`.
- `package.json` — agrega los checks de Merlín.

## Respaldos automáticos

- Si WebGL o el modelo fallan al cargar, la ventana vuelve sola a `output.html`.
- Si el análisis del audio queda bloqueado (silencio absoluto con el audio sonando), el pico usa un movimiento sintético para no quedarse quieto. Se registra en la consola como `[merlin] análisis de audio bloqueado`.

## Pendiente (fase 2)

Presentación y despedida: EC1 solo tiene `news`, `canned` y `ad`. Hace falta un tipo nuevo (`host` con `segment: 'intro' | 'outro'`), textos de la IA local, voz del TTS local y que el planificador los inserte al inicio y antes de cada bloque de enlatados o anuncios. La salida mostraría `intro` en plano general y `outro` en primer plano.
