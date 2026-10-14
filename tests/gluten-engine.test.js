// Pruebas del motor de veredicto con textos OCR realistas.
// Uso: node tests/gluten-engine.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gluten-engine.jsx'), 'utf8'), ctx);
const { GlutenEngine } = ctx.window;

const CASES = [
  // [descripción, texto OCR, estado esperado]
  // ── Mención «sin gluten» que debe dar APTO aunque la foto sea mala ──
  ['Frontal solo «GLUTEN FREE»', 'GLUTEN FREE', 'apto'],
  ['Frontal «Sin gluten» con ruido', 'SIN GLUTEN\n~ 250g = |', 'apto'],
  ['OCR con l→I', 'GIUTEN FREE  Crackers', 'apto'],
  ['OCR con l→1 y e→3', 'g1ut3n fr3e', 'apto'],
  ['OCR partido «GLUTEN FRE E»', 'GLUTEN FRE E', 'apto'],
  ['Pegado «glutenfree»', 'glutenfree pasta', 'apto'],
  ['Sin tilde y mayúsculas', 'SIN GLUTEN - Pan de molde', 'apto'],
  ['Francés', 'Sans gluten', 'apto'],
  ['Italiano', 'Senza glutine', 'apto'],
  ['Alemán', 'Glutenfrei', 'apto'],
  ['Portugués', 'Sem glúten', 'apto'],
  ['Licencia Espiga Barrada', 'ES-020-001\nharina de arroz', 'apto'],
  ['Etiqueta completa con almidón y «sin gluten»',
    'Ingredientes: harina de arroz, almidón de maíz, azúcar, aceite de girasol, sal. Sin gluten.', 'apto'],
  ['Avena sin gluten certificada',
    'Ingredientes: copos de avena sin gluten (100%). Producto sin gluten.', 'apto'],
  ['Free from con lista de cereales',
    'Gluten free. Free from wheat, barley and rye. Ingredients: rice flour, sugar, salt.', 'apto'],
  ['«Sin trigo» en mención',
    'Sin gluten · Sin trigo · Sin lactosa. Ingredientes: maíz, sal, aceite.', 'apto'],
  ['Almidón de trigo sin gluten (Codex)',
    'Ingredientes: almidón de trigo sin gluten, agua, levadura, sal. Sin gluten.', 'apto'],

  // ── Peligro real: nunca debe salir APTO ──
  ['Contiene trigo', 'Ingredientes: harina de trigo, agua, sal, levadura.', 'noApto'],
  ['Contiene gluten explícito', 'Ingredientes: maíz, sal. Contiene gluten.', 'noApto'],
  ['Alérgenos: cereales con gluten', 'Ingredientes: harina, azúcar. Alérgenos: cereales que contienen gluten.', 'noApto'],
  ['Tabulé con tilde final', 'Ingredientes: tabulé, tomate, pepino, aceite.', 'noApto'],
  ['Sémola sin tilde (OCR)', 'Ingredientes: semola de trigo duro, agua.', 'noApto'],
  // Mención «sin gluten» + cereal con gluten → contradicción: ni apto ni «contiene»
  ['«Sin gluten» + trigo en ingredientes',
    'Sin gluten. Ingredientes: harina de trigo, agua.', 'dudoso'],
  ['OCR mezcla columnas: «SEM … TRIGO»',
    'Elaborado sin gluten. INGREDIENTES: harina de arroz, agua. Pode conter tremoço e mostarda. SEM son sey, antes de hornear, TRIGO.', 'dudoso'],
  ['Extracto de malta', 'Ingredientes: arroz, azúcar, extracto de malta de cebada, sal.', 'noApto'],

  // ── Dudosos ──
  ['Trazas de trigo', 'Ingredientes: maíz, sal, aceite. Puede contener trazas de trigo.', 'dudoso'],
  ['May contain gluten', 'Ingredients: corn, salt, sunflower oil. May contain gluten.', 'dudoso'],
  ['Avena sin certificar', 'Ingredientes: copos de avena, miel, azúcar, aceite.', 'dudoso'],
  ['Foto ilegible', '~~ ;; ##', 'dudoso'],
  ['Lista limpia sin mención', 'Ingredientes: maíz, aceite de girasol, sal, agua.', 'dudoso'],
  ['«Con gluten» no es «sin gluten»', 'Pan con gluten', 'noApto'],

  // ── Casos trampa: que las mejoras no abran agujeros ──
  ['«Sin gluten» seguido de trigo en lista', 'Sin gluten, harina de trigo, agua', 'dudoso'],
  ['«Sin lactosa» no tapa el trigo', 'Sin lactosa. Ingredientes: harina de trigo, leche.', 'noApto'],
  ['Trazas no se tragan la lista', 'Puede contener trazas de soja. Ingredientes: harina de trigo, sal.', 'noApto'],
  ['Trazas entre paréntesis', 'Ingredientes: maíz (puede contener trazas de soja), harina de trigo, sal.', 'noApto'],
  ['Trazas con lista de alérgenos', 'Ingredientes: maíz, sal. Puede contener trazas de soja, leche y trigo.', 'dudoso'],
  ['No apto para celíacos', 'Ingredientes: harina, agua. No apto para celíacos.', 'noApto'],
  ['Apto para celíacos', 'Ingredientes: arroz, sal. Apto para celíacos.', 'apto'],
  ['Fábrica que manipula trigo', 'Ingredientes: arroz, sal, aceite. Elaborado en una fábrica que también utiliza trigo.', 'dudoso'],
  ['Planta con cereales con gluten', 'Ingredientes: arroz, sal. Elaborado en planta que manipula cereales con gluten.', 'dudoso'],
  ['«Gluten free» + trazas de gluten', 'Gluten free. Ingredients: rice, salt. May contain traces of gluten.', 'dudoso'],
  ['«Sin gluten» + malta de cebada', 'Sin gluten. Ingredientes: arroz, malta de cebada.', 'dudoso'],
  ['«Sin gluten» + contiene soja', 'Sin gluten. Ingredientes: maíz, sal. Contiene: soja.', 'apto'],
  ['Contiene: leche, gluten', 'Ingredientes: harina, leche. Contiene: leche, gluten.', 'noApto'],
  ['Alérgenos: leche, gluten', 'Ingredientes: harina, leche. Alérgenos: leche, gluten.', 'noApto'],
  ['Almidón de trigo sin calificar', 'Ingredientes: almidón de trigo, agua, sal. Sin lactosa.', 'noApto'],
  ['Almidón Codex + harina de trigo', 'Sin gluten. Ingredientes: almidón de trigo sin gluten, harina de trigo.', 'dudoso'],
  ['Trazas en portugués', 'Ingredientes: arroz, sal. Pode conter vestígios de trigo.', 'dudoso'],
  ['Trazas en italiano', 'Ingredienti: riso, sale. Può contenere tracce di frumento e orzo.', 'dudoso', 'Puede contener trazas'],
  ['Trazas en portugués (título)', 'Ingredientes: arroz, sal. Pode conter vestígios de trigo.', 'dudoso', 'Puede contener trazas'],
  ['Alemán con Weizen', 'Zutaten: Weizenmehl, Wasser, Salz.', 'noApto'],
  ['Francés con blé', 'Ingrédients : farine de blé, sucre, sel.', 'noApto'],
  ['«Revisa» explica la contradicción', 'Sin gluten. Ingredientes: harina de trigo, agua.', 'dudoso', 'Revisa la etiqueta'],
  ['Trigo sarraceno sin mención', 'Ingredientes: harina de trigo sarraceno, agua, sal, levadura.', 'dudoso'],
  ['Trigo sarraceno sin gluten', 'Pasta de trigo sarraceno. Sin gluten. Ingredientes: trigo sarraceno, agua.', 'apto'],
  ['Trigo sarraceno + trigo normal', 'Ingredientes: harina de trigo sarraceno, harina de trigo, sal.', 'noApto'],
  ['Glutamato no es gluten', 'Ingredientes: maíz, glutamato monosódico, sal, aceite de girasol.', 'dudoso'],
  ['OCR «SlN GLUTEN»', 'SlN GLUTEN', 'apto'],
  ['0% gluten', 'Galletas 0% gluten', 'apto'],
  ['«No apto para dietas sin gluten»', 'Contiene gluten. No apto para dietas sin gluten.', 'noApto'],
];

