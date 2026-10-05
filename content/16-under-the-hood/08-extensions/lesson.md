---
title: Расширения
files: [debug.ts, main.ts, GreyFilter.ts, GameScreen.ts, Board.ts, Piece.ts, GameEffects.ts, Hud.ts, Cauldron.ts, Dragon.ts, app.ts, navigation.ts, HomeScreen.ts, ResultScreen.ts, LoadScreen.ts, PausePopup.ts, SettingsPopup.ts, MaskTransition.ts, pool.ts, audio.ts, stats.ts, userSettings.ts, Button.ts, Label.ts, countdown.ts, Background.ts, grid.ts, manifest.ts]
focus: debug.ts
startFrom: custom
api: [extensions.add, ExtensionType, System, renderer.runners, contextChange, prerender, postrender]
---

Наша панель статистики работает, но устроена она «снаружи»: функция `showStats` хватает контекст WebGL, подменяет в нём методы и встраивается в тикер. PixiJS о ней ничего не знает. А у PixiJS есть штатный способ добавлять в рендерер свои части — тот самый, которым он собирает сам себя. В этом шаге счётчик станет настоящей **системой рендерера**.

## Реестр расширений

В шаге 16.1 мы видели, что рендерер состоит из систем и конвейеров. Откуда он их берёт? Из общего реестра **`extensions`**. Каждая часть PixiJS — система, конвейер, загрузчик ресурсов, плагин приложения — это класс со статическим полем `extension`, где записаны его **тип** и **имя**. Модуль регистрирует его вызовом `extensions.add(…)`, а потребитель забирает все расширения своего типа.

Типы, которые встречаются чаще всего:

| Тип (`ExtensionType`) | Что это | Примеры |
|---|---|---|
| `Application` | Плагин приложения: добавляет приложению возможности при `init` | `ResizePlugin` (`resizeTo`), `TickerPlugin` (`app.ticker`), `CullerPlugin` |
| `WebGLSystem`, `WebGPUSystem`, `CanvasSystem` | Система рендерера | `renderer.texture`, `renderer.filter`, `renderer.events` |
| `WebGLPipes`, `WebGPUPipes`, `CanvasPipes` | Конвейер: как рисовать вид объектов | `sprite`, `graphics`, `batch` |
| `LoadParser` | Загрузчик ресурсов для `Assets` | картинки, шрифты, JSON; загрузчики Spine из главы 14 |
| `Batcher` | Свой батчер | батчер по умолчанию |
| `BlendMode` | Режим смешивания через фильтр | `pixi.js/advanced-blend-modes` из главы 12 |

Мы уже пользовались этим механизмом, не зная о нём: в главе 14 импорт runtime Spine зарегистрировал загрузчики скелета и атласа и конвейер для `Spine`, а в шаге 16.4 мы сами добавили `CullerPlugin`.

## Система

**Система** — класс, который рендерер создаёт сам, передав ему себя в конструктор, и кладёт в свойство с именем из описания расширения. А дальше рендерер **вызывает её методы** на этапах своей работы. Этапы называются **runners**; у рендерера PixiJS 8 их одиннадцать: `init`, `contextChange`, `prerender`, `renderStart`, `render`, `renderEnd`, `postrender`, `resolutionChange`, `update`, `resetState`, `destroy`. Системе достаточно объявить метод с таким именем — и рендерер начнёт его вызывать. Нам нужны три:

- **`contextChange(gl)`** — контекст WebGL готов. Здесь мы подменим методы рисования;
- **`prerender()`** — перед каждым вызовом `renderer.render`: обнулить счётчик, засечь время;
- **`postrender()`** — после: записать итоги кадра.

В старте `debug.ts` переписан: в нём заготовка класса `StatsSystem`, а `showStats` теперь только читает его поля и показывает на панели. Описание расширения уже на месте:

```ts debug.ts
export class StatsSystem implements System {
  /** Описание расширения: какого оно типа (система WebGL) и под каким именем появится в рендерере */
  static extension = {
    type: [ExtensionType.WebGLSystem],
    name: 'stats',
  } as const;
```

Тип — только `WebGLSystem`: мы считаем вызовы WebGL, в WebGPU и Canvas такой системы не будет. Имя `stats` — значит, система окажется в `app.renderer.stats`. Допишем методы:

