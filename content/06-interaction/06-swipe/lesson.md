---
title: Свайп
files: [main.ts, Piece.ts, LoadScreen.ts, manifest.ts]
focus: Piece.ts
api: [pointermove, pointerup]
---

В match-3 главное действие — **поменять местами** две соседние фишки. В Puzzling Potions это делается свайпом: игрок нажимает на фишку и ведёт палец или мышь в сторону соседа. Научим фишку распознавать свайп и сообщать его направление.

## Как распознать свайп

Свайп — это последовательность событий:

1. **`pointerdown`** — нажали на фишку. Запоминаем, где именно.
2. **`pointermove`** — указатель двигается. Считаем, насколько он сдвинулся от точки нажатия. Пока сдвиг меньше **порога**, это ещё не свайп, а дрожание пальца. Как только сдвиг превысил порог — это свайп, и по тому, куда сдвиг больше (по горизонтали или вертикали), определяем направление.
3. **`pointerup`** — отпустили. Если свайпа не было, значит, это было простое нажатие.

Ровно так устроен `Match3Piece` в оригинале, с порогом в 10 пикселей.

## Логика в классе фишки

Распознавание свайпа — это поведение фишки, поэтому код пишем в `Piece`. Наружу фишка сообщает только итог: «нажали» или «провели в такую-то сторону». Для этого у неё будут два колбэка: `onTap` и `onSwipe`. Это тот же подход, что в оригинале (`onTap` и `onMove`).

В начале `Piece.ts`, после импорта, объявите тип направления и порог:

```ts Piece.ts
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/** На сколько пикселей нужно сдвинуть указатель, чтобы это считалось свайпом */
const SWIPE_THRESHOLD = 10;
```

В класс добавьте поля: клетку, колбэки и состояние нажатия:

```ts Piece.ts
  /** Клетка, в которой стоит фишка */
  row = 0;
  column = 0;
  /** Вызывается при простом нажатии без свайпа */
  onTap?: (piece: Piece) => void;
  /** Вызывается, когда игрок провёл по фишке пальцем или мышью */
  onSwipe?: (piece: Piece, direction: SwipeDirection) => void;

  private pressing = false;
  private swiped = false;
  private pressX = 0;
  private pressY = 0;
```

В конце конструктора подпишите фишку на три события. Третий аргумент `on` — контекст: с ним `this` внутри методов будет указывать на фишку:

```ts Piece.ts
    this.on('pointerdown', this.onPointerDown, this);
    this.on('pointermove', this.onPointerMove, this);
    this.on('pointerup', this.onPointerUp, this);
```

И сами обработчики:

```ts Piece.ts
  private onPointerDown(event: FederatedPointerEvent) {
    this.pressing = true;
    this.swiped = false;
    this.pressX = event.global.x;
    this.pressY = event.global.y;
  }

  private onPointerMove(event: FederatedPointerEvent) {
    if (!this.pressing || this.swiped) return;
    const dx = event.global.x - this.pressX;
    const dy = event.global.y - this.pressY;
    // Пока указатель сдвинулся меньше порога, это ещё не свайп, а дрожание пальца
    if (Math.hypot(dx, dy) < SWIPE_THRESHOLD) return;

    this.swiped = true;
    const direction: SwipeDirection =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.onSwipe?.(this, direction);
  }

  private onPointerUp() {
    if (this.pressing && !this.swiped) this.onTap?.(this);
    this.pressing = false;
  }
```

Разберём неочевидное:

- координаты берём **глобальные** (`event.global`): фишка во время свайпа может увеличиваться и двигаться, а экранные координаты от этого не зависят;
- `Math.hypot(dx, dy)` — длина сдвига, то есть `√(dx² + dy²)`;
- флаг `swiped` нужен, чтобы один жест давал **один** свайп, а не новый на каждое движение мыши;
- направление: если сдвиг по горизонтали больше, чем по вертикали, — свайп влево или вправо, иначе — вверх или вниз. Вспомните, что Y растёт вниз: положительный `dy` означает «вниз».

Импортируйте `FederatedPointerEvent` из `pixi.js`.

## Подключаем в `main.ts`

Теперь нажатие приходит через `onTap`, поэтому подписку на `pointertap` в цикле замените:

```ts main.ts
    piece.row = row;
    piece.column = column;
    piece.onTap = select;
    piece.onSwipe = (swiped, direction) => {
      console.log(`Свайп ${direction} от клетки [${swiped.row}, ${swiped.column}]`);
    };
```

Подписки на наведение оставьте как есть. Функцию `getGridPosition` и вывод координат из шага 3 можно оставить: она понадобится в практикуме.

::: task
Научите `Piece` распознавать нажатие и свайп и выводите направление свайпа в консоль.
:::

## Что получилось

Нажмите на фишку и потяните мышь в сторону: в консоли появится, например, `Свайп right от клетки [4, 3]`. Простое нажатие без движения по-прежнему выбирает фишку.

А теперь попробуйте «сломать» свайп:

1. Нажмите на фишку в нижней части поля, **резко** уведите мышь за пределы поля и отпустите там.
2. Не нажимая кнопку, просто проведите мышью над той же фишкой.

В консоли появится свайп, хотя кнопка мыши не нажата! Фишка «залипла» в нажатом состоянии. Почему так и как это исправить — в следующем шаге.
