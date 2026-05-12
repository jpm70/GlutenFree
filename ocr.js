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

  // Capture a frame from a <video> element into a canvas (downscaled for speed)
  function captureFrame(video, maxWidth = 1280) {
    if (!video || !video.videoWidth) throw new Error('Video no listo');
    const ratio = video.videoHeight / video.videoWidth;
    const w = Math.min(video.videoWidth, maxWidth);
    const h = Math.round(w * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    return canvas;
  }

  async function terminate() {
    if (worker) {
      try { await worker.terminate(); } catch {}
      worker = null;
      workerReady = null;
    }
  }

  window.GZOCR = { recognize, captureFrame, terminate, loadTesseract };
})();
