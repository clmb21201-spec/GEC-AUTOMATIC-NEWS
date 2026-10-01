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

## Vista previa en Diseño

Con el modo Merlín y formato 16:9, la **Vista previa de emisión** de la pestaña Emisión muestra la salida real de Merlín (plano general y luego plano medio con el cintillo) con el diseño guardado y la nota de ejemplo. Es muda y solo se carga mientras está en pantalla, para no ocupar la GPU. Si el 3D no carga, queda la vista previa clásica con un aviso.

## NDI

NDI solo está disponible en la vista clásica: la ventana NDI usa la salida clásica. Con el modo Merlín, NDI se detiene, la tarjeta queda deshabilitada y muestra el aviso; al volver a la clásica se reanuda si estaba activado. En 9:16 la salida siempre es la clásica y NDI funciona normalmente.

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

## Video de espera

Igual que la salida clásica: al abrir la salida y al detener la emisión se ve el video de espera configurado (con su música si está activada). Al llegar la primera pieza, se desvanece y aparece Merlín.

## Intervenciones de Merlín

Solo en modo Merlín y en la emisión automática (en la salida clásica se omiten):

| Momento | Segmento | Plano |
|---|---|---|
| Primera pieza de la emisión | `intro` (presentación) | General |
| Antes de un enlatado o anuncio que sigue a una noticia | `pase` | Primer plano |
| Primera noticia después de un enlatado o anuncio | `regreso` | General |
| Al pulsar Detener emisión | `despedida` | Primer plano, luego video de espera |

**Detener emisión en modo Merlín:** si hay una noticia al aire, Merlín la termina de contar, se despide y pasa al video de espera (el panel avisa "Deteniendo…"; tope de espera de 5 minutos). Si hay un enlatado o anuncio, se corta y se despide de inmediato. Si se reanuda la emisión antes de que termine la noticia, la despedida se cancela.

- Las frases son fijas y rotan al azar sin repetir la última: `src/assets/merlin/presenter-phrases.json` (se pueden editar).
- Su audio se genera una sola vez con la voz configurada en EC1 y queda en caché en `data/presenter-voice/`. Si cambias la voz o el texto, se regenera solo. La generación empieza al activar el modo Merlín y unos segundos después de abrir la app.
- Si el audio de una frase aún no está listo, esa intervención se salta para no frenar la emisión.
- Implementación: `presenterHost` al final de `src/main.js` envuelve `deliverToOutput` y `controlOutput`; la salida responde con `ECAPI.presenterHostPlayback` (no con `outputPlayback`, para no interferir con el motor de automatización).

## Diseño en pantalla (versión con subtítulos)

- **Cintillo unificado** en plano medio y pantalla completa: pestaña con sección y exclusivo (colores, opacidad, borde, radio, tipografía, tamaño, peso, texto y visibilidad de **Diseño** de EC1) y titular centrado de dos renglones. En pantalla completa ya no se muestra la bajada.
- **Subtítulos**: caja propia, centrada, encima del cintillo; texto exacto del guion (`p.script`, o `hostText` en las intervenciones) con tiempos estimados por largo de frase y resaltado de las palabras ya dichas. Se activan con `subtitulos.activos` en `presenter-config.js`.
- **Recuadro de la imagen**: respeta la posición configurada y sube lo justo si hay subtítulos, sin tocar el reloj.
- **Plano medio**: la cámara centra a Merlín en el espacio libre a la izquierda del recuadro (`camaras.planoMedioCentradoAuto`).
- **Reloj** arriba a la derecha (hora de la PC, formato `8:45 PM`); se oculta en enlatados, anuncios y espera (`reloj.activo`, `reloj.posicion`).
- **Imágenes**: mismo movimiento que la salida clásica, según **Diseño → Animación** y **Velocidad**.

## Cámara

- Solo cortes de plano a plano: sin acercamiento lento ni deslizamientos.
- Si hay que cambiar de plano y la pantalla está cubierta (pantalla completa, enlatado, espera), el corte se hace cuando la cobertura ya es opaca y recién después se destapa.
- Entre noticias consecutivas en el mismo plano (incluida la **Pausa entre noticias** de EC1) la cámara no se mueve y el cintillo cambia el texto con un fundido corto.

## Expresión según el tono

La IA editorial devuelve `tone` en su JSON (`src/services/editorial.js`; cualquier otro valor o su ausencia queda en `neutral`), se guarda en `item.result.tone` y viaja a la salida como `p.tone` en todos los payloads de noticia. La salida clásica lo ignora.

`p.tone` (`serio` | `neutral` | `ligero`) ajusta balanceo de cabeza, gestos de alas, parpadeo, párpados y miradas. Si el modelo trae los huesos `CEJA_L` y `CEJA_R`, también mueve las cejas (`expresion.cejas.eje` y `amplitud`); si no, se ignoran.

## Volumen normalizado

`presenterHost` mide el nivel de cada voz (WAV del TTS: noticias, intervenciones y titulares) y envía `p.audioGainDb` para llevarlo a `volumen.objetivoDb` (por defecto −20 dBFS RMS, ajuste entre −12 y +6 dB). La salida lo aplica al volumen del elemento (tope 100 %). Enlatados y anuncios: el panel de control (`src/renderer-media-loudness.js`) mide en segundo plano cada video de las carpetas de enlatados y anuncios con Web Audio (RMS en bloques de 50 ms, ignorando los de menos de −40 dBFS; objetivo −20 dBFS, ajuste entre −12 y +6 dB). La medición se guarda en `data/media-loudness.json` por ruta, tamaño y fecha (si el archivo cambia, se vuelve a medir) y `main.js` la agrega como `p.audioGainDb` al payload `kind:'canned'`. Si un video no se puede decodificar o supera 300 MB, no se envía el campo (0 dB).

## Titulares periódicos

Cada `titulares.cadaMinutos` (25 por defecto), antes de una noticia, Merlín dice una entrada fija (`titulares_intro` en `presenter-phrases.json`) y los titulares reales de las próximas `titulares.cantidad` noticias listas de la cola; cada titular aparece a pantalla completa con su imagen y el cintillo, sincronizado con `headlineMarks`. El audio se prepara unos 90 s antes; si no está listo, se salta y se intenta en la siguiente noticia. `presenterHost.titularesNow()` los fuerza en la próxima noticia.
