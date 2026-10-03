---
title: Навигация
files: [navigation.ts, HomeScreen.ts, main.ts, GameScreen.ts, app.ts, Hud.ts, Board.ts, Piece.ts, Button.ts, SettingsPanel.ts, Label.ts, LoadScreen.ts, countdown.ts, Background.ts, grid.ts, manifest.ts]
focus: navigation.ts
startFrom: custom
api: [Navigation, showScreen, register, assetBundles, interactiveChildren]
---

В прошлом шаге `main.ts` вручную провёл экран игры по жизненному циклу: добавил на сцену, подписал на ресайз и тикер, показал. Для второго экрана пришлось бы повторить всё это, а потом ещё правильно убрать первый: спрятать, отписать от тикера, уничтожить. Эту работу делает **навигация** — объект, который знает, какой экран сейчас показан, и умеет сменить его на другой.

В редакторе появилась вкладка `HomeScreen.ts`: главное меню с логотипом игры, подзаголовком и кнопкой «Играть». Логотип `logo-game` лежит в бандле `home`, который мы до сих пор не загружали. А в `navigation.ts` под интерфейсом — заготовка навигации, которую нужно заменить настоящим классом.

## Класс экрана и его ресурсы

Навигация будет создавать экраны сама, поэтому ей нужен не объект экрана, а **класс**, и ещё — список бандлов, которые экран использует. Опишем это вторым интерфейсом:

```ts navigation.ts
/** Класс экрана: его можно создать без аргументов, а статическое поле перечисляет нужные бандлы */
export interface AppScreenConstructor {
  new (): AppScreen;
  assetBundles?: string[];
}
```

`new (): AppScreen` в интерфейсе означает «это можно вызвать через `new` без аргументов и получить экран». Бандлы экран объявляет статическим полем, как в оригинале:

```ts
export class HomeScreen extends Container implements AppScreen {
  static assetBundles = ['home', 'common'];
```

Так навигация знает, что загрузить, ещё до того как создаст экран. Добавьте это поле и в `GameScreen`: `static assetBundles = ['game', 'common']`.

## Экраны по именам

Как кнопка «Играть» в меню скажет навигации, какой экран открыть? Проще всего — передать класс: `navigation.showScreen(GameScreen)`. Так делает оригинал. Но тогда меню импортирует игру. Через пару шагов игра будет импортировать экран результата, а результат — и игру («Ещё раз»), и меню. Получится **цикл импортов**: меню → игра → результат → меню.

Сборщики вроде Vite такие циклы переносят, хотя это и признак того, что модули слишком много знают друг о друге. А превью нашего курса собирает модули без сборщика и циклы не поддерживает вовсе: вместо игры в консоли будет ошибка «Циклический импорт».

Поэтому экраны будут знать друг друга только **по именам**. `main.ts` один раз запишет в навигацию, какой класс стоит за каким именем, а экраны будут просить `navigation.showScreen('game')`. Такой словарь называют **реестром**.

## Навигация

Замените заготовку в `navigation.ts`:

```ts navigation.ts
import { Assets, Container, Ticker } from 'pixi.js';
import { app } from './app';
```

```ts navigation.ts
class Navigation {
  /** Все экраны лежат в этом контейнере */
  readonly container = new Container();
  /** Текущий экран */
  currentScreen?: AppScreen;
  /** Экраны по именам: так экранам не нужно импортировать друг друга */
  private readonly screens = new Map<string, AppScreenConstructor>();
  private width = 0;
  private height = 0;

  /** Запоминает класс экрана под именем, по которому его потом можно показать */
  register(name: string, ctor: AppScreenConstructor) {
    this.screens.set(name, ctor);
  }

  /** Убирает текущий экран и показывает экран с этим именем */
  async showScreen(name: string) {
    const ctor = this.screens.get(name);
    if (!ctor) throw new Error(`Экран «${name}» не зарегистрирован`);
    // Пока идёт смена, старый экран не должен реагировать на нажатия
    if (this.currentScreen) this.currentScreen.interactiveChildren = false;
    // Ресурсы нового экрана. Уже загруженные бандлы Assets второй раз не грузит
    if (ctor.assetBundles) await Assets.loadBundle(ctor.assetBundles);
    if (this.currentScreen) await this.removeScreen(this.currentScreen);
    this.currentScreen = new ctor();
    await this.addScreen(this.currentScreen);
  }

  /** Размер экрана изменился: передаём его текущему экрану */
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.currentScreen?.resize?.(width, height);
  }
```

Порядок в `showScreen` важен:

