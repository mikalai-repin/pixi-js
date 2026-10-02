---
title: Манифест и бандлы
files: [main.ts, manifest.ts, Piece.ts]
focus: manifest.ts
startFrom: custom
api: [AssetsManifest, Assets.init, Assets.loadBundle]
---

Регистрация ресурсов прямо в `main.ts` — это смешение двух вещей: описания **того, что есть в игре**, и кода **самой игры**. В настоящих проектах список ресурсов выносят в отдельное описание — **манифест**. А сами ресурсы группируют в **бандлы**.

## Бандл

**Бандл** (bundle) — группа ресурсов, которая загружается целиком. Обычно один бандл соответствует одному экрану игры. В Puzzling Potions бандлов пять:

| Бандл | Что внутри | Когда нужен |
|---|---|---|
| `preload` | Логотип, фон, анимация котла | Сразу, для экрана загрузки |
| `home` | Логотип игры | Главное меню |
| `game` | Фишки, полка, подсветка | Сама игра |
| `common` | Кнопки, иконки, звуки | Везде |
| `result` | Фон экрана результатов | После раунда |

Зачем делить? Чтобы игрок **не ждал загрузки всего сразу**. Экран загрузки должен появиться за доли секунды, поэтому его бандл маленький. Пока игрок смотрит на главное меню, остальное догружается в фоне. В оригинале у каждого экрана даже есть статическое поле со списком нужных бандлов: `public static assetBundles = ['game', 'common']`.

## Манифест

**Манифест** (`AssetsManifest`) — объект со списком бандлов, а в каждом бандле — список ресурсов с псевдонимами и путями. Создайте его в новом файле `manifest.ts`:

```ts manifest.ts
import type { AssetsManifest } from 'pixi.js';

export const manifest: AssetsManifest = {
  bundles: [
    {
      name: 'game',
      assets: [
        { alias: 'piece-dragon', src: '/assets/game/piece-dragon.png' },
        { alias: 'piece-frog', src: '/assets/game/piece-frog.png' },
        { alias: 'piece-newt', src: '/assets/game/piece-newt.png' },
        { alias: 'piece-snake', src: '/assets/game/piece-snake.png' },
        { alias: 'piece-spider', src: '/assets/game/piece-spider.png' },
        { alias: 'piece-yeti', src: '/assets/game/piece-yeti.png' },
        { alias: 'highlight', src: '/assets/game/highlight.png' },
      ],
    },
    {
      name: 'result',
      assets: [{ alias: 'result-base', src: '/assets/result/result-base.png' }],
    },
  ],
};
```

Обратите внимание: `import type`. Мы импортируем из `pixi.js` только **тип**, а не код. TypeScript проверит структуру манифеста и подскажет поля, а в итоговый JavaScript этот импорт не попадёт.

Бандл `result` нам пока не нужен. Он здесь, чтобы было видно: манифест описывает **все** ресурсы игры, а загружаются из них только нужные.

## Загрузка по бандлам

В `main.ts` вместо `Assets.add` и `Assets.load` теперь две строки:

```ts main.ts
await Assets.init({ manifest });
await Assets.loadBundle('game');
```

- `Assets.init` регистрирует все ресурсы из манифеста. Это делается **один раз** при запуске игры, до любой загрузки.
- `Assets.loadBundle('game')` загружает все ресурсы бандла, и они становятся доступны по псевдонимам, как и раньше.

Не забудьте импортировать манифест: `import { manifest } from './manifest';`.

::: task
Опишите ресурсы в `manifest.ts` (бандлы `game` и `result`), инициализируйте `Assets` манифестом и загрузите бандл `game`.
:::

## Что получилось

Поле снова на месте. Код игры не знает ни путей, ни даже списка файлов: только имя бандла `game` и псевдонимы текстур.

Откройте в инструментах разработчика браузера вкладку **Network** и перезапустите код: загрузятся семь файлов бандла `game`, а `result-base.png` — нет. Ресурсы бандла, который не запросили, не скачиваются.

::: tip
`Assets.init` можно вызвать только один раз. Если нужно добавить ресурсы позже, например бандл для новой версии игры, для этого есть `Assets.addBundle(name, assets)`.
:::

::: deep Под капотом: манифест в JSON
Мы написали манифест на TypeScript, но обычно его **генерируют** инструментом сборки ресурсов и кладут рядом с ресурсами как `manifest.json`. Тогда `Assets.init` можно передать просто путь к нему: `Assets.init({ manifest: '/assets/manifest.json' })`. PixiJS сам скачает и разберёт файл. Ровно так мы сделаем в шаге 4, когда перейдём на ресурсы, собранные AssetPack.
:::
