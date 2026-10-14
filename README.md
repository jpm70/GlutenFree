# GlutenZero

App para celíacos: escanea un producto y te dice al instante si es apto, dudoso o no apto.

**👉 Pruébala:** https://jpm70.github.io/GlutenFree/ — se puede instalar en el móvil («Añadir a pantalla de inicio») y funciona como una app.

> GlutenZero ofrece información orientativa. Consulta siempre la etiqueta oficial y a tu profesional sanitario.

## Qué hace

| | |
|---|---|
| **Código de barras** | Lee el código con la cámara y consulta [Open Food Facts](https://world.openfoodfacts.org). También se puede teclear el código o buscar por nombre. |
| **Foto de la etiqueta** | Lee el texto de la etiqueta en el propio móvil (Tesseract.js, sin enviar la foto a ningún servidor) y analiza la mención «sin gluten», los ingredientes y las trazas. |
| **Perfil** | Celíaco/a, sensible al gluten o sin gluten por elección, y avisos de trazas y de ingredientes dudosos activables. |
| **Lugares** | Mapa de locales marcados como sin gluten en OpenStreetMap, con preguntas para hacer antes de pedir y enlace a las reseñas de Google Maps. |
| **Sin conexión** | Los productos ya consultados se pueden volver a ver sin cobertura (típico dentro del súper). |

## Cómo decide el veredicto

El análisis se hace siempre con el criterio más estricto (celíaco) y en este orden:

1. **No apto**: ingrediente con gluten (trigo, cebada, centeno, malta, espelta… también en FR/IT/DE/PT) o frases como «contiene gluten» o «no apto para celíacos».
2. **Dudoso, trazas**: «puede contener trazas de…», «elaborado en una fábrica que también utiliza trigo».
3. **Apto**: etiqueta oficial «sin gluten» en Open Food Facts, mención «sin gluten» en el envase o licencia de la Espiga Barrada. En la UE esa mención solo puede usarse con menos de 20 mg/kg de gluten.
4. **Dudoso**: foto ilegible, ingredientes ambiguos (avena, almidón sin especificar, aromas…) o lista sin mención «sin gluten».

Algunos casos especiales:
- No son peligro: «sin trigo», «free from wheat», el almidón de trigo sin gluten (Codex) y el trigo sarraceno.
- Si la etiqueta dice «sin gluten» pero la foto también trae «trigo», sale **«Revisa la etiqueta»** (dudoso). Casi siempre es un error de lectura, pero no damos el producto por bueno.
- El perfil solo puede **relajar** las trazas y los ingredientes dudosos; esos productos salen como «Apto para tu perfil», con el aviso visible. Nunca relaja «contiene gluten», una foto ilegible ni una contradicción.

## Limitaciones conocidas

- **Logotipos**: el «gluten free» pequeño o en curva de algunos logotipos (por ejemplo, bajo el logo de Schär) no lo lee el OCR. Para esos productos es mejor el código de barras.
- **Datos de Open Food Facts**: los aporta la comunidad; un producto puede no estar o estar sin ingredientes. En ese caso la app ofrece fotografiar la etiqueta.
- **Lugares**: solo aparecen los locales etiquetados en OpenStreetMap, y en España son pocos. Desde la ficha de un local hay un enlace para añadir o corregir locales.
- **Cámara**: el escáner y la lectura de etiquetas necesitan HTTPS y permiso de cámara. Sin permiso, se puede subir una foto desde la galería.

## Desarrollo

Es una web estática: React por CDN y el código en archivos `.jsx` que se compilan a un único `dist/app.js` (antes los compilaba Babel en el navegador, unos 3 MB en cada arranque).

```bash
npm install          # una vez: instala esbuild
npm test             # pruebas del motor de veredicto (77 casos)
npm run build        # compila los .jsx → dist/app.js
python -m http.server 8000   # y abre http://localhost:8000/
```

> **Importante:** después de editar cualquier `.jsx` (o `ocr.js`, `osm.js`, `places-store.js`), ejecuta `npm run build` y sube también `dist/app.js`. La CI falla si `dist/app.js` no está al día, y GitHub Pages sirve lo que haya en `dist/`.
>
> Al publicar cambios, sube también el número de `CACHE` en `sw.js` para que los móviles con la app instalada descarguen la versión nueva.

Si al probar en local ves una versión antigua, es el service worker: en DevTools → Application → Service Workers, «Unregister», y recarga.

### Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | La app (la que publica GitHub Pages). Carga React y `dist/app.js`. |
| `app-mobile.jsx` | Pantallas e interfaz de la app. |
| `gluten-engine.jsx` | Motor de veredicto: listas de términos, análisis de etiquetas, ajuste por perfil y cliente de Open Food Facts. Sin React. |
| `ocr.js` | Lectura de etiquetas con Tesseract.js (dos pasadas: color y binarización adaptativa). |
| `osm.js` / `places-store.js` | Mapa y búsqueda de locales en OpenStreetMap; notas y recomendaciones guardadas en el móvil. |
| `ios-frame.jsx` / `tweaks-panel.jsx` | Componentes auxiliares. |
| `build.mjs` | Compilación con esbuild → `dist/app.js`. |
| `tests/gluten-engine.test.js` | Pruebas del motor con textos de etiqueta reales y casos trampa. |
| `sw.js` / `manifest.json` / `icon-*.png` | PWA: funcionamiento sin conexión, instalación e iconos. |
| `GlutenZero.html` / `app.jsx` | Demo de diseño dentro de un marco de iPhone (no forma parte de la app publicada). |
| `.well-known/assetlinks.json` | Verificación del dominio para la versión Android empaquetada como TWA. |

### Versión Android (APK)

La PWA se puede empaquetar con [PWABuilder](https://www.pwabuilder.com): pega la URL de GitHub Pages → *Package for stores → Android*. El archivo `.well-known/assetlinks.json` (paquete `io.github.jpm70.twa`) es el que vincula el APK con el dominio.

> **Ojo:** Android busca ese archivo en la **raíz del dominio** (`https://jpm70.github.io/.well-known/assetlinks.json`), no dentro de `/GlutenFree/`. Mientras no esté ahí, el APK abre la app con la barra de direcciones del navegador visible. Para arreglarlo, hay que publicarlo en el repositorio `jpm70.github.io` (con un `.nojekyll`, para que GitHub Pages no ignore la carpeta `.well-known`).

## Datos y créditos

- Productos: [Open Food Facts](https://world.openfoodfacts.org) (licencia ODbL).
- Mapas y locales: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), consultados vía Overpass API.
- OCR: [Tesseract.js](https://tesseract.projectnaptha.com/). Lector de códigos: [html5-qrcode](https://github.com/mebjas/html5-qrcode). Mapa: [Leaflet](https://leafletjs.com/).
