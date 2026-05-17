// gluten-engine.jsx
// Pure-data module: term lists + verdict logic + Open Food Facts client.
// No React. Exposes globals: GlutenEngine, OFF.

// ─── Term lists (Spanish + English + scientific) ───────────────
const DANGER_TERMS = [
  // Trigo y derivados
  'trigo', 'wheat', 'triticum', 'harina de trigo', 'sémola', 'semola',
  'cuscús', 'cuscus', 'couscous', 'bulgur', 'seitán', 'seitan',
  'farro', 'espelta', 'spelt', 'kamut', 'khorasan',
  'triticale', 'durum',
  // Cebada
  'cebada', 'barley', 'malta', 'malt', 'extracto de malta',
  'malt extract', 'jarabe de malta', 'malt syrup',
  // Centeno
  'centeno', 'rye',
  // Otros
  'panko', 'cuscús', 'tabulé', 'taboule',
];

const DOUBT_TERMS = [
  // Avena (puede estar contaminada salvo certificación)
  'avena', 'oats', 'oat',
  // Almidones genéricos
  'almidón modificado', 'starch (modified)', 'modified starch',
  'almidón',
  // Aromatizantes y aditivos sin especificar
  'aroma natural', 'natural flavour', 'natural flavor',
  'aromas',
  // Productos cárnicos procesados (pueden llevar harina)
  'fiambre', 'embutido',
  // Salsas asiáticas (suelen llevar trigo)
  'salsa de soja', 'soy sauce',
];

const SAFE_CERT_TAGS = [
  'en:no-gluten', 'en:gluten-free', 'es:sin-gluten',
];

const ALLERGEN_GLUTEN = [
  'en:gluten', 'gluten',
];

// ─── Highlight helper: find which danger terms appear in a string ───
function findMatches(text, terms) {
  if (!text) return [];
  const lc = text.toLowerCase();
  const hits = new Set();
  for (const t of terms) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lc)) hits.add(t);
  }
  return [...hits];
}

