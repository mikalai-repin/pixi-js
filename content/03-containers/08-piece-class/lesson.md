---
title: Свой класс фишки
files: [main.ts, Piece.ts]
focus: Piece.ts
startFrom: custom
api: [class extends Container, Texture.from]
---

У настоящей фишки больше одного спрайта. В Puzzling Potions у неё есть сама картинка зелья, светящаяся подложка-подсветка под ней (для спецфишек и выбранной фишки) и невидимая зона для кликов. Собирать всё это в цикле поля — путь к каше. Сделаем фишку отдельным классом, как в оригинале.

## Наследуемся от Container

Самый естественный способ сделать «составной» объект в PixiJS — **унаследоваться от `Container`**. Класс-наследник и есть контейнер: его можно добавить на сцену, двигать, масштабировать. А внутри он собирает своих детей.

В редакторе появилась вкладка `Piece.ts` с заготовкой класса. Заполним её:

```ts Piece.ts
import { Container, Sprite, Texture } from 'pixi.js';

/** Путь к текстуре подсветки. Она должна быть загружена до создания первой фишки */
export const HIGHLIGHT_URL = '/assets/game/highlight.png';

/**
 * Фишка на поле: картинка зелья и подсветка под ней.
 * Упрощённая версия Match3Piece из Puzzling Potions.
 */
export class Piece extends Container {
  private readonly highlight: Sprite;
  private readonly image: Sprite;

  constructor(texture: Texture, size: number) {
    super();

    this.highlight = new Sprite(Texture.from(HIGHLIGHT_URL));
    this.highlight.anchor.set(0.5);
    this.highlight.setSize(size);
    this.highlight.alpha = 0.5;
    this.highlight.visible = false;
    this.addChild(this.highlight);

    this.image = new Sprite(texture);
    this.image.anchor.set(0.5);
    this.image.setSize(size - 4);
    this.addChild(this.image);
  }

  /** Включает или выключает подсветку */
  setHighlight(enabled: boolean) {
    this.highlight.visible = enabled;
  }
}
```

Что здесь важно:

- **`super()` первым делом.** Конструктор `Container` должен отработать раньше, чем мы начнём добавлять детей.
- **Порядок детей — порядок слоёв.** Подсветка добавлена первой, поэтому она под картинкой.
- **Спрайты — `private`.** Снаружи фишкой управляют через методы (`setHighlight`), а не лезут внутрь. Если позже подсветка станет анимированной, менять придётся только класс.
- **Размер задаётся детям, а не фишке.** Сама фишка остаётся с масштабом `1`. Значит, `piece.scale.set(1.3)` — это «на 30% больше обычного», без вычислений от размера текстуры.

## `Texture.from` и кэш

Текстура зелья передаётся в конструктор, а подсветку класс берёт сам через `Texture.from(HIGHLIGHT_URL)`. `Texture.from` не загружает файл: он берёт **уже загруженную** текстуру из кэша `Assets`. Поэтому в `main.ts` подсветку нужно загрузить вместе с зельями заранее. Если забыть, PixiJS выведет предупреждение, а подсветка окажется пустой.

## Используем класс в `main.ts`

В `main.ts` нужно три изменения. Импортируйте класс и загрузите подсветку вместе с зельями:

```ts main.ts
import { HIGHLIGHT_URL, Piece } from './Piece';
```

```ts main.ts
const textures = await Assets.load<Texture>([...PIECES.map(pieceUrl), HIGHLIGHT_URL]);
```

Создавайте фишки через класс. Строки с `anchor` и `setSize` из цикла уходят: этим теперь занимается `Piece`:

```ts main.ts
const pieces: Piece[] = [];
```

```ts main.ts
    const piece = new Piece(textures[pieceUrl(name)], TILE_SIZE);
    piece.label = `${name} [${row}, ${column}]`;
    piece.position.copyFrom(getViewPosition(row, column));
```

И подсветите выбранную фишку. Масштаб теперь задаётся просто числом:

```ts main.ts
const selected = pieces[4 * COLUMNS + 3];
selected.setHighlight(true);
selected.scale.set(1.3);
board.addChild(selected);
```

::: task
Напишите класс `Piece` в `Piece.ts` и перейдите на него в `main.ts`.
:::

## Что получилось

Поле выглядит как раньше, но у центральной фишки появилось мягкое свечение. Дерево сцены стало глубже:

```
stage
└── board
    ├── background
    ├── dragon [0, 0]      ← Piece (Container)
    │   ├── Sprite         ← highlight
    │   └── Sprite         ← image
    └── …
```

Попробуйте подсветить другую фишку или все фишки первой строки.

::: deep Под капотом: наследование или композиция?
Вместо `class Piece extends Container` можно было бы написать класс, который **хранит** контейнер в поле: `this.view = new Container()`. Это называется композицией. Оба подхода встречаются, но в экосистеме PixiJS принято наследование. Его используют сам PixiJS (`Sprite`, `Text`, `Graphics` — наследники `Container`), `@pixi/ui` и оригинальная игра: экраны, кнопки, фишки — всё это наследники `Container`.

Плюс наследования: фишку можно класть в любой контейнер и передавать в любой метод PixiJS без обёрток. Минус: у класса появляются сотни унаследованных свойств, и легко случайно перекрыть какое-нибудь из них своим полем. Поле `width` перекроет встроенный размер, `position` — позицию. Даже `name` занято: в v8 это устаревший псевдоним `label`, который выводит предупреждение. В оригинальном `Match3Piece` есть поле `name`, и работает оно только благодаря тонкостям компиляции полей классов. В своём коде лучше выбирать имена, которых нет у `Container`: `type`, `pieceName`, `row`, `column`.
:::
