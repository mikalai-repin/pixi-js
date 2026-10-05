// Собирает ресурсы Bubbo Bubbo для главы 17 через AssetPack: один атлас картинок (бандл `bubbo`)
// и три коротких звука. Исходники — reference/open-games/bubbo-bubbo/raw-assets (npm run reference).
// Берём только то, что нужно учебной версии: шары, пушку, фон и пару элементов интерфейса.
// Результат — public/assets/bubbo. Он хранится в git: запускать скрипт нужно только при изменении набора.
import { AssetPack } from '@assetpack/core';
import { pixiPipes } from '@assetpack/core/pixi';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const raw = './reference/open-games/bubbo-bubbo/raw-assets';
const entry = './tools/e2e/out/bubbo-raw';
const output = './public/assets/bubbo';

if (!existsSync(raw)) {
  console.error('[assets] Нет исходников. Сначала выполните: npm run reference');
  process.exit(1);
}

const IMAGES = {
  'images/preload{m}{tps}': [
    'bubble-blue', 'bubble-green', 'bubble-red', 'bubble-yellow', 'bubble-shadow', 'bubble-shine',
    'cannon-main', 'cannon-barrel', 'cannon-arrow', 'cannon-top', 'background-tile',
  ],
  'images/game-screen{m}{tps}': ['bubble-bomb', 'shot-visualiser', 'bottom-tray', 'top-tray', 'game-side-border'],
};
const SOUNDS = ['bubble-land-sfx', 'bubbles-falling', 'cannon-move'];

// Временная папка-вход устроена как у Puzzling Potions: бандл `bubbo{m}`, внутри атлас `bubbo-atlas{tps}` и звуки
const bundle = join(entry, 'bubbo{m}');
const atlas = join(bundle, 'bubbo-atlas{tps}');
rmSync(entry, { recursive: true, force: true });
mkdirSync(atlas, { recursive: true });
for (const [dir, names] of Object.entries(IMAGES)) {
  for (const name of names) copyFileSync(join(raw, dir, `${name}.png`), join(atlas, `${name}.png`));
}
for (const name of SOUNDS) copyFileSync(join(raw, 'audio', `${name}.wav`), join(bundle, `${name}.wav`));

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
rmSync(entry, { recursive: true, force: true });

console.log(`[assets] готово: ${output}/manifest.json`);
