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
  // Etiquetas multilingües (FR / IT / DE / PT): muchos envases vienen en varios idiomas
  'blé', 'orge', 'seigle', 'épeautre', 'farine de blé',
  'frumento', 'orzo', 'segale', 'grano duro', 'farina di grano',
  'weizen', 'gerste', 'roggen', 'dinkel', 'weizenmehl',
  'cevada', 'centeio',
];

const DOUBT_TERMS = [
  // Avena (puede estar contaminada salvo certificación)
  'avena', 'oats', 'oat', 'avoine', 'hafer', 'aveia',
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
  'en:crossed-grain-symbol', 'en:aoecs-crossed-grain-symbol',
  'fr:sans-gluten', 'it:senza-glutine', 'de:glutenfrei',
];

const ALLERGEN_GLUTEN = [
  'en:gluten', 'gluten',
];

// ─── Normalización de texto ───────────────────────────────────
// Minúsculas, sin tildes y espacios colapsados: el OCR se come las tildes a
// menudo («almidon», «semola») y así comparamos siempre en ASCII, donde \b
// funciona (con tildes, \b fallaba: «tabulé,» no casaba).
function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')   // palabras partidas a final de línea: «glu-\nten»
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Confusiones típicas del OCR: l↔I↔1↔|, o↔0, e↔3. Cada término se convierte
// en una regex tolerante para no perder un «tr1go» o un «GIUTEN».
const OCR_CLASS = { l: '[l1i|!]', i: '[i1l|!]', o: '[o0]', e: '[e3]' };
function tolerantPattern(term) {
  return norm(term).split('').map(ch => OCR_CLASS[ch] || escapeRe(ch)).join('');
}

const termRegexCache = new Map();
function termRegex(term) {
  let re = termRegexCache.get(term);
  if (!re) {
    re = new RegExp(`\\b${tolerantPattern(term)}\\b`, 'i');
    termRegexCache.set(term, re);
  }
  return re;
}

// Qué términos de la lista aparecen en un texto YA normalizado
function findMatches(normText, terms) {
  if (!normText) return [];
  const hits = new Set();
  for (const t of terms) if (termRegex(t).test(normText)) hits.add(t);
  return [...hits];
}

// ─── Patrones de etiqueta ─────────────────────────────────────
// «gluten» tolerante a OCR, incluso con letras separadas («G L U T E N»)
const GLU = 'g ?[l1i|!] ?[uv] ?t ?[e3c] ?n';
const GLUTINE = 'g ?[l1i|!] ?[uv] ?t ?[i1l] ?n ?[e3ct]?';  // «glutine», «glutint», «glutin»
const SIN = 's ?[i1l|!] ?n';  // «SlN», «S1N»

// Menciones de «sin gluten» en varios idiomas (sobre texto normalizado)
const GF_CLAIM_RES = [
  new RegExp(`\\b(?:${SIN}|sans|sem|libre de|exento de|exenta de|free from|free of|no contiene|no lleva|0 ?%) ?:? ?${GLU}\\b`, 'i'),
  new RegExp(`\\b${GLU} ?-? ?(?:f ?r ?[e3c] ?[e3c]?|frei|fri|vrij|mentes)\\b`, 'i'),
  new RegExp(`\\bsenza ?${GLUTINE}\\b`, 'i'),
  /\b(?:apto|apta|aptos|aptas) (?:para )?(?:celiacos|celiacas)\b/i,
  /\bsuitable for (?:coeliacs|celiacs)\b/i,
];
// Licencia de la Espiga Barrada (AOECS): país-empresa-producto, p. ej. ES-020-001
const AOECS_LICENSE_RE = /\b([A-Z]{2})\s?-\s?(\d{3})\s?-\s?(\d{3})\b/;

