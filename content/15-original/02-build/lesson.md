---
title: Сборка
files: [main.ts, manifest.ts, navigation.ts, GameScreen.ts, Board.ts, grid.ts, Piece.ts, GameEffects.ts, Hud.ts, audio.ts, Cauldron.ts, Dragon.ts, HomeScreen.ts, ResultScreen.ts, LoadScreen.ts, PausePopup.ts, SettingsPopup.ts, MaskTransition.ts, pool.ts, stats.ts, userSettings.ts, Button.ts, Label.ts, countdown.ts, Background.ts, app.ts]
focus: manifest.ts
noSolution: true
api: []
---

В курсе вы ни разу не думали, как TypeScript превращается в JavaScript и откуда берутся атласы: это делала платформа. Настоящий проект делает это сам, и в оригинале за это отвечают два инструмента: **Vite** собирает код, **AssetPack** — ресурсы.

## Vite: код

[Vite](https://vite.dev) — сборщик и сервер для разработки. Точка входа для него — не `main.ts`, а **`index.html`**:

```html index.html
<body>
    <script type="module" src="/src/main.ts"></script>
</body>
```

Во время разработки (`npm start` → `vite`) Vite отдаёт браузеру модули по одному, на лету переводя TypeScript в JavaScript, — почти как наше превью, только без blob-адресов. При сборке (`vite build`) он склеивает модули в несколько файлов, выбрасывает неиспользуемый код и сжимает результат. Об этом — в последнем шаге главы.

Конфигурация крошечная:

```js vite.config.js
export default {
    base: './',
    server: { host: true, port: 8000 },
    define: {
        APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
}
```

- **`base: './'`** — пути к файлам в собранной игре будут относительными. Игру можно выложить в любую папку сайта, а не только в корень.
- **`server.host: true`** — сервер разработки слушает все сетевые интерфейсы: игру можно открыть с телефона в той же сети. Для мобильной игры это важно — касания и производительность проверяют на настоящем устройстве.
- **`define`** — Vite подставит строку версии из `package.json` вместо `APP_VERSION` прямо в код. Её показывает попап настроек: «Version 0.0.1».

## AssetPack: ресурсы

Исходные ресурсы лежат в `raw-assets/` как отдельные файлы: PNG каждой кнопки и каждого зелья, звуки в `.wav`, файлы Spine. Это удобно художнику, но неудобно игре: сотни мелких файлов, тяжёлые форматы. **AssetPack** превращает их в то, что нужно игре. Его настройка — `.assetpack.js`:

```js .assetpack.js
export default {
    entry: './raw-assets',
    output: './public/assets/',
    cache: true,
    pipes: [
        ...pixiPipes({
            texturePacker: { texturePacker: { removeFileExtension: true } },
            manifest: { output: './public/assets/assets-manifest.json' },
        }),
    ],
};
```

`pixiPipes` — готовый набор обработчиков для PixiJS. Что делать с файлами, AssetPack узнаёт по **тегам в именах папок**:

| Папка | Тег | Что получится |
|---|---|---|
| `game{m}` | `{m}` — бандл манифеста | Всё внутри попадёт в бандл `game` |
| `game{m}/game-atlas{tps}` | `{tps}` — TexturePacker | Картинки папки упакуются в один атлас `game-atlas` |

Остальное AssetPack делает сам: каждую картинку и атлас сохраняет в **webp и png** и в двух разрешениях, обычном и `@0.5x`; звуки — в **ogg и mp3**; к именам файлов добавляет **хеш** содержимого (`game-atlas-UrItXg.webp`), чтобы браузер не взял из кэша старую версию после обновления игры. В конце пишет **манифест** — тот самый JSON с бандлами, который мы грузили через `Assets.init` с главы 5.

Мы запустили AssetPack на исходниках оригинала: из `raw-assets` (4,8 МБ) вышла папка `public/assets` на 3 МБ — 89 файлов: 14 webp и 14 png, по 11 ogg и mp3, 23 JSON (атласы, скелеты, манифест) и 8 атласов Spine.

Курс использует тот же конвейер: наш скрипт `scripts/build-assets.mjs` запускает AssetPack с теми же `pixiPipes`. Отличия три. Мы храним готовый результат в репозитории курса (оригинал — нет: `public/assets` у него в `.gitignore`, ресурсы собираются при каждом `npm start` и `npm run build`). Мы пишем три манифеста вместо одного — для глав без звука и без Spine. И мы исправляем картинку дракона: как вы помните из главы 14, AssetPack сжимает её как обычную, ломая premultiplied alpha.

## Загрузка в игре

Как игра пользуется манифестом — [`src/utils/assets.ts`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/utils/assets.ts):

```ts src/utils/assets.ts
export async function initAssets() {
    assetsManifest = await fetchAssetsManifest('assets/assets-manifest.json');
    await Assets.init({ manifest: assetsManifest, basePath: 'assets' });
    await loadBundles('preload');
    const allBundles = assetsManifest.bundles.map((item) => item.name);
    Assets.backgroundLoadBundle(allBundles);
}
```

Сначала — бандл `preload` для экрана загрузки, затем **все бандлы** в фоне (глава 5). А пока игрок в меню, `navigation.showScreen` для каждого экрана догружает его бандлы через `loadBundles`, который помнит, что уже загружено, — как наш `loadedBundles` из главы 11.

Обратите внимание: манифест здесь загружается вручную через `fetch`, а у нас — передачей адреса в `Assets.init({ manifest: MANIFEST_URL })`. Так тоже можно: `Assets.init` сам скачает JSON. Оригиналу объект манифеста нужен ещё и для проверки имён бандлов (`checkBundleExists`).

## Скрипты package.json

```json package.json
"prestart": "run-s assets",
"start": "vite --open",
"prebuild": "run-s clean format:check lint assets types",
"build": "vite build"
```

Префикс `pre` — соглашение npm: `prebuild` запускается сам перед `build`. Значит, `npm run build` по порядку: чистит старые результаты, проверяет форматирование (Prettier), ищет ошибки линтером (ESLint), собирает ресурсы, проверяет типы (`tsc` с `noEmit`: Vite сам типы **не проверяет**, только отбрасывает их) — и только потом собирает. Ошибка на любом шаге останавливает сборку. Это защита от выкладки сломанной игры.

## Проверьте себя

::: task
1. Почему Vite сам по себе не заметит ошибку типов, и что в оригинале это исправляет?
2. Художник добавил в `raw-assets/game{m}/game-atlas{tps}/` новую картинку `piece-bat.png`. Что нужно сделать, чтобы в игре сработал `Texture.from('piece-bat')`?
3. Зачем к именам собранных файлов добавляется хеш?
:::

::: hint Ответы
1. При сборке Vite лишь отбрасывает типы, не проверяя их, ради скорости. Поэтому `prebuild` запускает `types` — это `tsc` без вывода файлов.
2. Ничего, кроме пересборки ресурсов (`npm run assets` или просто `npm start`): картинка попадёт в атлас `game-atlas`, а её кадр будет называться по имени файла без расширения (`removeFileExtension: true`).
3. Чтобы после обновления игры браузер не взял старый файл из кэша: новое содержимое — новое имя.
:::

::: deep Под капотом: кто проверяет сборку ресурсов
В конвейере оригинала нет проверки, что ресурсы после AssetPack выглядят так же, как до. Именно так и проскочила белая кайма вокруг дракона: сжатый атлас по-прежнему обещал `pma:true`, а пиксели уже не были предумноженными. Мы нашли это только потому, что посмотрели на скриншот. Мораль общая для любых конвейеров: автоматическая обработка ресурсов — тоже код, и её результат нужно проверять — хотя бы глазами, а лучше скриптом (мы считали прозрачные пиксели с цветом).
:::
