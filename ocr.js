// GlutenZero — OCR helper around Tesseract.js
// Loads Tesseract from CDN lazily on first use to avoid pulling ~2MB up front.

(function () {
  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  let loadingPromise = null;
  let worker = null;
  let workerReady = null;
  let progressCb = null; // el logger del worker se fija una vez; lo redirigimos aquí

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT_CDN;
      s.async = true;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => { loadingPromise = null; reject(new Error('No se pudo cargar el motor OCR')); };
      document.head.appendChild(s);
    });
    return loadingPromise;
  }

  async function ensureWorker() {
    if (worker && workerReady) return workerReady;
    const Tesseract = await loadTesseract();
    workerReady = (async () => {
      worker = await Tesseract.createWorker(['spa', 'eng'], 1, {
        logger: (m) => { if (typeof progressCb === 'function') progressCb(m); },
      });
      return worker;
    })();
    workerReady.catch(() => { worker = null; workerReady = null; });
    return workerReady;
  }

  // ¿El texto ya trae algo útil para decidir? («gluten», «ingredientes», «celíaco»)
  // Tolerante a OCR: «GIuten», «g1uten», «lngredientes»…
  function hasLabelSignal(text) {
    const t = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return /g ?[l1i|!] ?[uv] ?t ?[e3c] ?n|glutin|[il1|]ngred|celiac/.test(t);
  }

  // Read text from a source (File | Blob | Canvas | HTMLImageElement | data URL)
  //
  // Pasada 1: imagen en COLOR, modo automático (bloques de texto: listas de
  //   ingredientes). Tesseract binariza cada canal por separado y elige el
  //   mejor; pasarle la imagen ya en grises le quitaba esa ventaja y el texto
  //   sobre fondos de tono medio desaparecía.
  // Pasada 2, solo si la 1 no encontró «gluten» ni «ingredientes»: imagen
  //   binarizada por contraste LOCAL y modo «texto disperso» (PSM 11). Es lo que
  //   rescata un «GLUTEN FREE» dentro de un sello o sobre un fondo con zonas de
  //   distinto color, típico del frontal del envase.
  //
  // `isGoodEnough(text)` decide si hace falta la segunda pasada. Por defecto basta
  // con que aparezca «gluten» o «ingredientes»; la app le pasa el veredicto real.
  async function recognize(source, onProgress, { isGoodEnough = hasLabelSignal } = {}) {
    const w = await ensureWorker();
    progressCb = (m) => { if (typeof onProgress === 'function') onProgress({ ...m, pass: 1 }); };
    try {
      const { data } = await w.recognize(source);
      let text = (data && data.text) ? data.text : '';
      let confidence = data ? data.confidence : 0;

      let good = true;
      try { good = isGoodEnough(text); } catch { good = hasLabelSignal(text); }
      if (!good) {
        progressCb = (m) => { if (typeof onProgress === 'function') onProgress({ ...m, pass: 2 }); };
        if (typeof onProgress === 'function') onProgress({ status: 'recognizing text', progress: 0, pass: 2 });
        try {
          await w.setParameters({ tessedit_pageseg_mode: '11' });
          const second = (source instanceof HTMLCanvasElement) ? adaptiveBinarize(source) : source;
          const res2 = await w.recognize(second, { rotateAuto: true });
          const text2 = (res2 && res2.data && res2.data.text) || '';
          if (text2.trim()) {
            text = `${text}\n${text2}`;
            confidence = Math.max(confidence, res2.data.confidence || 0);
          }
        } catch {
          // La segunda pasada es un extra: si falla, nos quedamos con la primera
        } finally {
          try { await w.setParameters({ tessedit_pageseg_mode: '3' }); } catch {}
        }
      }
      return { text, confidence };
    } finally {
      progressCb = null;
    }
  }

  // Ancho de trabajo: reducimos fotos enormes (velocidad) pero AMPLIAMOS las
  // pequeñas — Tesseract necesita letras de ~20-30 px de alto para leer bien.
  function targetWidth(naturalWidth, maxWidth) {
    const MIN_WIDTH = 1200;
    if (naturalWidth > maxWidth) return maxWidth;
    if (naturalWidth < MIN_WIDTH) return Math.min(MIN_WIDTH, naturalWidth * 2);
    return naturalWidth;
  }

  // Capture a frame from a <video> element into a canvas at OCR-friendly size.
  // Se deja en COLOR a propósito (ver recognize).
  function captureFrame(video, maxWidth = 1600) {
    if (!video || !video.videoWidth) throw new Error('Video no listo');
    const ratio = video.videoHeight / video.videoWidth;
    const w = targetWidth(video.videoWidth, maxWidth);
    const h = Math.round(w * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, w, h);
    return canvas;
  }

  // Convert a File/Blob (image) into a canvas the same way
  async function enhanceFile(file, maxWidth = 1600) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const ratio = img.naturalHeight / img.naturalWidth;
      const w = targetWidth(img.naturalWidth, maxWidth);
      const h = Math.round(w * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Binarización por contraste local: un píxel es «tinta» si se aparta más de
  // `threshold` niveles de la media de su vecindario. Funciona con texto oscuro
  // sobre claro y claro sobre oscuro a la vez, y no le afectan las sombras ni
  // que el fondo cambie de color (sellos, franjas). La ventana es ancha (1/8
  // del ancho) para no vaciar el interior de las letras grandes de un logotipo.
  function adaptiveBinarize(src, windowFrac = 1 / 8, threshold = 25) {
    const w = src.width, h = src.height;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    const grey = new Float32Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      grey[j] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    }
    // Imagen integral para medias de ventana en O(1)
    const W1 = w + 1;
    const integral = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += grey[y * w + x];
        integral[(y + 1) * W1 + x + 1] = integral[y * W1 + x + 1] + row;
      }
    }
    const r = Math.max(8, Math.round((w * windowFrac) / 2));
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const sum = integral[y1 * W1 + x1] - integral[y0 * W1 + x1] - integral[y1 * W1 + x0] + integral[y0 * W1 + x0];
        const mean = sum / ((y1 - y0) * (x1 - x0));
        const v = Math.abs(grey[y * w + x] - mean) > threshold ? 0 : 255;
        const k = (y * w + x) * 4;
        d[k] = d[k + 1] = d[k + 2] = v;
        d[k + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  async function terminate() {
    if (worker) {
      try { await worker.terminate(); } catch {}
      worker = null;
      workerReady = null;
    }
  }

  window.GZOCR = { recognize, captureFrame, enhanceFile, terminate, loadTesseract };
})();