// ─── Verdict from an OFF product object ───────────────────────
function analyze(product) {
  if (!product) return null;

  const name = product.product_name_es || product.product_name || product.generic_name || 'Producto sin nombre';
  const brand = (product.brands || '').split(',')[0].trim() || '—';
  const ingredientsText = product.ingredients_text_es || product.ingredients_text || '';
  const labelsTags = product.labels_tags || [];
  const allergensTags = product.allergens_tags || [];
  const tracesTags = product.traces_tags || [];

  // Strong signals: official labels
  const hasGlutenFreeLabel = labelsTags.some(t => SAFE_CERT_TAGS.includes(t));
  const hasGlutenAllergen = allergensTags.some(t => ALLERGEN_GLUTEN.includes(t));
  const hasGlutenTraces = tracesTags.some(t => ALLERGEN_GLUTEN.includes(t));

  // Term scan over ingredients
  const dangerHits = findMatches(ingredientsText, DANGER_TERMS);
  const doubtHits = findMatches(ingredientsText, DOUBT_TERMS);

  let state = 'dudoso';
  let title = 'Información incompleta';
  let subtitle = 'Comprueba la etiqueta';
  let crossLevel = 'high';
  let crossText = 'No hay datos suficientes. Confirma con la etiqueta del producto.';

  if (hasGlutenAllergen || dangerHits.length > 0) {
    state = 'noApto';
    title = 'Contiene gluten';
    subtitle = dangerHits.length
      ? `Detectado: ${dangerHits.slice(0, 2).join(', ')}`
      : 'Etiquetado como alérgeno';
    crossLevel = 'critical';
    crossText = 'Producto elaborado con cereales con gluten.';
  } else if (hasGlutenFreeLabel) {
    state = 'apto';
    title = 'Sin gluten';
    subtitle = 'Apto para celíacos';
    crossLevel = 'low';
    crossText = 'Producto etiquetado oficialmente como sin gluten.';
  } else if (hasGlutenTraces) {
    state = 'dudoso';
    title = 'Puede contener trazas';
    subtitle = 'Riesgo de contaminación cruzada';
    crossLevel = 'high';
    crossText = 'El fabricante advierte que puede contener trazas de gluten.';
  } else if (doubtHits.length > 0) {
    state = 'dudoso';
    title = 'Mejor verifícalo';
    subtitle = `Ingredientes ambiguos: ${doubtHits.slice(0, 2).join(', ')}`;
    crossLevel = 'high';
    crossText = 'Algunos ingredientes pueden contener gluten según el origen. Comprueba la etiqueta.';
  } else if (ingredientsText) {
    // Si tiene lista de ingredientes y nada sospechoso, lo consideramos seguro pero sin certificación
    state = 'apto';
    title = 'Probablemente seguro';
    subtitle = 'Sin ingredientes con gluten detectados';
    crossLevel = 'low';
    crossText = 'No hemos detectado ingredientes con gluten. Sin certificación oficial.';
  }

  // Build ingredient list with risk markers
  const ingredients = ingredientsText
    ? ingredientsText
        .split(/[,;.()]/)
        .map(s => s.trim())
        .filter(s => s.length > 1 && s.length < 60)
        .slice(0, 12)
        .map(name => {
          const lc = name.toLowerCase();
          const risk = DANGER_TERMS.some(t => lc.includes(t.toLowerCase())) ? 'danger'
            : DOUBT_TERMS.some(t => lc.includes(t.toLowerCase())) ? 'doubt'
            : 'safe';
          return { name, risk };
        })
    : [];

  // Pick an emoji based on category
  const cat = (product.categories_tags || []).join(' ').toLowerCase();
  let emoji = '📦';
  let imgBg = '#E8DCC4';
  if (/beverage|drink|bebida|cerveza|beer/.test(cat)) { emoji = '🍺'; imgBg = '#C8A557'; }
  else if (/biscuit|galleta|cookie/.test(cat)) { emoji = '🍪'; imgBg = '#E8DCC4'; }
  else if (/bread|pan/.test(cat)) { emoji = '🍞'; imgBg = '#DAB97A'; }
  else if (/pasta|noodle/.test(cat)) { emoji = '🍝'; imgBg = '#E8C58A'; }
  else if (/dairy|yogur|milk|leche/.test(cat)) { emoji = '🥛'; imgBg = '#EFEFEA'; }
  else if (/sauce|salsa/.test(cat)) { emoji = '🍶'; imgBg = '#D4C49A'; }
  else if (/snack/.test(cat)) { emoji = '🥨'; imgBg = '#E8C896'; }
  else if (/cereal/.test(cat)) { emoji = '🥣'; imgBg = '#E8DCC4'; }
  else if (/meat|carne/.test(cat)) { emoji = '🥩'; imgBg = '#E8B5A8'; }

  return {
    name,
    brand,
    barcode: product.code || '',
    image: emoji,
    imgBg,
    state,
    title,
    subtitle,
    cert: hasGlutenFreeLabel ? 'Etiquetado oficialmente como sin gluten' : null,
    ingredients: ingredients.length ? ingredients : [{ name: 'Lista no disponible', risk: 'safe' }],
    crossContamination: { level: crossLevel, text: crossText },
    reports: { safe: 0, unsafe: 0 },
    raw: product,
  };
}

