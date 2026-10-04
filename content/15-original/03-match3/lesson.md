---
title: Архитектура Match3
files: [Board.ts, grid.ts, Piece.ts, GameScreen.ts, GameEffects.ts, main.ts, navigation.ts, Hud.ts, audio.ts, Cauldron.ts, Dragon.ts, HomeScreen.ts, ResultScreen.ts, LoadScreen.ts, PausePopup.ts, SettingsPopup.ts, MaskTransition.ts, pool.ts, stats.ts, userSettings.ts, Button.ts, Label.ts, countdown.ts, Background.ts, app.ts, manifest.ts]
focus: Board.ts
noSolution: true
api: []
---

Наш `Board.ts` — около 390 строк: в нём и вид поля, и ходы, и каскад, и спецфишки. Оригинал разложил то же самое по восьми файлам в папке `match3/`. Посмотрим, как, и решим, когда такое дробление окупается.

## Корень: класс Match3

[`src/match3/Match3.ts`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/match3/Match3.ts) — контейнер, который собирает **подсистемы**:

```ts src/match3/Match3.ts
constructor() {
    super();
    this.config = match3GetConfig();
    this.timer = new Match3Timer(this);
    this.stats = new Match3Stats(this);
    this.board = new Match3Board(this);
    this.actions = new Match3Actions(this);
    this.process = new Match3Process(this);
    this.special = new Match3Special(this);
}
```

| Подсистема | Отвечает за | У нас |
|---|---|---|
| `Match3Timer` | Время игры, `onTimesUp` | Поле `remaining` в `GameScreen` |
| `Match3Stats` | Очки, число совпадений и взрывов, оценка | `onMatch` в `GameScreen` + `getGrade` в `stats.ts` |
| `Match3Board` | Сетка, фишки, маска, создание и удаление фишек | `Board` |
| `Match3Actions` | Ходы игрока: свайп и нажатие | `Board.onSwipe`, `activateSpecial` |
| `Match3Process` | Каскад | `Board.process` |
| `Match3Special` | Спецфишки | `burnSpecials`, `getSpecialSpawns` в `Board` и `grid.ts` |

Каждая подсистема получает в конструкторе ссылку на корень (`this`) и через неё обращается к соседям: `this.match3.board.popPieces(...)`, `this.match3.process.start()`. Сам `Match3` почти ничего не делает — только собирает подсистемы и даёт общие методы: `setup`, `reset`, `startPlaying`, `pause`, `resume`.

Это **композиция**: большой объект состоит из маленьких, у каждого одна обязанность. Плюс — каждый файл короткий и понятный, и легко найти, где что лежит. Минус — подсистемы всё равно знают друг о друге через `match3`, и чтобы понять один ход, приходится прыгать по пяти файлам (вспомните сценарий из шага 1).

## Колбэки с объектами данных

О событиях игры `Match3` сообщает колбэками — как наш `Board`:

```ts src/match3/Match3.ts
public onMove?: (data: Match3OnMoveData) => void;
public onMatch?: (data: Match3OnMatchData) => void;
public onPop?: (data: Match3OnPopData) => void;
public onProcessStart?: () => void;
public onProcessComplete?: () => void;
public onTimesUp?: () => void;
```

Разница в аргументах. У нас `onMatch(matches, round)` — несколько параметров по порядку. У оригинала — **один объект** с описанным интерфейсом:

```ts src/match3/Match3.ts
export interface Match3OnPopData {
    type: Match3Type;
    piece: Match3Piece;
    combo: number;
    isSpecial: boolean;
    causedBySpecial: boolean;
}
```

Объект удобнее, когда данных много и их список растёт: добавить поле `causedBySpecial` можно, не трогая ни одного места, где колбэк вызывают или слушают. С позиционными параметрами пришлось бы переписать все вызовы. И сам комментарий в коде объясняет, почему колбэки, а не события `EventEmitter`: «All game events are set as plain callbacks for simplicity» — у каждого события один слушатель, экран игры, и большего не нужно. Мы тоже пользуемся колбэками с главы 6 — с `onTap` и `onSwipe` у фишки.

## Чистые функции: Match3Utility

