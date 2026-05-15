// GlutenZero — OCR helper around Tesseract.js
// Loads Tesseract from CDN lazily on first use to avoid pulling ~2MB up front.

(function () {
  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  let loadingPromise = null;
  let worker = null;
  let workerReady = null;

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT_CDN;
      s.async = true;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => reject(new Error('No se pudo cargar el motor OCR'));
      document.head.appendChild(s);
    });
    return loadingPromise;
  }

  async function ensureWorker(onProgress) {
    if (worker && workerReady) return workerReady;
    const Tesseract = await loadTesseract();
    workerReady = (async () => {
      worker = await Tesseract.createWorker(['spa', 'eng'], 1, {
        logger: (m) => {
          if (typeof onProgress === 'function') onProgress(m);
        },
      });
      return worker;
    })();
    return workerReady;
  }

  // Read text from a source (File | Blob | Canvas | HTMLImageElement | data URL)
  async function recognize(source, onProgress) {
    const w = await ensureWorker(onProgress);
    const { data } = await w.recognize(source);
    return {
      text: (data && data.text) ? data.text : '',
      confidence: data ? data.confidence : 0,
    };
  }

  // Capture a frame from a <video> element into a canvas (downscaled for speed,
  // greyscale + contrast bump for better OCR accuracy)
  function captureFrame(video, maxWidth = 1600) {
    if (!video || !video.videoWidth) throw new Error('Video no listo');
    const ratio = video.videoHeight / video.videoWidth;
    const w = Math.min(video.videoWidth, maxWidth);
    const h = Math.round(w * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    enhanceForOcr(ctx, w, h);
    return canvas;
  }

  // Convert a File/Blob (image) into an enhanced canvas the same way
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
      const w = Math.min(img.naturalWidth, maxWidth);
      const h = Math.round(w * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      enhanceForOcr(ctx, w, h);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Greyscale + contrast stretch in-place
  function enhanceForOcr(ctx, w, h) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    // Pass 1: greyscale, collect histogram for contrast stretch
    const gs = new Uint8ClampedArray(w * h);
    let min = 255, max = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      // Luma
      const y = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      gs[j] = y;
      if (y < min) min = y;
      if (y > max) max = y;
    }
    // Pass 2: stretch + write back
    const range = Math.max(1, max - min);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      // Boost contrast: stretch to 0..255
      let v = ((gs[j] - min) * 255 / range) | 0;
      // Gentle gamma to make text crisper without crushing
      v = Math.min(255, Math.max(0, ((v / 255) ** 0.9) * 255 | 0));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
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