// ─── Open Food Facts client ───────────────────────────────────
const OFF = {
  async fetchProduct(barcode) {
    const code = String(barcode).replace(/\D/g, '');
    if (!code) throw new Error('Código vacío');
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_es,generic_name,brands,ingredients_text,ingredients_text_es,labels_tags,allergens_tags,traces_tags,categories_tags,code,image_front_small_url`;

    // Timeout de 8s para evitar que se quede colgada en redes flojas
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let res;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
        // Bypass del service worker / cache HTTP
        cache: 'no-store',
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        const err = new Error('timeout');
        err.code = 'timeout';
        throw err;
      }
      const err = new Error('network');
      err.code = 'network';
      throw err;
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = new Error(`http_${res.status}`);
      err.code = 'http';
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (data.status === 0 || !data.product) {
      const err = new Error('not_found');
      err.code = 'not_found';
      throw err;
    }
    return data.product;
  },

  // Búsqueda por nombre — devuelve hasta 12 resultados con info básica
  async searchByName(query, opts = {}) {
    const q = String(query || '').trim();
    if (!q || q.length < 2) {
      const err = new Error('query_short'); err.code = 'query_short'; throw err;
    }
    const pageSize = opts.pageSize || 12;
    const fields = 'code,product_name,product_name_es,generic_name,brands,labels_tags,allergens_tags,traces_tags,image_small_url,image_front_small_url';
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${pageSize}&fields=${fields}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let res;
    try {
      // No custom headers, no cache directives → evitamos preflight CORS
      res = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        mode: 'cors',
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        const err = new Error('timeout'); err.code = 'timeout'; throw err;
      }
      // Diferenciar network real de CORS bloqueado (ambos lanzan TypeError en fetch)
      const err = new Error('network');
      err.code = 'network';
      err.detail = e.message || e.name || 'unknown';
      throw err;
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = new Error(`http_${res.status}`); err.code = 'http'; err.status = res.status; throw err;
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      const err = new Error('parse'); err.code = 'parse'; throw err;
    }
    const products = Array.isArray(data.products) ? data.products : [];

    return products
      .filter(p => p && p.code && (p.product_name || p.product_name_es || p.generic_name))
      .map(p => {
        const labelsTags = p.labels_tags || [];
        const allergensTags = p.allergens_tags || [];
        const tracesTags = p.traces_tags || [];
        const isFree = labelsTags.some(t => SAFE_CERT_TAGS.includes(t));
        const hasGluten = allergensTags.some(t => ALLERGEN_GLUTEN.includes(t));
        const hasTraces = tracesTags.some(t => ALLERGEN_GLUTEN.includes(t));
        let quickState = null;
        if (hasGluten) quickState = 'noApto';
        else if (isFree) quickState = 'apto';
        else if (hasTraces) quickState = 'dudoso';
        return {
          code: p.code,
          name: p.product_name_es || p.product_name || p.generic_name || 'Sin nombre',
          brand: (p.brands || '').split(',')[0].trim(),
          image: p.image_small_url || p.image_front_small_url || null,
          quickState,
        };
      });
  },
};

// ─── OCR quality assessment ───────────────────────────────────
// Devuelve {ok, score, reasons} - decide si el texto OCR es fiable
function assessOcrQuality(rawText) {
  const text = String(rawText || '');
  const reasons = [];
  if (text.length < 30) reasons.push('texto muy corto');

  // Palabras de 2+ letras
  const words = text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/g) || [];
  const longWords = words.filter(w => w.length >= 4);
  if (longWords.length < 4) reasons.push('pocas palabras completas');

  // Proporción de caracteres "raros" (no letras, no espacios, no comas/puntos/dígitos comunes)
  const total = text.length || 1;
  const letters = (text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
  const letterRatio = letters / total;
  if (letterRatio < 0.55) reasons.push('demasiados símbolos extraños');

  // Necesitamos al menos UNA palabra del vocabulario alimentario para creer que es una etiqueta
  const FOOD_WORDS = /\b(ingredient|sin\s+gluten|gluten[-\s]?free|harina|azúcar|azucar|aceite|sal|agua|leche|huevo|trigo|cebada|avena|centeno|arroz|maíz|maiz|levadura|conservante|colorante|aroma|emulgente|estabilizante|antioxidante|cacao|chocolate|fruta|jarabe|almidón|almidon|proteína|proteina|lactosa|alérgeno|alergeno)/i;
  const hasFoodWord = FOOD_WORDS.test(text);
  if (!hasFoodWord) reasons.push('no se reconoce vocabulario de etiqueta');

  // Necesitamos el marcador "ingredientes" o similar para considerarlo fiable
  const hasIngredientHeader = /\bingredient(?:es|s|en|i)\b/i.test(text);

  const score = Math.max(0, 100 - reasons.length * 30);
  return {
    ok: reasons.length === 0 && hasIngredientHeader,
    score,
    reasons,
    hasIngredientHeader,
    hasFoodWord,
  };
}

// ─── Verdict from raw OCR'd ingredient text ───────────────────
// We synthesize a minimal OFF-like product object and reuse the same analyzer,
// so the verdict logic stays in one place. CONSERVADOR: nunca "apto" si la
// calidad del OCR es baja.
function analyzeText(rawText, opts = {}) {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const quality = assessOcrQuality(text);

  // Try to isolate the ingredient list
  let ingredientsText = text;
  const m = text.match(/ingredient(?:es|s|en|i)\s*[:.\-]\s*([\s\S]{4,800})/i);
  if (m) ingredientsText = m[1].trim();

  // Stop at the next obvious section header
  ingredientsText = ingredientsText
    .split(/\b(?:informaci[oó]n\s+nutricional|nutritional\s+(?:information|info)|valores?\s+nutricional|consumir\s+preferentemente|conservaci[oó]n|alm?acenamiento|peso\s+neto|fabricado|fabricante|distribuido|envasado|lote|caducidad)\b/i)[0]
    .trim();

  // Detect danger / doubt terms over the FULL text (no solo la sección de ingredientes)
  // — si encontramos un término peligroso aunque la calidad sea baja, hay que avisar
  const dangerHits = findMatches(text, DANGER_TERMS);
  const doubtHits = findMatches(text, DOUBT_TERMS);
  const hasGlutenFreeMention = /\b(sin\s+gluten|gluten[-\s]?free)\b/i.test(text);

  let state, title, subtitle, crossLevel, crossText;

  if (dangerHits.length > 0) {
    // Detección de peligro: siempre NO APTO, incluso con OCR pobre
    state = 'noApto';
    title = 'Contiene gluten';
    subtitle = `Detectado: ${dangerHits.slice(0, 2).join(', ')}`;
    crossLevel = 'critical';
    crossText = 'Detectamos uno o más ingredientes con gluten en el texto.';
  } else if (!quality.ok) {
    // OCR de baja calidad → SIEMPRE dudoso
    state = 'dudoso';
    title = 'No se pudo leer bien';
    subtitle = quality.hasIngredientHeader
      ? 'La imagen no es lo bastante clara'
      : 'No vemos la lista de “Ingredientes”';
    crossLevel = 'high';
    crossText = 'No podemos garantizar nada con esta foto. Acércate más, mejora la luz y vuelve a intentarlo.';
  } else if (doubtHits.length > 0) {
    state = 'dudoso';
    title = 'Mejor verifícalo';
    subtitle = `Ingredientes ambiguos: ${doubtHits.slice(0, 2).join(', ')}`;
    crossLevel = 'high';
    crossText = 'Algunos ingredientes pueden contener gluten según el origen. Comprueba la etiqueta.';
  } else if (hasGlutenFreeMention) {
    state = 'apto';
    title = 'Sin gluten';
    subtitle = 'La etiqueta indica «sin gluten»';
    crossLevel = 'low';
    crossText = 'El texto leído menciona explícitamente «sin gluten».';
  } else {
    // Calidad OK, sin peligros ni dudas, pero sin certificación explícita →
    // NO decimos "apto"; lo dejamos en dudoso para no comprometernos.
    state = 'dudoso';
    title = 'Sin gluten visible';
    subtitle = 'Sin certificación oficial. Verifica con la etiqueta.';
    crossLevel = 'high';
    crossText = 'No detectamos ingredientes con gluten en el texto, pero al ser una lectura por foto no podemos garantizarlo.';
  }

  // Lista de ingredientes a mostrar: solo si la calidad fue buena, mostramos el split.
  // Si no, mostramos el texto crudo para que el usuario pueda verlo.
  let ingredients;
  if (quality.ok) {
    ingredients = ingredientsText
      .split(/[,;.()]/)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 60)
      .slice(0, 12)
      .map(name => {
        const lc = name.toLowerCase();
        const risk = DANGER_TERMS.some(t => lc.includes(t.toLowerCase())) ? 'danger'
          : DOUBT_TERMS.some(t => lc.includes(t.toLowerCase())) ? 'doubt'
          : 'safe';
        return { name, risk };
      });
    if (!ingredients.length) ingredients = [{ name: 'Lista no disponible', risk: 'safe' }];
  } else {
    ingredients = [];
  }

  return {
    name: opts.name || 'Etiqueta escaneada',
    brand: opts.brand || '—',
    barcode: opts.code || '',
    image: '📦',
    imgBg: '#E8DCC4',
    state,
    title,
    subtitle,
    cert: null,
    ingredients,
    crossContamination: { level: crossLevel, text: crossText },
    reports: { safe: 0, unsafe: 0 },
    source: 'ocr',
    ocrText: text,
    ocrQuality: quality,
  };
}

const GlutenEngine = {
  analyze,
  analyzeText,
  DANGER_TERMS,
  DOUBT_TERMS,
};

// Sample test barcodes — verificados contra Open Food Facts
// El nombre real puede variar ligeramente; el estado (apto/no apto) es el que devuelve OFF.
const SAMPLE_BARCODES = [
  { code: '3017620422003', label: 'Nutella', hint: 'Sin gluten · resultado APTO' },
  { code: '7622210449283', label: 'Galletas Prince (LU)', hint: 'Con trigo · resultado NO APTO' },
  { code: '5000159484695', label: 'Twix', hint: 'Con gluten · resultado NO APTO' },
];

Object.assign(window, { GlutenEngine, OFF, SAMPLE_BARCODES });