[`Match3Utility.ts`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/match3/Match3Utility.ts) — 419 строк функций без классов и без PixiJS: `match3CreateGrid`, `match3GetMatches`, `match3ApplyGravity`, `match3FillUp`, `match3SwapPieces`… Это наш `grid.ts`, и разделение то же, что мы сделали в главе 7: **модель** (числа в массиве) отдельно от **вида** (спрайты). Такие функции легко проверить без экрана — мы так и делали в автотестах главы 7.

## Конфигурация и режимы

[`Match3Config.ts`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/match3/Match3Config.ts) хранит настройки по умолчанию — 9 × 7, клетка 50, 60 секунд — и **режимы** (`test`, `easy`, `normal`, `hard`): списки текстур зелий, от трёх до шести. Режим влияет только на число видов зелий: чем их больше, тем реже складываются совпадения.

Тип фишки в оригинале — это **номер в списке текстур**: `match3GetBlocks(mode)` склеивает зелья режима и четыре спецфишки, и тип равен индексу плюс 1. Поэтому тип спецфишки «бомба» (`special-blast`, первая из спецфишек) в режиме `normal` — 6, а в `hard` — 7. У нас типы спецфишек — константы 7 и 8. Подход оригинала гибче (режимы без переписывания кода), наш — проще читать.

## Спецфишки как обработчики

Самое интересное устройство — [`Match3Special.ts`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/match3/Match3Special.ts):

```ts src/match3/Match3Special.ts
const availableSpecials: Record<string, Match3SpecialHandlerConstructor> = {
    'special-row': Match3SpecialRow,
    'special-column': Match3SpecialColumn,
    'special-colour': Match3SpecialColour,
    'special-blast': Match3SpecialBlast,
};
```

Каждая спецфишка — отдельный класс в папке `specials/` с двумя методами по общему интерфейсу:

- `process(matches)` — посмотреть на совпадения и, если подходит, поставить спецфишку. Например, `Match3SpecialRow` ищет **вертикальные** совпадения ровно из четырёх и ставит полосу в середину;
- `trigger(type, position)` — если взорвалась фишка этого типа, сжечь свою область.

`Match3Special` просто проходит по всем обработчикам. Добавить пятую спецфишку — значит написать новый класс и строку в `availableSpecials`, не трогая каскад. Это паттерн **«стратегия»**: разные правила за одним интерфейсом. У нас обе спецфишки — ветки `if` в `getSpecialSpawns` и `getSpecialArea`: для двух это читаемее, для десяти было бы мучением.

Заметьте и разницу в правилах: у нас полоса появляется от любой четвёрки и длиннее, в любом направлении, а в оригинале — только от вертикальной четвёрки (горизонтальная даёт `special-column`).

## Очки и оценка

[`Match3Stats.ts`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/match3/Match3Stats.ts) считает очки иначе, чем мы: 1 очко за фишку (3 — если её сжёг взрыв), плюс за каждое совпадение — его длина и ещё `число совпадений × номер раунда`. А оценка в звёздах — по **очкам в секунду**: больше 16 — три звезды, больше 8 — две, больше 0,8 — одна. У нас оценка по порогам суммы очков (200, 600, 1200). Подход оригинала справедлив и для игр разной длины: `?duration=30` не испортит оценку.

## Проверьте себя

::: task
1. Подсистема `Match3Actions` хочет запустить каскад. Как она добирается до `Match3Process`?
2. Что нужно изменить в оригинале, чтобы добавить спецфишку «крест» (сжигает ряд и столбец)? А у нас?
3. Почему `match3GetMatches` можно проверять без браузера, а `Match3Board.popPiece` — нельзя?
:::

::: hint Ответы
1. Через ссылку на корень: `this.match3.process.start()`.
2. В оригинале — новый класс с `process` и `trigger` в `specials/`, строка в `availableSpecials` и текстура в `blocks.special` конфигурации. У нас — новый тип в `grid.ts`, ветки в `getSpecialSpawns` и `getSpecialArea`, текстура в `TEXTURE_NAMES`.
3. `match3GetMatches` — чистая функция над массивом чисел. `popPiece` создаёт анимации GSAP, меняет спрайты и вызывает колбэки — ей нужны PixiJS и время.
:::
