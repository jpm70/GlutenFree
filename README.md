# GlutenZero

App para celíacos: escanea productos y descubre al instante si son aptos.

## Archivos del proyecto

| Archivo | Para qué |
|---|---|
| `GlutenZero.html` | **Demo de diseño** — prototipo dentro de un iPhone con panel de Tweaks para enseñar/probar los 3 estados |
| `app.html` | **Build mobile** — versión a pantalla completa, responsive, instalable como PWA. **Esta es la que subes a GitHub Pages** |
| `app-mobile.jsx` | Lógica de la app mobile (sin frame, sin tweaks) |
| `app.jsx` | Lógica de la demo de diseño |
| `ios-frame.jsx` / `tweaks-panel.jsx` | Componentes auxiliares |
| `manifest.json` | Metadatos PWA (nombre, iconos, colores) |
| `sw.js` | Service worker para funcionamiento offline |
| `icon-192.png` / `icon-512.png` | Iconos de la app |

## Subir a GitHub Pages

1. Crea un repositorio en GitHub (puede ser **público** ahora — luego lo pasas a privado)
2. Sube todos estos archivos al repo:
   - `app.html`
   - `app-mobile.jsx`
   - `app.jsx` (opcional, solo si quieres mantener la demo)
   - `ios-frame.jsx`
   - `tweaks-panel.jsx`
   - `manifest.json`
   - `sw.js`
   - `icon-192.png`
   - `icon-512.png`
3. En GitHub: **Settings → Pages → Source: `main` branch / root** → Save
4. Espera 1-2 min. Tu app estará en `https://<tu-usuario>.github.io/<tu-repo>/app.html`

> **Importante**: el archivo `index.html` no existe — apunta a `/app.html` o renombra `app.html` a `index.html` antes de subir si quieres que la URL sea más limpia.

## Convertir a APK con PWABuilder

1. Ve a [pwabuilder.com](https://www.pwabuilder.com)
2. Pega la URL de tu GitHub Pages: `https://<tu-usuario>.github.io/<tu-repo>/app.html`
3. PWABuilder analizará la PWA y dirá qué falta (debería estar todo verde gracias al manifest + service worker + iconos que ya están preparados)
4. Click en **Package for stores → Android**
5. Descarga el `.apk` o `.aab`
6. Para instalar el APK directamente en un Android: actívale "Orígenes desconocidos" y abre el archivo

## Probar en local antes de subir

Necesitas un servidor local (no funciona abriendo `app.html` con doble click por temas de service worker):

```bash
# Opción 1: Python
python3 -m http.server 8000

# Opción 2: Node
npx serve .
```

Luego abre `http://localhost:8000/app.html` en Chrome móvil o desktop con DevTools en modo móvil.

## Limitaciones conocidas de esta versión

- **Escáner**: actualmente es una simulación visual. Para escaneo real necesitarás integrar [QuaggaJS](https://serratus.github.io/quaggaJS/) o [ZXing-js](https://github.com/zxing-js/library) y la API `getUserMedia` para acceder a la cámara.
- **OCR**: lo mismo — habría que integrar [Tesseract.js](https://tesseract.projectnaptha.com/) para leer etiquetas reales.
- **Datos de productos**: están hardcodeados como demo. La integración real con Open Food Facts es el siguiente paso.

## Siguientes pasos sugeridos

1. Probar la APK con 5-10 testers reales
2. Recoger feedback sobre el flujo y la sensación
3. Decidir si invertir en la versión nativa real (React Native + Expo) o seguir con la PWA
4. Integrar Open Food Facts + QuaggaJS para tener escáner funcional dentro de la PWA