```ts debug.ts
  contextChange(gl: WebGL2RenderingContext) {
    // После потери и восстановления контекста PixiJS вызывает contextChange снова, с тем же объектом gl.
    // Подменённые методы уже на месте: подмени мы их второй раз, каждый вызов считался бы дважды
    if (gl === this.gl) return;
    this.gl = gl;
    const drawElements = gl.drawElements.bind(gl);
    gl.drawElements = (mode, count, type, offset) => {
      this.counter++;
      drawElements(mode, count, type, offset);
    };
    // …то же для drawArrays
  }

  /** Перед каждой отрисовкой — через renderer.render рисует и приложение, и любой наш код */
  prerender() {
    this.counter = 0;
    this.start = performance.now();
  }

  /** После отрисовки: итоги кадра */
  postrender() {
    this.drawCalls = this.counter;
    this.renderTime = performance.now() - this.start;
  }
```

Про проверку `gl === this.gl`. Браузер может отобрать у страницы контекст WebGL — например, когда видеокарте не хватает памяти или вкладка долго была в фоне на телефоне. Это называется **потерей контекста**. PixiJS умеет её пережить: дождаться восстановления, заново загрузить текстуры и снова вызвать `contextChange`. Объект `gl` при этом прежний, и наши подменённые методы в нём остались. Без проверки мы обернули бы их второй раз. Мы проверили: без неё после потери и восстановления контекста панель показывала 4 вызова вместо 2.

Осталось зарегистрировать систему:

```ts debug.ts
// Регистрируем систему до создания рендерера: при init он соберёт все системы своего типа
extensions.add(StatsSystem);
```

Почему это сработает раньше `app.init`? Модуль `debug.ts` импортирован в `main.ts`, а импортированные модули выполняются до кода самого `main.ts`. Строка `extensions.add` отработает раньше, чем `await app.init(...)`.

::: task
1. Допишите в `StatsSystem` методы `contextChange`, `prerender` и `postrender`.
2. Зарегистрируйте систему через `extensions.add`.
:::

## Что получилось

Панель выглядит так же, как раньше, но устроена иначе. Наберите в консоли `__PIXI_APP__.renderer.stats` — это наш объект, живущий внутри рендерера наравне со встроенными системами. Всего систем у рендерера WebGL в нашей игре 33: `texture`, `filter`, `events`, `gc`, `extract`… и `stats`.

Как `showStats` его находит:

```ts debug.ts
  // Система появляется только у рендерера WebGL
  const stats = (app.renderer as WebGLRenderer & { stats?: StatsSystem }).stats;
```

TypeScript не знает, что у рендерера появилось свойство `stats`, поэтому мы говорим ему об этом приведением типа. Свойство необязательное: при `preference: 'webgpu'` его не будет.

## Эксперименты

- Закомментируйте `extensions.add(StatsSystem)`. Панель напишет: «Статистики нет: рендерер не WebGL или StatsSystem не зарегистрирована».
- Перенесите регистрацию в `main.ts`, **после** `app.init` (не забудьте импортировать `extensions` и `StatsSystem`). Статистики не будет: `'stats' in app.renderer` вернёт `false`. Рендерер собирает системы один раз, при создании.
- Потеряйте контекст по-настоящему. В консоли выполните:
  ```ts
  const lose = __PIXI_APP__.renderer.gl.getExtension('WEBGL_lose_context');
  lose.loseContext();
  ```
  Картинка исчезнет. Затем `lose.restoreContext()` — PixiJS восстановит текстуры, игра продолжится, а панель покажет прежнее число вызовов. Уберите проверку `gl === this.gl` и повторите: число удвоится.

## Связь с оригиналом

Puzzling Potions расширений не пишет, но пользуется ими: `resizeTo` работает через `ResizePlugin`, `app.ticker` — через `TickerPlugin`, а `@pixi/sound` регистрирует в `Assets` загрузчик звуков — поэтому звуки из манифеста грузятся тем же `Assets.loadBundle`, что и картинки.

::: deep Под капотом: типы для своих систем
В настоящем проекте вместо приведения типа рендерер дополняют через глобальное пространство имён `PixiMixins` — так делает сама PixiJS:

```ts
declare global {
  namespace PixiMixins {
    interface WebGLSystems {
      stats: StatsSystem;
    }
  }
}
```

После этого `renderer.stats` у WebGL-рендерера типизирован. Мы так не делаем по причине, связанной с самим курсом: все шаги проверяются TypeScript одной программой, и одинаковые дополнения из разных шагов конфликтовали бы друг с другом.

У расширения можно указать и **приоритет**: `extension = { type, name, priority }`. Чем он выше, тем раньше система создаётся и тем раньше получает вызовы. Встроенные системы почти все с приоритетом 0, поэтому порядок между ними — это порядок регистрации. Убрать расширение можно вызовом `extensions.remove`.
:::
