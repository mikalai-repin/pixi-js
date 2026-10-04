---
title: Карта проекта
files: [main.ts, navigation.ts, GameScreen.ts, Board.ts, grid.ts, Piece.ts, GameEffects.ts, Hud.ts, audio.ts, Cauldron.ts, Dragon.ts, HomeScreen.ts, ResultScreen.ts, LoadScreen.ts, PausePopup.ts, SettingsPopup.ts, MaskTransition.ts, pool.ts, stats.ts, userSettings.ts, Button.ts, Label.ts, countdown.ts, Background.ts, app.ts, manifest.ts]
focus: main.ts
noSolution: true
api: []
---

Учебная Puzzling Potions готова: меню, игра со звуком и эффектами, результат, дракон и котёл. Пора открыть **настоящий** код — оригинал из репозитория PixiJS [open-games](https://github.com/pixijs/open-games/tree/83b4676/puzzling-potions). Весь курс мы сверялись с ним в разделах «Связь с оригиналом». Теперь прочитаем его целиком и увидим, что там сделано так же, что иначе и почему.

В этой главе нет заданий в редакторе: справа ваша игра, а читать предстоит чужой код. Ссылки ведут на тот же коммит `83b4676`, с которым мы сверялись весь курс: код по ним не изменится. Откройте репозиторий в соседней вкладке.

## Как читать чужой проект

Незнакомый проект не читают от первого файла по алфавиту. Удобный порядок:

1. **Что это и как запустить**: `README.md` и `package.json` — зависимости и команды.
2. **Точка входа**: что выполняется первым.
3. **Скелет**: какие модули главные и как они связаны — не вникая в детали.
4. **Один сценарий от начала до конца**: например, «игрок сделал ход» — через все файлы, которые в нём участвуют.

Так и пойдём.

## package.json

```json package.json
"dependencies": {
  "@pixi/sound": "^6.0.1",
  "@esotericsoftware/spine-pixi-v8": "^4.2.95",
  "@pixi/ui": "^2.2.7",
  "gsap": "^3.13.0",
  "pixi.js": "^8.14.1"
}
```

Пять зависимостей — ровно те, что мы подключали по ходу курса: PixiJS, GSAP (глава 8), `@pixi/ui` (глава 10), `@pixi/sound` (глава 13), Spine (глава 14). У нас есть ещё шестая — pixi-filters (глава 12): в оригинале нет ни свечения, ни ударной волны.

Среди команд — `start` (`vite`), `build` (`vite build`), `assets` (`assetpack`), а также `lint`, `format` и `types`. Сборке посвящён следующий шаг.

## Точка входа

Первым выполняется [`src/main.ts`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/main.ts). Он вам почти дословно знаком:

```ts src/main.ts
async function init() {
    await app.init({
        resolution: Math.max(window.devicePixelRatio, 2),
        backgroundColor: 0xffffff,
    });
    document.body.appendChild(app.canvas);
    window.addEventListener('resize', resize);
    resize();
    document.addEventListener('visibilitychange', visibilityChange);
    await initAssets();
    navigation.setBackground(TiledBackground);
    await navigation.showScreen(LoadScreen);
    // ...затем HomeScreen или, по параметру адреса, сразу GameScreen / ResultScreen
}
```

Тот же `resolution` не меньше 2, та же функция `resize` с минимумом 375 × 700, та же реакция на `visibilitychange` (`sound.pauseAll` и `navigation.blur`). Наш `main.ts` писался по образцу этого.

Одна деталь, которой у нас нет: **параметры адреса для отладки**. Откройте игру с `?game` — и сразу попадёте на экран игры, минуя меню. `?duration=10` укоротит игру, `?mode=test` оставит три вида зелий, `?freeMoves` разрешит любые ходы. Их читает `GameScreen.prepare` через `getUrlParam` из `utils/getUrlParams.ts`. Это дешёвый и очень полезный приём: разработчик не тратит минуту на каждый прогон до экрана результата. В нашем превью адрес не поменять, поэтому мы укорачивали игру правкой `GAME_TIME` в автотестах.

## Скелет проекта

| Папка | Что внутри | Наш аналог |
|---|---|---|
| `match3/` | Игра «три в ряд» без экранов: модель, поле, ходы, каскад, спецфишки, очки, таймер | `grid.ts`, `Board.ts`, `Piece.ts` |
| `screens/` | `LoadScreen`, `HomeScreen`, `GameScreen`, `ResultScreen` | Те же четыре файла |
| `popups/` | `PausePopup`, `SettingsPopup`, `InfoPopup` | `PausePopup.ts`, `SettingsPopup.ts` |
| `ui/` | 28 компонентов: кнопки, котёл, дракон, облака, счёт, таймер, эффекты, переход-маска | `Button`, `Label`, `Hud`, `Cauldron`, `Dragon`, `GameEffects`, `MaskTransition`, `countdown`, `Background` |
| `utils/` | Навигация, загрузка ресурсов, пул, звук, хранилище, настройки, статистика, анимации, случайные числа, тексты | `navigation`, `pool`, `audio`, `userSettings`, `stats`, `manifest` |

Сравните размеры: в `src/` оригинала 6 967 строк в 65 файлах, у нас — 2 697 строк в 26 файлах. Разница не в том, что оригинал «лучше написан», а в том, сколько в нём всего: четыре спецфишки вместо двух, режимы сложности, полки с зельями, облака, экран информации, отдельные классы для каждой кнопки. И почти у каждого метода — комментарий в JSDoc.

## Сценарий: игрок сделал ход

Проследим один сценарий — свайп по зелью — по файлам оригинала:

1. `match3/Match3Piece.ts` — фишка ловит `pointerdown` и `pointermove`; когда палец ушёл дальше порога, вызывает колбэк `onMove(from, to)`.
2. `match3/Match3Board.ts` — при создании фишки подписал её `onMove` на `actions.actionMove`.
3. `match3/Match3Actions.ts` — проверяет ход на копии сетки, сообщает `match3.onMove`, анимирует обмен, при неудаче — обратно, иначе запускает `process.start()`.
4. `match3/Match3Process.ts` — раунды каскада: очки, спецфишки, совпадения, гравитация, досыпание.
5. `screens/GameScreen.ts` — получает `onMatch`, `onPop` и передаёт их `GameEffects`.
6. `ui/GameEffects.ts` — звук, тряска, полёт зелья в котёл.

У нас тот же путь короче: `Piece` → `Board.onSwipe` → `Board.process` → колбэки → `GameScreen` и `GameEffects`. Почему оригиналу понадобилось столько классов — в шаге 3.

## Проверьте себя

::: task
Найдите ответы в коде оригинала по ссылкам выше.

1. Каким параметром адреса открыть игру сразу на экране результата?
2. В какой папке оригинала лежит `earthquake`, которую мы писали в главе 12?
3. Сколько видов зелий в режиме `normal`? А сколько у нас?
:::

::: hint Ответы
1. `?result` — это обрабатывает `main.ts`.
2. В `utils/animation.ts`, вместе с остальными помощниками для GSAP.
3. В `match3/Match3Config.ts`: в режиме `normal` пять зелий (без йети), в `hard` — шесть. У нас всегда шесть, то есть мы всё время играем в «трудном» режиме.
:::
