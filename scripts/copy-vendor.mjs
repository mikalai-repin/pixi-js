// Копирует библиотеки, которые нужны коду ученика в превью, в public/vendor.
// Превью грузит их через import map (см. public/preview.html), без сборщика.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/vendor');
mkdirSync(out, { recursive: true });

const files = [
  ['node_modules/pixi.js/dist/pixi.mjs', 'pixi.mjs'],
  ['node_modules/pixi.js/dist/pixi.mjs.map', 'pixi.mjs.map'],
  ['node_modules/es-module-lexer/dist/lexer.js', 'es-module-lexer.js'],
];

for (const [from, to] of files) {
  copyFileSync(resolve(root, from), resolve(out, to));
}
console.log(`[vendor] скопировано файлов: ${files.length}`);
