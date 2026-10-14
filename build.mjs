// build.mjs — compila los .jsx a un único dist/app.js para no traducir JSX en
// el móvil (antes se cargaba Babel, ~3 MB, y compilaba en cada arranque).
//
//   npm run build     → genera dist/app.js
//   npm run check     → falla si dist/app.js no está al día (lo usa la CI)
//
// Los scripts se concatenan en el mismo orden que antes cargaba index.html.
// Son scripts clásicos que comparten variables globales (React, GlutenEngine,
// GZOCR…), así que NO se empaquetan como módulos: solo se transforma el JSX.
import { transform } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const SOURCES = [
  'ios-frame.jsx',
  'tweaks-panel.jsx',
  'gluten-engine.jsx',
  'ocr.js',
  'osm.js',
  'places-store.js',
  'app-mobile.jsx',
];
const OUT = 'dist/app.js';

async function build() {
  const parts = [];
  for (const file of SOURCES) {
    // CRLF (Windows) y LF (CI en Linux) deben dar exactamente la misma salida
    const src = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
    const { code } = await transform(src, {
      loader: file.endsWith('.jsx') ? 'jsx' : 'js',
      jsx: 'transform',          // React.createElement (React global por CDN)
      target: 'es2019',          // iOS 13+ / Android Chrome antiguos
      minifyWhitespace: true,
      minifySyntax: true,
      legalComments: 'none',
      sourcefile: file,
    });
    parts.push(`/* ${file} */\n${code}`);
  }
  return `/* GlutenZero — generado por build.mjs a partir de los .jsx. No editar a mano. */\n${parts.join('\n')}`;
}

const output = await build();

if (process.argv.includes('--check')) {
  const current = (await readFile(OUT, 'utf8').catch(() => '')).replace(/\r\n/g, '\n');
  if (current !== output) {
    console.error(`${OUT} no está al día. Ejecuta «npm run build» y súbelo.`);
    process.exit(1);
  }
  console.log(`${OUT} está al día.`);
} else {
  await mkdir('dist', { recursive: true });
  await writeFile(OUT, output);
  console.log(`${OUT} generado (${(output.length / 1024).toFixed(0)} KB)`);
}
