// Копирует библиотеки, которые нужны коду ученика в превью, в public/vendor.
// Превью грузит их через import map (см. public/preview.html), без сборщика.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

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

// GSAP в пакете разбит на несколько ESM-файлов (index.js → gsap-core.js, CSSPlugin.js).
// Собираем их в один модуль, чтобы import map указывала на один файл
buildSync({
  entryPoints: [resolve(root, 'node_modules/gsap/index.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  sourcemap: true,
  outfile: resolve(out, 'gsap.mjs'),
  logLevel: 'warning',
});

// @pixi/ui (с главы 10): собираем вместе с зависимостью tweedle.js, а pixi.js оставляем внешним —
// его превью берёт из import map, иначе на странице окажутся две копии PixiJS
buildSync({
  entryPoints: [resolve(root, 'node_modules/@pixi/ui/lib/index.mjs')],
  bundle: true,
  format: 'esm',
  minify: true,
  sourcemap: true,
  external: ['pixi.js'],
  outfile: resolve(out, 'pixi-ui.mjs'),
  logLevel: 'warning',
});

console.log(`[vendor] скопировано файлов: ${files.length}, собраны gsap.mjs и pixi-ui.mjs`);