// Frases que dicen explícitamente que SÍ lleva gluten
const GLUTEN_PRESENT_RES = [
  // «Contiene: leche, gluten»: «gluten» en la misma cláusula (las negaciones
  // como «sin gluten» ya se han retirado y cortan la cláusula con «|»)
  new RegExp(`\\b(?:contiene|contienen|contains|contient|enthalt)\\b[^.;|]{0,60}?\\b${GLU}\\b`, 'i'),
  new RegExp(`\\bcon ${GLU}\\b`, 'i'),
  new RegExp(`\\bcereales (?:con|que contienen) ${GLU}\\b`, 'i'),
  new RegExp(`\\bcereals containing ${GLU}\\b`, 'i'),
  new RegExp(`\\b(?:alergenos|allergens|allergy advice)\\b[^.;|]{0,60}?\\b${GLU}\\b`, 'i'),
];
const NOT_SUITABLE_RE = /\b(?:no (?:es )?(?:apto|apta) (?:para )?(?:celiacos|celiacas)|not suitable for (?:coeliacs|celiacs))\b/gi;

// Lista cerrada de alérgenos/menciones que pueden ir detrás de «sin …» o en
// una advertencia de trazas.
const NEG_ITEMS = [
  'cereales con gluten', 'cereales que contienen gluten', 'cereals containing gluten',
  'gluten', 'glutine', 'trigo', 'cebada', 'centeno', 'avena', 'espelta', 'malta',
  'wheat', 'barley', 'rye', 'oats', 'oat', 'spelt', 'malt',
  'lactosa', 'leche', 'huevo', 'huevos', 'soja', 'frutos secos', 'cacahuete', 'cacahuetes',
  'azucar', 'azucares anadidos', 'conservantes', 'colorantes', 'aceite de palma', 'grasas trans',
  'lactose', 'milk', 'dairy', 'egg', 'eggs', 'soy', 'soya', 'nuts', 'peanuts', 'sugar', 'added sugar',
  'preservatives', 'colourings', 'colorings', 'palm oil',
];
const itemAlternation = (items) => `(?:${items
  .map(t => (t === 'gluten' ? GLU : t === 'glutine' ? GLUTINE : tolerantPattern(t)))
  .sort((a, b) => b.length - a.length)
  .join('|')})`;
const NEG_ITEM = itemAlternation(NEG_ITEMS);
// Los 14 alérgenos UE + cereales: lo que puede seguir a una coma en «trazas de…»
const ALLERGEN_ITEM = itemAlternation([
  ...NEG_ITEMS, 'otros cereales', 'cereales', 'sesamo', 'mostaza', 'apio', 'pescado',
  'crustaceos', 'moluscos', 'altramuces', 'altramuz', 'sulfitos', 'frutos de cascara',
  'almendras', 'almendra', 'avellanas', 'avellana', 'nueces', 'anacardos', 'pistachos',
  'sesame', 'mustard', 'celery', 'fish', 'crustaceans', 'molluscs', 'lupin', 'sulphites',
  'tree nuts', 'almonds', 'hazelnuts', 'cereals',
]);

// Advertencias de trazas / contaminación cruzada. El tramo termina en el
// siguiente punto, paréntesis o sección («Ingredientes:», tabla nutricional…), y
// tras una coma solo sigue si lo que viene es otro alérgeno. Así «trazas de
// soja, harina de trigo» NO esconde el trigo: ante la duda, el trigo cuenta
// como ingrediente (más estricto), nunca al revés.
const TSEG = '(?:(?!\\b(?:[il1|]ngred|nutri|valor|alerg|allerg|conserv|consum))[^.;|(),])*';
const TBODY = `${TSEG}(?:, ?(?=${ALLERGEN_ITEM}\\b)${TSEG})*`;
const TRACES_RE = new RegExp([
  `\\b(?:puede|pueden|podria) contener${TBODY}`,
  `\\b(?:contiene )?trazas? de${TBODY}`,
  `\\bmay contain${TBODY}`,
  `\\btraces? of${TBODY}`,
  `\\bpeut contenir${TBODY}`,
  `\\bkann spuren${TBODY}`,
  `\\bpuo contenere${TBODY}`,
  `\\b(?:contiene )?tracce di${TBODY}`,
  `\\bpode conter${TBODY}`,
  `\\b(?:elaborad|fabricad|producid|envasad)[oa]s? en [^.;|()]{0,80}?(?:que|donde) [^.;|()]{0,40}?(?:utiliza|procesa|manipula|elabora|tambien)${TBODY}`,
  `\\b(?:made|produced|manufactured|packed) (?:in|on) [^.;|()]{0,80}?(?:that|which|where) [^.;|()]{0,40}?(?:handles|uses|processes|also)${TBODY}`,
].join('|'), 'gi');