1. **заблокировать старый экран** — пока грузятся ресурсы и идёт анимация, игрок не должен нажать в нём что-нибудь ещё раз. Например, кнопку «Играть», запустив вторую смену экрана;
2. **загрузить ресурсы** нового экрана. Пока они грузятся, старый экран ещё виден. Повторный `loadBundle` уже загруженного бандла ничего не скачивает: мы проверили, второй вызов завершился мгновенно и без запросов к серверу;
3. **убрать старый**, затем **создать и показать новый**. Создаём новый экран только после загрузки: его конструктор берёт текстуры из кэша, и их там уже должно быть.

Жизненный цикл из прошлого шага — в двух закрытых методах:

```ts navigation.ts
  /** Добавляет экран на сцену и проводит его по жизненному циклу до конца show */
  private async addScreen(screen: AppScreen) {
    if (!this.container.parent) app.stage.addChild(this.container);
    this.container.addChild(screen);
    screen.prepare?.();
    screen.resize?.(this.width, this.height);
    if (screen.update) app.ticker.add(screen.update, screen);
    if (screen.show) {
      // Во время анимации появления нажимать ничего нельзя
      screen.interactiveChildren = false;
      await screen.show();
      screen.interactiveChildren = true;
    }
  }

  /** Прячет экран, отключает его от тикера и уничтожает */
  private async removeScreen(screen: AppScreen) {
    screen.interactiveChildren = false;
    if (screen.hide) await screen.hide();
    if (screen.update) app.ticker.remove(screen.update, screen);
    screen.destroy({ children: true });
  }
}

/** Навигация одна на всю игру */
export const navigation = new Navigation();
```

- **контейнер навигации** добавляется на сцену при первом показе экрана. Фон добавлен раньше, поэтому все экраны рисуются поверх фона;
- **`app.ticker.add(screen.update, screen)`** — метод с контекстом, как в главе 8. Ровно с теми же аргументами он и отписывается;
- **`destroy({ children: true })`** — экран уничтожается вместе со всем содержимым. Новый экран каждый раз создаётся заново. Оригинал вместо этого хранит экраны в пуле и переиспользует, но об этом в главе 12.

## Подключаем

В `main.ts` вместо ручного запуска игры:

```ts main.ts
// --- Экраны: дальше всем управляет навигация ---
// Экраны регистрируются здесь, в одном месте: сами экраны друг друга не импортируют
navigation.register('home', HomeScreen);
navigation.register('game', GameScreen);
app.renderer.on('resize', (width, height) => navigation.resize(width, height));
navigation.resize(app.screen.width, app.screen.height);
await navigation.showScreen('home');
```

Кнопка «Играть» в `HomeScreen` уже вызывает `navigation.showScreen('game')`. Значит, стартовая панель в игре больше не нужна: удалите из `GameScreen` метод `waitForPlay`, поле `startPanel`, его строку в `resize` и вызов в `show`. Теперь `show` — это только отсчёт и начало игры.

::: task
Напишите класс `Navigation` с методами `register`, `showScreen`, `resize` и закрытыми `addScreen`, `removeScreen`. Добавьте экранам статическое поле `assetBundles`, зарегистрируйте меню и игру в `main.ts` и начните с меню. Уберите из игры стартовую панель.
:::

## Что получилось

После загрузки — главное меню: логотип Puzzling Potions, подзаголовок и кнопка «Играть». Нажмите её: меню исчезает, появляется поле, идёт отсчёт, начинается игра. Проверка подтвердила: игра открывается сразу после нажатия, а у тикера по-прежнему два слушателя — меню отписалось, игра подписалась.

## Эксперименты

- Поставьте в `showScreen` строку `await this.removeScreen(...)` перед загрузкой ресурсов. Если бандл ещё не загружен, между меню и игрой мелькнёт пустой фон. Верните порядок.
- Временно поменяйте в `HomeScreen` имя `'game'` на `'result'` и нажмите «Играть». В консоли появится ошибка «Экран «result» не зарегистрирован». Этот экран мы сделаем в шаге 4. Верните `'game'`.

::: deep Под капотом: interactiveChildren как замок
`interactiveChildren = false` у контейнера означает, что система событий не ищет цели внутри него: ни один потомок не получит ни нажатий, ни наведения. Сам контейнер при этом остаётся видимым. Это самый дешёвый способ «заморозить» экран: не нужно перебирать кнопки и выключать каждую.

Навигация закрывает экран этим замком в двух случаях: пока экран уходит и пока он появляется. Без этого игрок мог бы дважды нажать «Играть», пока грузятся ресурсы, и запустить две смены экрана подряд.
:::
