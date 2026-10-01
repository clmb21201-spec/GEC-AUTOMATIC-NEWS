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

## Video de espera

Igual que la salida clásica (`output-0331.js`): al abrir la salida y después de `stop` se muestra el video de espera configurado en EC1 (`design.standbyVideoUrl`), con la música si está activada (`musicEnabled`, `musicUrl`). Se oculta en cuanto llega una pieza.

## Intervenciones de Merlín

Solo en modo Merlín y con la emisión automática; la salida clásica no las recibe. Merlín habla con frases fijas, sin imagen ni zócalos:

| Momento | Segmento | Plano |
|---|---|---|
| Primera pieza de la emisión | `intro` | General |
| Enlatado o anuncio que sigue a una noticia | `pase` | Primer plano |
| Primera noticia después de un enlatado o anuncio | `regreso` | General; luego la noticia pasa directo a plano medio |
| Al pulsar Detener emisión | `despedida` | Primer plano; luego `stop` y video de espera |

**Detener emisión:** si hay una noticia al aire, no se corta: el motor deja de enviar piezas, la noticia termina, Merlín se despide y recién entonces se envía `stop`. El panel muestra "Deteniendo: Merlín termina la noticia actual y se despide." (tope de 5 minutos). Si hay un enlatado, un anuncio o una intervención en curso, se corta y se despide de inmediato. Si la emisión se reanuda antes de que termine la noticia, la despedida se cancela.

**Frases:** están en `src/assets/merlin/presenter-phrases.json` y se pueden editar. Rotan al azar sin repetir la última.

**Voz:** el audio de cada frase se genera una sola vez con `kokoro.generate` (la misma voz que las noticias) y se guarda en `data/presenter-voice/`, con un nombre que depende de la voz y del texto. Al cambiar un texto o la voz, se genera de nuevo. Se pregenera al activar el modo Merlín y al arrancar la app en ese modo. Si una frase todavía no tiene audio, esa intervención se salta.

**Implementación:** `presenterHost` al final de `src/main.js` envuelve `deliverToOutput` y `controlOutput` y envía piezas `kind: 'host'` con `segment`. La salida avisa el fin de cada intervención con `ECAPI.presenterHostPlayback` (IPC `presenter:hostPlayback`), aparte de `outputPlayback`, así el motor de automatización no cambia. Si no llega el aviso, un temporizador sigue con la emisión.