// Almidón de trigo apto (tratado según Codex, <20 mg/kg): legal en la UE en
// productos «sin gluten» (Schär y otros). Solo cuenta si va calificado.
const GF_QUAL = `(?:${SIN} ${GLU}|${GLU} ?-? ?free|senza ${GLUTINE}|sans ${GLU})`;
const CODEX_STARCH_RE = new RegExp(
  `\\b(?:almidon de trigo|wheat starch|amido di frumento|amidon de ble|weizenstarke) ?[(\\[]? ?${GF_QUAL} ?[)\\]]?` +
  `|\\b${GF_QUAL} (?:wheat starch|almidon de trigo)`, 'gi');

// Trigo sarraceno (alforfón) NO es trigo ni lleva gluten
const BUCKWHEAT_RE = /\btrigo (?:sarraceno|negro)\b/gi;

// Almidones de origen conocido sin gluten: no son «almidón» ambiguo
const SAFE_STARCH_RE = /\b(?:almidon|fecula)(?: modificado)? de (?:maiz|patata|arroz|tapioca|mandioca|yuca|guisante)\b|\b(?:corn|maize|potato|rice|tapioca|pea) starch\b/gi;

// Negaciones: «sin trigo», «libre de cebada y centeno», «free from wheat, barley»,
// «wheat-free». Solo se anulan palabras de la lista cerrada, para que
// «Sin gluten, harina de trigo» NO esconda el trigo.
const NEG_SEP = '(?: ?(?:,|/|&|·|\\by\\b|\\be\\b|\\bni\\b|\\bo\\b|\\band\\b|\\bor\\b|\\bnor\\b) ?)';
const NEGATION_RE = new RegExp(
  `\\b(?:${SIN}|libres? de|exent[oa]s? de|free from|free of|no contiene|no contienen|no lleva|does not contain|without|sans|senza|sem|ohne)` +
  ` ?:? ?${NEG_ITEM}\\b(?:${NEG_SEP}${NEG_ITEM}\\b)*` +
  `|\\b${NEG_ITEM} ?-? ?(?:free|frei|fri|vrij)\\b`, 'gi');

// Analiza un texto (de OCR o de Open Food Facts) y devuelve todas las señales.
function scanText(rawText) {
  const original = String(rawText || '');
  let t = norm(original)
    .replace(BUCKWHEAT_RE, 'alforfon')
    .replace(SAFE_STARCH_RE, 'fecula');

  // 1. «No apto para celíacos» es una señal de peligro, y hay que quitarla
  //    antes de buscar «apto para celíacos»
  let notSuitable = false;
  t = t.replace(NOT_SUITABLE_RE, () => { notSuitable = true; return ' | '; });

  // 2. Trazas → se apartan para que no cuenten como ingrediente
  const traceSpans = [];
  t = t.replace(TRACES_RE, (m) => { traceSpans.push(m); return ' | '; });
  const tracesText = traceSpans.join(' . ');
  const traceHits = findMatches(tracesText, DANGER_TERMS);
  const traceGluten = traceHits.length > 0 || new RegExp(`\\b${GLU}`, 'i').test(tracesText);

  // 3. Mención «sin gluten» y licencia de la Espiga Barrada
  const claim = GF_CLAIM_RES.some(re => re.test(t));
  const lic = original.match(AOECS_LICENSE_RE);
  const license = lic ? `${lic[1]}-${lic[2]}-${lic[3]}` : null;

  // 4. Almidón de trigo sin gluten y negaciones → se retiran del texto
  let codexStarch = false;
  t = t.replace(CODEX_STARCH_RE, () => { codexStarch = true; return ' | '; });
  t = t.replace(NEGATION_RE, ' | ');

  // 5. Lo que queda son los ingredientes «de verdad»
  const dangerHits = findMatches(t, DANGER_TERMS);
  const glutenPresent = notSuitable || GLUTEN_PRESENT_RES.some(re => re.test(t));
  const doubtHits = findMatches(t, DOUBT_TERMS);

  return {
    claim: claim || !!license,
    license,
    codexStarch,
    dangerHits,
    glutenPresent,
    doubtHits,
    traceGluten,
    traceHits,
  };
}

