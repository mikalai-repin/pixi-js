---
title: 'Bubbo Bubbo: поле пузырей'
files: [BubbleGame.ts, bubbles.ts, Bubble.ts, main.ts, Label.ts, manifest.ts]
focus: bubbles.ts
startFrom: custom
remove: [Background.ts, Board.ts, Button.ts, Cauldron.ts, Dragon.ts, GameEffects.ts, GameScreen.ts, Goals.ts, GreyFilter.ts, HomeScreen.ts, Hud.ts, LevelsScreen.ts, LoadScreen.ts, MaskTransition.ts, PausePopup.ts, Piece.ts, ResultScreen.ts, SettingsPopup.ts, app.ts, audio.ts, countdown.ts, debug.ts, grid.ts, levels.ts, navigation.ts, pool.ts, stats.ts, userSettings.ts]
api: []
---

**Bubbo Bubbo** — вторая игра из репозитория [open-games](https://github.com/pixijs/open-games/tree/83b4676/bubbo-bubbo), откуда мы брали Puzzling Potions. Сверху висят цветные пузыри, внизу пушка. Игрок целится, стреляет пузырём, тот отскакивает от стен и прилипает к сетке. Три и больше одинаковых пузыря рядом лопаются, а всё, что после этого перестало держаться за потолок, падает вниз.

За пять шагов вы напишете свою версию — с нуля, без единого файла Puzzling Potions:

| Шаг | Что появится |
|---|---|
| 17.5 | Поле: шестиугольная сетка пузырей |
| 17.6 | Пушка, которая следит за указателем, и прицел с отскоками от стен |
| 17.7 | Выстрел: полёт и прилипание к сетке |
| 17.8 | Группы одного цвета лопаются, оторванные пузыри падают, счёт |
| 17.9 | Потолок опускается, победа, проигрыш и новая игра |

Мы упростим оригинал так же, как упрощали Puzzling Potions: один экран без меню и навигации, без усилений (бомба, заморозка времени) и без систем — вся игра в одном классе `BubbleGame`. Зато модель, как и в `grid.ts`, будет отдельно от вида.

## Что в старте

Это новый проект: файлы Puzzling Potions убраны. Остались `Label.ts` (надпись тем же шрифтом Nunito) и `manifest.ts` — теперь он указывает на ресурсы Bubbo Bubbo.

- **Ресурсы.** Мы собрали картинки оригинала AssetPack-ом в один атлас `bubbo-atlas` (пузыри четырёх цветов, тень и блик пузыря, части пушки, плитка фона, точка прицела) и добавили три коротких звука. Всё это — бандл `bubbo` в `/assets/bubbo/manifest.json`. Ресурсы оригинала распространяются под MIT, как и код.
- **`main.ts`** готов целиком. Приложение растягивается на всё окно (`resizeTo: window`), фон — `TilingSprite` с плиткой `background-tile`, тонированный в сиреневый. Игра нарисована в своих координатах — примерно 400 × 581 (`GAME_WIDTH` и `GAME_HEIGHT` из `BubbleGame.ts`) — и масштабируется «вписать» по центру, как поле Puzzling Potions в главе 10. Первой строкой импортируется `@pixi/sound`: только ради того, чтобы он зарегистрировал в `Assets` загрузчик звуков. Без этого загрузка манифеста со звуками сыплет предупреждениями «don't know how to parse it».
- **`bubbles.ts`** — модель: размеры, сетка из чисел (`0` — пусто, `1`–`4` — цвета) и функция `createBubbleGrid`. В `cellToPoint` — `// TODO`.
- **`Bubble.ts`** — заготовка вида пузыря.
- **`BubbleGame.ts`** — контейнер игры: подложка поля, красная линия проигрыша (заработает в 17.9), модель создаётся, а вида у неё пока нет.

## Шестиугольная сетка

В Puzzling Potions клетки квадратные: у фишки четыре соседа. Круги так плотно не уложить — между четырьмя кругами остаётся дыра. Пузыри укладывают **со сдвигом**: каждый второй ряд сдвинут на радиус, и пузырь ложится в ямку между двумя пузырями ряда над ним. Тогда у пузыря **шесть** соседей — как у ячейки пчелиных сот, поэтому сетку называют шестиугольной.

<div>
<svg viewBox="0 0 304 173" style="max-width:380px;width:100%;display:block;margin:1em auto" role="img" aria-label="Шестиугольная сетка: нечётный ряд сдвинут на радиус вправо, у пузыря (1,1) шесть соседей — (1,0), (1,2), (0,1), (0,2), (2,1), (2,2); расстояние между рядами — корень из трёх пополам, умноженный на диаметр" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" font-size="11"><circle cx="34.0" cy="54.0" r="19" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.5"/><text x="34.0" y="58.0" text-anchor="middle" fill="currentColor" font-size="10">0,0</text><circle cx="74.0" cy="54.0" r="19" fill="#e0a43a" fill-opacity="0.4" stroke="currentColor" stroke-opacity="0.5"/><text x="74.0" y="58.0" text-anchor="middle" fill="currentColor" font-size="10">0,1</text><circle cx="114.0" cy="54.0" r="19" fill="#e0a43a" fill-opacity="0.4" stroke="currentColor" stroke-opacity="0.5"/><text x="114.0" y="58.0" text-anchor="middle" fill="currentColor" font-size="10">0,2</text><circle cx="154.0" cy="54.0" r="19" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.5"/><text x="154.0" y="58.0" text-anchor="middle" fill="currentColor" font-size="10">0,3</text><circle cx="194.0" cy="54.0" r="19" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.5"/><text x="194.0" y="58.0" text-anchor="middle" fill="currentColor" font-size="10">0,4</text><circle cx="54.0" cy="88.6" r="19" fill="#e0a43a" fill-opacity="0.4" stroke="currentColor" stroke-opacity="0.5"/><text x="54.0" y="92.6" text-anchor="middle" fill="currentColor" font-size="10">1,0</text><circle cx="94.0" cy="88.6" r="19" fill="#e0a43a" fill-opacity="0.95" stroke="currentColor" stroke-opacity="0.5"/><text x="94.0" y="92.6" text-anchor="middle" fill="currentColor" font-size="10">1,1</text><circle cx="134.0" cy="88.6" r="19" fill="#e0a43a" fill-opacity="0.4" stroke="currentColor" stroke-opacity="0.5"/><text x="134.0" y="92.6" text-anchor="middle" fill="currentColor" font-size="10">1,2</text><circle cx="174.0" cy="88.6" r="19" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.5"/><text x="174.0" y="92.6" text-anchor="middle" fill="currentColor" font-size="10">1,3</text><circle cx="34.0" cy="123.3" r="19" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.5"/><text x="34.0" y="127.3" text-anchor="middle" fill="currentColor" font-size="10">2,0</text><circle cx="74.0" cy="123.3" r="19" fill="#e0a43a" fill-opacity="0.4" stroke="currentColor" stroke-opacity="0.5"/><text x="74.0" y="127.3" text-anchor="middle" fill="currentColor" font-size="10">2,1</text><circle cx="114.0" cy="123.3" r="19" fill="#e0a43a" fill-opacity="0.4" stroke="currentColor" stroke-opacity="0.5"/><text x="114.0" y="127.3" text-anchor="middle" fill="currentColor" font-size="10">2,2</text><circle cx="154.0" cy="123.3" r="19" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.5"/><text x="154.0" y="127.3" text-anchor="middle" fill="currentColor" font-size="10">2,3</text><circle cx="194.0" cy="123.3" r="19" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.5"/><text x="194.0" y="127.3" text-anchor="middle" fill="currentColor" font-size="10">2,4</text><path d="M220 54.0H228M224 54.0V88.6M220 88.6H228" stroke="currentColor" fill="none"/><text x="231" y="75.3" fill="currentColor">√3/2 · d</text><path d="M34.0 152.28203230275508V162.28203230275508M34.0 157.28203230275508H54.0M54.0 152.28203230275508V162.28203230275508" stroke="currentColor" fill="none"/><text x="60.0" y="161.28203230275508" fill="currentColor">сдвиг нечётного ряда — R</text><line x1="14" y1="28" x2="14" y2="147.3" stroke="currentColor" stroke-width="2" stroke-opacity="0.5"/><text x="18" y="22" fill="currentColor" fill-opacity="0.8">стена</text></svg>
</div>

Центры трёх касающихся пузырей образуют равносторонний треугольник со стороной `d` — диаметром. Высота такого треугольника — `d · √3 / 2 ≈ 0,87 d`: на столько ряды ближе друг к другу, чем пузыри в ряду. Это `ROW_HEIGHT` в `bubbles.ts`.

В нашем поле чётные ряды начинаются у левой стены и вмещают 10 пузырей, нечётные сдвинуты на радиус вправо — в них помещается 9. Поэтому `grid` — массив рядов **разной** длины: `columnsIn(row)` возвращает 10 или 9. Клетка задаётся тем же `{ row, column }`, что и в match-3.

## Задание

::: task
1. **`cellToPoint`.** Допишите в `bubbles.ts` функцию, которая возвращает центр клетки в координатах сетки (левый верхний угол сетки — точка (0, 0)).
2. **Пузырь.** В `Bubble.ts` пузырь — контейнер из двух спрайтов с якорем в центре: тень `bubble-shadow` размером 1,1 диаметра, чуть сдвинутая вниз и тонированная цветом пузыря (`BUBBLE_COLORS`), и поверх неё картинка пузыря (`BUBBLE_NAMES`) размером в диаметр.
3. **Поле.** В `BubbleGame.start` для каждой непустой клетки создайте пузырь в контейнере `field`, в центре клетки. В `views` — те же пузыри, `null` для пустых клеток: `views[row][column]` должно соответствовать `grid[row][column]`.
:::

## Подсказки

::: hint Подсказка 1: где центр клетки
Первый пузырь чётного ряда касается стены — его центр на радиус правее: `x = RADIUS + column × BUBBLE_SIZE`. Нечётный ряд сдвинут ещё на радиус. По вертикали первый ряд касается потолка: `y = RADIUS + row × ROW_HEIGHT`.
:::

::: hint Подсказка 2: тень и цвет
Тень в атласе белая, цвет ей даёт тонирование: `shadow.tint = BUBBLE_COLORS[type - 1]` (глава 2). Размер — `setSize`, сдвиг — `shadow.y` на несколько пикселей. Тип пузыря стоит запомнить в самом пузыре (`readonly type`): он понадобится, когда пузыри начнут лопаться.
:::

::: hint Подсказка 3: модель и вид одной строкой
`grid.map((cells, row) => cells.map((type, column) => …))` проходит все клетки и строит массив той же формы. Для пустой клетки возвращайте `null`, для остальных — новый пузырь. Создание пузыря удобно вынести в метод `createBubble(cell, type)`: он пригодится, когда пузыри начнут прилипать.
:::

## Проверьте

Под полосой счёта — пять рядов пузырей: 10, 9, 10, 9, 10 — всего 48. Крайние пузыри касаются стен подложки, нечётные ряды лежат в ямках чётных, и между пузырями нет щелей.

Автотест проверил это численно: в решении у 48 пузырей 115 пар соседей, и центры **каждой** пары ровно в 40 пикселях друг от друга — ни ближе, ни дальше. Крайние центры — на `x` = 20 и 380, то есть пузыри касаются стен поля шириной 400.

Поставьте в `bubbles.ts` `ROW_HEIGHT = BUBBLE_SIZE` — между рядами появятся просветы, ряды «разъедутся». А теперь верните `ROW_HEIGHT` и уберите сдвиг нечётных рядов: пузыри встанут столбиками и налезут друг на друга — без сдвига ряды должны стоять через полный диаметр.

## Связь с оригиналом

В Bubbo Bubbo в ряду 13 пузырей, а столбцы нумеруются **через один**: в чётном ряду `i` = 0, 2, 4…, в нечётном — 1, 3, 5…. Тогда `x = (i + 1) × R` для любого ряда (`Bubble.defaultX`), а соседи по ряду — `i ± 2`. Это другой популярный способ хранить такую сетку — «удвоенные координаты». А ряды в оригинале стоят через полный диаметр (`calculateBubbleY`): `screenTop + bubbleSize × j`, поэтому между рядами там видны просветы — сравните с вашим экспериментом выше.

Ряд в оригинале — объект `BubbleLine` с флагом «чётный». Он нужен, потому что новые ряды там появляются **сверху** и сдвигают остальные вниз: чётность каждого ряда меняется. Мы в 17.9 поступим проще — будем опускать потолок вместе со всей сеткой, и ряд 0 навсегда останется чётным.
