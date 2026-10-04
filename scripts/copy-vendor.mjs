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
  // pixi-filters (с главы 12): готовая ESM-сборка уже импортирует 'pixi.js' как внешний модуль
  ['node_modules/pixi-filters/dist/pixi-filters.mjs', 'pixi-filters.mjs'],
  ['node_modules/pixi-filters/dist/pixi-filters.mjs.map', 'pixi-filters.mjs.map'],
  // @pixi/sound (с главы 13): тоже готовая ESM-сборка с внешним 'pixi.js'
  ['node_modules/@pixi/sound/dist/pixi-sound.mjs', 'pixi-sound.mjs'],
  ['node_modules/@pixi/sound/dist/pixi-sound.mjs.map', 'pixi-sound.mjs.map'],
  // Spine (с главы 14): ESM-сборка уже включает spine-core и импортирует только 'pixi.js'.
  // Лицензия Spine Runtimes требует распространять её текст вместе с runtime
  ['node_modules/@esotericsoftware/spine-pixi-v8/dist/esm/spine-pixi-v8.mjs', 'spine-pixi-v8.mjs'],
  ['node_modules/@esotericsoftware/spine-pixi-v8/dist/esm/spine-pixi-v8.mjs.map', 'spine-pixi-v8.mjs.map'],
  ['node_modules/@esotericsoftware/spine-core/LICENSE', 'spine-runtimes-LICENSE.txt'],
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