// Riesgo de un ingrediente suelto, con la misma lógica que el veredicto
function ingredientRisk(item) {
  const s = scanText(item);
  if (s.dangerHits.length || s.glutenPresent) return 'danger';
  if (s.traceGluten || (s.doubtHits.length && !s.claim)) return 'doubt';
  return 'safe';
}

// Trocea una lista de ingredientes respetando paréntesis: «almidón de trigo
// (sin gluten)» se queda junto; un «chocolate (azúcar, cacao…)» largo se expande.
function splitIngredients(text, limit = 12) {
  const out = [];
  const walk = (str) => {
    let depth = 0, cur = '';
    const pieces = [];
    for (const ch of str) {
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
      if (depth === 0 && (ch === ',' || ch === ';' || ch === '.')) { pieces.push(cur); cur = ''; }
      else cur += ch;
    }
    pieces.push(cur);
    for (let p of pieces) {
      p = p.trim().replace(/^[\s:*\-–]+|[\s:*\-–]+$/g, '');
      if (p.length < 2) continue;
      if (p.length < 60) { out.push(p); continue; }
      const open = p.search(/[([]/);
      if (open > 1) {
        const head = p.slice(0, open).trim();
        if (head.length > 1 && head.length < 60) out.push(head);
        walk(p.slice(open + 1).replace(/[)\]]\s*$/, ''));
      }
    }
  };
  // El OCR a veces se come el punto antes de «Puede contener…»: lo reponemos
  // para que la advertencia no se pegue al último ingrediente
  walk(String(text || '').replace(/[\s,]+(?=(?:puede|pueden) contener|may contain)/gi, '. '));
  return out.slice(0, limit).map(name => ({ name, risk: ingredientRisk(name) }));
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

  // Term scan over ingredients (con negaciones, trazas y almidón Codex resueltos)
  const scan = scanText(ingredientsText);
  const dangerHits = scan.dangerHits;
  const doubtHits = scan.doubtHits;
  // OFF deduce «en:gluten» automáticamente al ver «trigo»; si el producto está
  // etiquetado sin gluten y el único trigo es almidón Codex, el alérgeno es falso.
  const allergenIsCodexOnly = hasGlutenAllergen && hasGlutenFreeLabel && scan.codexStarch
    && !dangerHits.length && !scan.glutenPresent;

  let state = 'dudoso';
  let reason = 'incomplete';  // motivo del veredicto (lo usa applyProfile)
  let title = 'Información incompleta';
  let subtitle = 'Comprueba la etiqueta';
  let crossLevel = 'high';
  let crossText = 'No hay datos suficientes. Confirma con la etiqueta del producto.';

  if ((hasGlutenAllergen && !allergenIsCodexOnly) || dangerHits.length > 0 || scan.glutenPresent) {
    state = 'noApto';
    reason = 'gluten';
    title = 'Contiene gluten';
    subtitle = dangerHits.length
      ? `Detectado: ${dangerHits.slice(0, 2).join(', ')}`
      : 'Etiquetado como alérgeno';
    crossLevel = 'critical';
    crossText = 'Producto elaborado con cereales con gluten.';
  } else if (hasGlutenFreeLabel) {
    state = 'apto';
    reason = 'label';
    title = 'Sin gluten';
    subtitle = 'Apto para celíacos';
    crossLevel = 'low';
    crossText = scan.codexStarch
      ? 'Etiquetado como sin gluten. Lleva almidón de trigo sin gluten (tratado, <20 mg/kg), permitido en productos para celíacos.'
      : 'Producto etiquetado oficialmente como sin gluten.';
  } else if (hasGlutenTraces || scan.traceGluten) {
    state = 'dudoso';
    reason = 'traces';
    title = 'Puede contener trazas';
    subtitle = 'Riesgo de contaminación cruzada';
    crossLevel = 'high';
    crossText = 'El fabricante advierte que puede contener trazas de gluten.';
  } else if (scan.claim) {
    state = 'apto';
    reason = 'claim';
    title = 'Sin gluten';
    subtitle = 'Los ingredientes indican «sin gluten»';
    crossLevel = 'low';
    crossText = 'La lista de ingredientes menciona «sin gluten», aunque Open Food Facts no lo tiene como etiqueta.';
  } else if (doubtHits.length > 0) {
    state = 'dudoso';
    reason = 'doubt';
    title = 'Mejor verifícalo';
    subtitle = `Ingredientes ambiguos: ${doubtHits.slice(0, 2).join(', ')}`;
    crossLevel = 'high';
    crossText = 'Algunos ingredientes pueden contener gluten según el origen. Comprueba la etiqueta.';
  } else if (ingredientsText) {
    // Si tiene lista de ingredientes y nada sospechoso, lo consideramos seguro pero sin certificación
    state = 'apto';
    reason = 'clean';
    title = 'Probablemente seguro';
    subtitle = 'Sin ingredientes con gluten detectados';
    crossLevel = 'low';
    crossText = 'No hemos detectado ingredientes con gluten. Sin certificación oficial.';
  }

  // Build ingredient list with risk markers
  const ingredients = ingredientsText ? splitIngredients(ingredientsText) : [];

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
    imageUrl: product.image_front_url || product.image_url || product.image_front_small_url || null,
    imgBg,
    state,
    title,
    subtitle,
    cert: hasGlutenFreeLabel ? 'Etiquetado oficialmente como sin gluten' : null,
    ingredients: ingredients.length ? ingredients : [{ name: 'Lista no disponible', risk: 'safe' }],
    crossContamination: { level: crossLevel, text: crossText },
    reason,
    reports: { safe: 0, unsafe: 0 },
    raw: product,
  };
}

