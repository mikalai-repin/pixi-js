// Исправляет картинки Spine-скелетов в public/assets/packed после AssetPack.
//
// Исходник дракона (raw-assets/common/dragon-skeleton.png) экспортирован с premultiplied alpha, и атлас говорит об этом
// строкой `pma:true`. Но AssetPack при сжатии в png/webp и уменьшении в @0.5x обрабатывает их как обычные
// картинки: у полностью прозрачных пикселей появляется цвет, а у полупрозрачных RGB бывает больше альфы.
// Runtime Spine верит атласу и смешивает такие пиксели как premultiplied — по краям персонажей белая кайма.
//
// Здесь каждая страница атласа собирается заново из исходника: premultiplied → обычная альфа (RGB / A),
// затем запись тем же именем в png/webp (уменьшение для @0.5x — по обычной альфе, как положено),
// а в атласе `pma:true` меняется на `pma:false`. Запуск отдельно: node scripts/fix-spine-alpha.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAW = './reference/open-games/puzzling-potions/raw-assets';
const OUT = './public/assets/packed';

/** Исходник premultiplied → буфер RGBA с обычной альфой */
async function unpremultiply(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) {
      data[i] = data[i + 1] = data[i + 2] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round((data[i + c] * 255) / a));
  }
  return { data, width: info.width, height: info.height };
}

export async function fixSpineAlpha(raw = RAW, out = OUT) {
  const fixed = [];
  for (const bundle of readdirSync(out)) {
    const dir = join(out, bundle);
    if (!bundle.match(/^[a-z]+$/)) continue;
    for (const atlasName of readdirSync(dir).filter((name) => name.endsWith('.atlas'))) {
      const skeleton = atlasName.match(/^(.+-skeleton)/)[1];
      const rawDir = readdirSync(raw).find((name) => name.startsWith(`${bundle}{`) || name === bundle);
      // Только premultiplied-исходники: у котла в атласе pma нет, AssetPack сжал его правильно
      if (!readFileSync(join(raw, rawDir, `${skeleton}.atlas`), 'utf8').includes('pma:true')) continue;
      const source = await unpremultiply(join(raw, rawDir, `${skeleton}.png`));
      const atlasPath = join(dir, atlasName);
      const atlas = readFileSync(atlasPath, 'utf8');
      const page = atlas.split('\n')[0].trim();
      const [, width, height] = atlas.match(/size:(\d+),(\d+)/).map(Number);
      let image = sharp(source.data, { raw: { width: source.width, height: source.height, channels: 4 } });
      if (width !== source.width || height !== source.height) image = image.resize(width, height);
      const buffer = page.endsWith('.webp')
        ? await image.webp({ lossless: true }).toBuffer()
        : await image.png({ compressionLevel: 9 }).toBuffer();
      writeFileSync(join(dir, page), buffer);
      writeFileSync(atlasPath, atlas.replace('pma:true', 'pma:false'));
      fixed.push(`${bundle}/${page}`);
    }
  }
  return fixed;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('[spine-alpha] исправлено:', (await fixSpineAlpha()).join(', '));
}
