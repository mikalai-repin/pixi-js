// Собирает ресурсы Puzzling Potions через AssetPack так же, как это делает оригинальная игра:
// атласы из папок {tps}, бандлы из папок {m}, манифест для Assets.init.
// Исходники — reference/open-games/puzzling-potions/raw-assets (npm run reference).
// Результат — public/assets/packed. Он хранится в git: запускать скрипт нужно только при изменении ресурсов.
import { AssetPack } from '@assetpack/core';
import { pixiPipes } from '@assetpack/core/pixi';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const entry = './reference/open-games/puzzling-potions/raw-assets';
const output = './public/assets/packed';

if (!existsSync(entry)) {
  console.error('[assets] Нет исходников. Сначала выполните: npm run reference');
  process.exit(1);
}

rmSync(output, { recursive: true, force: true });

const assetpack = new AssetPack({
  entry,
  output,
  cache: false,
  pipes: [
    ...pixiPipes({
      texturePacker: { texturePacker: { removeFileExtension: true } },
      manifest: { output: `${output}/manifest.json` },
    }),
  ],
});

await assetpack.run();

// Второй манифест — без звуков и Spine. До глав 13–14 в курсе не подключены @pixi/sound и плагин Spine,
// и полный манифест засыпал бы консоль ученика предупреждениями «не знаю, как разобрать этот файл»
const NEEDS_PLUGIN = /\.(mp3|ogg|wav)$|\.atlas$|-skeleton/;
const manifest = JSON.parse(readFileSync(`${output}/manifest.json`, 'utf8'));
for (const bundle of manifest.bundles) {
  bundle.assets = bundle.assets.filter((asset) => !asset.src.some((src) => NEEDS_PLUGIN.test(src)));
}
writeFileSync(`${output}/manifest-basic.json`, JSON.stringify(manifest, null, 2));

// Третий манифест — со звуками, но без Spine: для главы 13 (@pixi/sound подключён, плагина Spine ещё нет)
const NEEDS_SPINE = /\.atlas$|-skeleton/;
const withSound = JSON.parse(readFileSync(`${output}/manifest.json`, 'utf8'));
for (const bundle of withSound.bundles) {
  bundle.assets = bundle.assets.filter((asset) => !asset.src.some((src) => NEEDS_SPINE.test(src)));
}
writeFileSync(`${output}/manifest-sound.json`, JSON.stringify(withSound, null, 2));

console.log(`[assets] готово: ${output} (manifest.json, manifest-basic.json, manifest-sound.json)`);