// ─── Open Food Facts client ───────────────────────────────────
const OFF = {
  async fetchProduct(barcode) {
    const code = String(barcode).replace(/\D/g, '');
    if (!code) throw new Error('Código vacío');
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_es,generic_name,brands,ingredients_text,ingredients_text_es,labels_tags,allergens_tags,traces_tags,categories_tags,code,image_front_url,image_front_small_url,image_url`;

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

    const fetchOnce = async (timeoutMs) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          credentials: 'omit',
          mode: 'cors',
        });
        clearTimeout(timeoutId);
        return res;
      } catch (e) {
        clearTimeout(timeoutId);
        throw e;
      }
    };

    // Intento 1
    let res, lastFailType = null;
    try {
      res = await fetchOnce(15000);
    } catch (e) {
      lastFailType = e.name === 'AbortError' ? 'timeout' : 'network';
    }

    // Si fue 503 o falló, reintentamos UNA vez tras 800ms
    const needsRetry = !res || res.status === 503 || res.status === 504 || res.status === 502;
    if (needsRetry) {
      await new Promise(r => setTimeout(r, 800));
      try {
        res = await fetchOnce(15000);
      } catch (e) {
        if (!res) {
          if (e.name === 'AbortError') { const err = new Error('timeout'); err.code = 'timeout'; throw err; }
          const err = new Error('network'); err.code = 'network'; err.detail = e.message || e.name; throw err;
        }
      }
    }

    if (!res) {
      const err = new Error(lastFailType || 'network'); err.code = lastFailType || 'network'; throw err;
    }

    // 503/502/504 incluso tras reintento → "servidor ocupado"
    if (res.status === 503 || res.status === 502 || res.status === 504) {
      const err = new Error('busy'); err.code = 'busy'; err.status = res.status; throw err;
    }
    if (!res.ok) {
      const err = new Error(`http_${res.status}`); err.code = 'http'; err.status = res.status; throw err;
    }

    // OFF puede devolver HTML 200 a veces si la query es muy ambigua
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      const err = new Error('busy'); err.code = 'busy'; throw err;
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
// «Ingredientes» tolerante a OCR: «lngredientes», «INGRED1ENTES»…
const INGREDIENT_HEADER_RE = /\b[il1|]ngred[il1|]ent(?:es|s|en|i|[il1|])\b/i;

function assessOcrQuality(rawText) {
  const text = String(rawText || '');
  const n = norm(text);
  const reasons = [];
  if (text.length < 30) reasons.push('texto muy corto');

  // Palabras de 2+ letras
  const words = n.match(/[a-z]{2,}/g) || [];
  const longWords = words.filter(w => w.length >= 4);
  if (longWords.length < 4) reasons.push('pocas palabras completas');

  // Proporción de caracteres "raros" (no letras, no espacios, no comas/puntos/dígitos comunes)
  const total = n.replace(/\s/g, '').length || 1;
  const letters = (n.match(/[a-z]/g) || []).length;
  const letterRatio = letters / total;
  if (letterRatio < 0.55) reasons.push('demasiados símbolos extraños');

  // Necesitamos al menos UNA palabra del vocabulario alimentario para creer que es una etiqueta
  const FOOD_WORDS = /\b(ingredient|gluten|harina|azucar|aceite|sal|agua|leche|huevo|trigo|cebada|avena|centeno|arroz|maiz|levadura|conservante|colorante|aroma|emulgente|estabilizante|antioxidante|cacao|chocolate|fruta|jarabe|almidon|proteina|lactosa|alergeno|flour|sugar|salt|oil|water|milk|rice|corn)/i;
  const hasFoodWord = FOOD_WORDS.test(n);
  if (!hasFoodWord) reasons.push('no se reconoce vocabulario de etiqueta');

  // Necesitamos el marcador "ingredientes" o similar para considerarlo fiable
  const hasIngredientHeader = INGREDIENT_HEADER_RE.test(n);

  const score = Math.max(0, 100 - reasons.length * 30);
  return {
    ok: reasons.length === 0 && hasIngredientHeader,
    score,
    reasons,
    hasIngredientHeader,
    hasFoodWord,
  };
}

// ─── Verdict from raw OCR'd label text ────────────────────────
// Orden de prioridad (de más a menos grave):
//   1. Ingrediente con gluten o «contiene gluten»  → NO APTO (aunque la foto sea mala)
//   2. Advertencia de trazas de gluten             → DUDOSO
//   3. Mención «sin gluten» / Espiga Barrada        → APTO (aunque la foto sea mala:
//      la mención es lo que cuenta, y en la UE solo puede usarse con <20 mg/kg)
//   4. Foto ilegible                                → DUDOSO
//   5. Ingredientes ambiguos (avena, almidón…)      → DUDOSO
//   6. Lista limpia pero sin mención                → DUDOSO (no nos comprometemos)
function analyzeText(rawText, opts = {}) {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const quality = assessOcrQuality(text);
  const scan = scanText(text);

  // Try to isolate the ingredient list
  let ingredientsText = text;
  const m = text.match(/[il1|]ngred[il1|]ent(?:es|s|en|i|[il1|])\s*[:.\-]\s*([\s\S]{4,800})/i);
  if (m) ingredientsText = m[1].trim();

  // Stop at the next obvious section header
  ingredientsText = ingredientsText
    .split(/\b(?:informaci[oó]n\s+nutricional|nutritional\s+(?:information|info)|valores?\s+nutricional|consumir\s+preferentemente|conservaci[oó]n|alm?acenamiento|peso\s+neto|fabricado|fabricante|distribuido|envasado|lote|caducidad)\b/i)[0]
    .trim();

  let state, title, subtitle, crossLevel, crossText, reason;
  let cert = null;

  if (scan.glutenPresent || (scan.dangerHits.length > 0 && !scan.claim)) {
    // Detección de peligro: siempre NO APTO, incluso con OCR pobre
    state = 'noApto';
    reason = 'gluten';
    title = 'Contiene gluten';
    subtitle = scan.dangerHits.length
      ? `Detectado: ${scan.dangerHits.slice(0, 2).join(', ')}`
      : 'La etiqueta indica que lleva gluten';
    crossLevel = 'critical';
    crossText = 'Detectamos uno o más ingredientes con gluten en el texto.';
  } else if (scan.dangerHits.length > 0) {
    // Dice «sin gluten» pero también leemos un cereal con gluten. Casi siempre es
    // ruido del OCR (columnas mezcladas, «SEM … TRIGO» partido) o una negación
    // que no hemos sabido interpretar, porque un producto «sin gluten» no puede
    // llevar trigo normal. Ni «apto» ni «contiene gluten»: que lo mire.
    state = 'dudoso';
    reason = 'conflict';
    title = 'Revisa la etiqueta';
    subtitle = `Dice «sin gluten», pero leemos «${scan.dangerHits[0]}»`;
    crossLevel = 'high';
    crossText = `La etiqueta menciona «sin gluten», pero en la foto también aparece «${scan.dangerHits.slice(0, 2).join('», «')}». Puede ser un error de lectura (por ejemplo, de una frase como «sin trigo») o un fallo de etiquetado. Comprueba la lista de ingredientes antes de consumirlo.`;
  } else if (scan.traceGluten) {
    state = 'dudoso';
    reason = 'traces';
    title = 'Puede contener trazas';
    subtitle = scan.traceHits.length
      ? `Trazas de ${scan.traceHits.slice(0, 2).join(', ')}`
      : 'Riesgo de contaminación cruzada';
    crossLevel = 'high';
    crossText = 'El fabricante advierte que puede contener trazas de gluten.';
  } else if (scan.claim) {
    state = 'apto';
    reason = 'claim';
    title = 'Sin gluten';
    subtitle = scan.license
      ? 'Con licencia de la Espiga Barrada'
      : 'La etiqueta indica «sin gluten»';
    crossLevel = 'low';
    cert = scan.license
      ? `Espiga Barrada · licencia ${scan.license}`
      : 'Mención «sin gluten» en el envase';
    const legal = 'En la UE, la mención «sin gluten» solo puede usarse con menos de 20 mg/kg de gluten.';
    crossText = quality.hasIngredientHeader
      ? `Hemos leído la mención «sin gluten» y no hay ingredientes con gluten en la lista. ${legal}`
      : `Hemos leído la mención «sin gluten» del envase. ${legal}`;
    if (scan.codexStarch) crossText += ' Lleva almidón de trigo sin gluten (tratado), permitido para celíacos.';
  } else if (!quality.ok) {
    // OCR de baja calidad y sin mención «sin gluten» → dudoso
    state = 'dudoso';
    reason = 'unreadable';
    title = 'No se pudo leer bien';
    subtitle = quality.hasIngredientHeader
      ? 'La imagen no es lo bastante clara'
      : 'No vemos la lista de “Ingredientes” ni la mención «sin gluten»';
    crossLevel = 'high';
    crossText = 'No podemos garantizar nada con esta foto. Acércate a la mención «sin gluten» o a la lista de ingredientes, con buena luz, y vuelve a intentarlo. Si la mención va en un logotipo pequeño o en curva, escanea mejor el código de barras: es mucho más fiable.';
  } else if (scan.doubtHits.length > 0) {
    state = 'dudoso';
    reason = 'doubt';
    title = 'Mejor verifícalo';
    subtitle = `Ingredientes ambiguos: ${scan.doubtHits.slice(0, 2).join(', ')}`;
    crossLevel = 'high';
    crossText = 'Algunos ingredientes pueden contener gluten según el origen. Comprueba la etiqueta.';
  } else {
    // Calidad OK, sin peligros ni dudas, pero sin certificación explícita →
    // NO decimos "apto"; lo dejamos en dudoso para no comprometernos.
    state = 'dudoso';
    reason = 'noclaim';
    title = 'Sin gluten visible';
    subtitle = 'Sin certificación oficial. Verifica con la etiqueta.';
    crossLevel = 'high';
    crossText = 'No detectamos ingredientes con gluten en el texto, pero al ser una lectura por foto no podemos garantizarlo.';
  }

  // Lista de ingredientes a mostrar: solo si hay cabecera «Ingredientes» y el
  // texto es legible. Si no, mostramos el texto crudo para que el usuario lo vea.
  let ingredients = [];
  if (quality.ok || (quality.hasIngredientHeader && quality.hasFoodWord)) {
    ingredients = splitIngredients(ingredientsText);
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
    cert,
    ingredients,
    crossContamination: { level: crossLevel, text: crossText },
    reason,
    reports: { safe: 0, unsafe: 0 },
    source: 'ocr',
    ocrText: text,
    ocrQuality: quality,
  };
}

// ─── Ajuste del veredicto según el perfil del usuario ─────────
// El análisis siempre es el estricto (celíaco). Aquí solo se RELAJA lo que el
// usuario ha pedido relajar, y nunca lo grave:
//   · «Contiene gluten», foto ilegible y contradicciones no se tocan nunca.
//   · Trazas: se relajan si es «Sensible» o «Por elección», o si ha apagado
//     «Avisar de trazas».
//   · Ingredientes dudosos y listas limpias sin mención: se relajan si es «Por
//     elección», o si ha apagado «Avisar de ingredientes dudosos».
// El producto relajado pasa a «apto», pero el aviso sigue visible en la ficha
// (recuadro de contaminación cruzada en ámbar + nota de perfil).
const SENSITIVITY_LABEL = { celiac: 'celíaco/a', sensitive: 'sensible al gluten', choice: 'sin gluten por elección' };

function applyProfile(product, profile) {
  if (!product || !profile || product.state !== 'dudoso') return product;
  const sens = profile.sensitivity || 'celiac';
  const relaxTraces = sens !== 'celiac' || profile.warnTraces === false;
  const relaxDoubts = sens === 'choice' || profile.warnDoubts === false;

  let why = null;
  if (product.reason === 'traces' && relaxTraces) {
    why = profile.warnTraces === false
      ? 'Tienes desactivado «Avisar de trazas».'
      : `Tu perfil es «${SENSITIVITY_LABEL[sens]}»: las trazas no te bloquean.`;
  } else if ((product.reason === 'doubt' || product.reason === 'noclaim') && relaxDoubts) {
    why = profile.warnDoubts === false
      ? 'Tienes desactivado «Avisar de ingredientes dudosos».'
      : `Tu perfil es «${SENSITIVITY_LABEL[sens]}»: los ingredientes dudosos no te bloquean.`;
  }
  if (!why) return product;

  return {
    ...product,
    state: 'apto',
    title: 'Apto para tu perfil',
    subtitle: product.subtitle,
    // el aviso original se queda a la vista en ámbar
    crossContamination: { level: 'high', text: product.crossContamination.text },
    profileNote: `${why} Para un celíaco este producto sería «dudoso».`,
    strictState: 'dudoso',
  };
}

const GlutenEngine = {
  analyze,
  analyzeText,
  applyProfile,
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