let fail = 0;
for (const [desc, text, expected, expectedTitle] of CASES) {
  const r = GlutenEngine.analyzeText(text);
  const got = r ? r.state : 'null';
  const ok = got === expected && (!expectedTitle || (r && r.title === expectedTitle));
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${desc.padEnd(46)} → ${got.padEnd(7)} (esperado ${expected})${ok ? '' : `  · ${r && r.title} / ${r && r.subtitle}`}`);
}
// ── Productos de Open Food Facts (lectura por código de barras) ──
const OFF_CASES = [
  ['OFF: crema de cacao sin etiqueta', {
    ingredients_text_es: 'Azúcar, aceite de palma, avellanas 13%, leche desnatada en polvo 8,7%, cacao magro 7,4%, emulgentes: lecitinas (soja), vainillina.',
  }, 'apto'],
  ['OFF: etiqueta sin gluten + almidón Codex (OFF marca en:gluten)', {
    labels_tags: ['en:no-gluten'], allergens_tags: ['en:gluten'],
    ingredients_text_es: 'Almidón de maíz, almidón de trigo sin gluten, azúcar, aceite de girasol.',
  }, 'apto'],
  ['OFF: etiqueta sin gluten + harina de trigo', {
    labels_tags: ['en:no-gluten'], ingredients_text_es: 'Harina de trigo, azúcar.',
  }, 'noApto'],
  ['OFF: alérgeno gluten', { allergens_tags: ['en:gluten'], ingredients_text_es: 'Harina, azúcar.' }, 'noApto'],
  ['OFF: trazas en el texto de ingredientes', {
    ingredients_text_es: 'Maíz, aceite de girasol, sal. Puede contener trazas de trigo.',
  }, 'dudoso'],
  ['OFF: avena con etiqueta sin gluten', {
    labels_tags: ['en:no-gluten'], ingredients_text_es: 'Copos de avena sin gluten.',
  }, 'apto'],
];
for (const [desc, product, expected] of OFF_CASES) {
  const r = GlutenEngine.analyze(product);
  const ok = r.state === expected;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${desc.padEnd(46)} → ${r.state.padEnd(7)} (esperado ${expected})${ok ? '' : `  · ${r.title} / ${r.subtitle}`}`);
}
// ── Ajuste por perfil: solo relaja lo que el usuario pide, nunca lo grave ──
const CELIAC = { sensitivity: 'celiac', warnTraces: true, warnDoubts: true };
const PROFILE_CASES = [
  ['Celíaco: trazas siguen dudosas', 'Ingredientes: maíz, sal. Puede contener trazas de trigo.', CELIAC, 'dudoso'],
  ['Celíaco sin aviso de trazas → apto', 'Ingredientes: maíz, sal. Puede contener trazas de trigo.', { ...CELIAC, warnTraces: false }, 'apto'],
  ['Sensible: trazas → apto', 'Ingredientes: maíz, sal. Puede contener trazas de trigo.', { ...CELIAC, sensitivity: 'sensitive' }, 'apto'],
  ['Sensible: dudosos siguen dudosos', 'Ingredientes: copos de avena, miel, azúcar, aceite.', { ...CELIAC, sensitivity: 'sensitive' }, 'dudoso'],
  ['Por elección: dudosos → apto', 'Ingredientes: copos de avena, miel, azúcar, aceite.', { ...CELIAC, sensitivity: 'choice' }, 'apto'],
  ['Por elección: lista limpia → apto', 'Ingredientes: maíz, aceite de girasol, sal, agua.', { ...CELIAC, sensitivity: 'choice' }, 'apto'],
  ['Por elección: con trigo sigue NO APTO', 'Ingredientes: harina de trigo, agua, sal.', { ...CELIAC, sensitivity: 'choice', warnTraces: false, warnDoubts: false }, 'noApto'],
  ['Por elección: foto ilegible sigue dudosa', '~~ ;; ##', { ...CELIAC, sensitivity: 'choice' }, 'dudoso'],
  ['Por elección: contradicción sigue dudosa', 'Sin gluten. Ingredientes: harina de trigo, agua.', { ...CELIAC, sensitivity: 'choice' }, 'dudoso'],
];
for (const [desc, text, profile, expected] of PROFILE_CASES) {
  const r = GlutenEngine.applyProfile(GlutenEngine.analyzeText(text), profile);
  const ok = r.state === expected && (r.state !== 'apto' || r.strictState !== 'dudoso' || !!r.profileNote);
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${desc.padEnd(46)} → ${r.state.padEnd(7)} (esperado ${expected})`);
}

// ── Marcado de ingredientes en la lista ──
const LIST_CASES = [
  ['Almidón de maíz no es ambiguo', 'Ingredientes: harina de arroz, almidón de maíz, almidón, sal. Sin gluten.',
    { 'almidón de maíz': 'safe', 'almidón': 'doubt' }],
  ['Trazas sin punto no se pegan al último ingrediente', 'Ingredientes: arroz, sal, gasificante Puede contener trazas de trigo y soja.',
    { 'gasificante': 'safe', 'Puede contener trazas de trigo y soja': 'doubt' }],
];
for (const [desc, text, expectedRisks] of LIST_CASES) {
  const r = GlutenEngine.analyzeText(text);
  const got = Object.fromEntries(r.ingredients.map(i => [i.name, i.risk]));
  const bad = Object.entries(expectedRisks).filter(([name, risk]) => got[name] !== risk);
  if (bad.length) fail++;
  console.log(`${bad.length ? 'FAIL' : 'OK  '} ${desc.padEnd(46)}${bad.length ? '  · ' + JSON.stringify(got) : ''}`);
}

const total = CASES.length + OFF_CASES.length + PROFILE_CASES.length + LIST_CASES.length;
console.log(`\n${total - fail}/${total} correctos`);
process.exit(fail ? 1 : 0);
