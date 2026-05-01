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
};

const GlutenEngine = {
  analyze,
  DANGER_TERMS,
  DOUBT_TERMS,
};

// Sample test barcodes (real, españoles)
const SAMPLE_BARCODES = [
  { code: '8480000167613', label: 'Galletas Hacendado sin gluten', hint: 'Mercadona' },
  { code: '8410188012108', label: 'Cerveza Mahou Cinco Estrellas', hint: 'Contiene cebada' },
  { code: '8410014488046', label: 'Salsa de soja Kikkoman', hint: 'Contiene trigo' },
];

Object.assign(window, { GlutenEngine, OFF, SAMPLE_BARCODES });
