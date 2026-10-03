---
title: Свой компонент
files: [Button.ts, main.ts, Board.ts, Label.ts, countdown.ts, Piece.ts, tween.ts, Background.ts, grid.ts, LoadScreen.ts, manifest.ts]
focus: Button.ts
startFrom: custom
api: [Button, onPress]
---

Кнопка «Играть» работает, но её код занимает в `main.ts` шестьдесят строк: три текстуры, два флага, пять обработчиков, функция обновления. А кнопок в игре будет много: пауза, настройки, «Ещё раз», «В меню». Копировать эти шестьдесят строк для каждой — путь к ошибкам. Пора сделать **компонент**: класс `Button`, который прячет всё это внутри и наружу показывает только то, что нужно.

В редакторе появилась вкладка `Button.ts` с заготовкой. Больше ничего не менялось.

## Что должен уметь компонент

Хороший компонент интерфейса похож на HTML-элемент: создаёшь, настраиваешь несколькими параметрами и подписываешься на событие. Как он устроен внутри, снаружи знать не нужно. Для кнопки:

```ts
const playButton = new Button({ text: 'Играть' });
playButton.onPress = () => startGame();

const pauseButton = new Button({ size: 'small', icon: 'icon-pause' });
```

- **параметры** — надпись или иконка, размер (`large` или `small`), ширина и высота;
- **событие** — колбэк `onPress`, как `onTap` и `onSwipe` у фишки в главе 6.

В оригинале таких классов два: `LargeButton` и `SmallButton`. Они отличаются только картинками и краями, поэтому у нас один класс с двумя наборами настроек.

## Настройки размеров

В заготовке уже есть объект `BUTTON_STYLES`: для каждого размера — имена трёх текстур, края для `NineSliceSprite`, размер по умолчанию и смещение содержимого. У маленькой кнопки бортик тоньше, поэтому и сдвиг меньше. Числа краёв маленькой кнопки, `16, 16, 16, 20`, тоже взяты из оригинала.

## Конструктор

```ts Button.ts
    this.style = BUTTON_STYLES[size];

    this.background = new NineSliceSprite({
      texture: Texture.from(this.style.textures.default),
      ...this.style.slices,
      width: width ?? this.style.width,
      height: height ?? this.style.height,
      anchor: 0.5,
    });
    this.addChild(this.background);

    if (icon) {
      const sprite = new Sprite(Texture.from(icon));
      sprite.anchor.set(0.5);
      this.content = sprite;
    } else {
      this.content = new Label(text, { fontSize: size === 'large' ? 36 : 22 });
    }
    this.addChild(this.content);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerover', () => this.setState(true, this.pressed));
    this.on('pointerout', () => this.setState(false, this.pressed));
    this.on('pointerdown', () => this.setState(this.hovered, true));
    this.on('pointerup', () => this.setState(this.hovered, false));
    this.on('pointerupoutside', () => this.setState(this.hovered, false));
    this.on('pointertap', () => this.onPress?.());
    this.updateView();
```

- **`width ?? this.style.width`** — размер можно не указывать, тогда берётся размер по умолчанию;
- **`content`** — надпись или иконка. Для кнопки это просто «то, что лежит сверху и сдвигается при нажатии», поэтому поле имеет тип `Container`: и `Label`, и `Sprite` — его наследники;
- **пять обработчиков** — те же, что были в `main.ts`, только теперь все они вызывают один метод `setState`;
- **`onPress?.()`** — кнопка не знает, что произойдёт при нажатии. Это решает тот, кто её создал.

И два метода:

```ts Button.ts
  private setState(hovered: boolean, pressed: boolean) {
    this.hovered = hovered;
    this.pressed = pressed;
    this.updateView();
  }

  /** Показывает текущее состояние: меняет текстуру фона и сдвигает содержимое */
  private updateView() {
    const { textures } = this.style;
    const name = this.pressed ? textures.pressed : this.hovered ? textures.hover : textures.default;
    this.background.texture = Texture.from(name);
    this.content.y = this.pressed ? this.style.pressedContentY : this.style.contentY;
  }
```

`Texture.from(name)` каждый раз ищет текстуру в кэше `Assets` по имени. Это поиск в словаре, он ничего не стоит.

::: task
Допишите класс `Button`: фон `NineSliceSprite`, надпись или иконка, события указателя, `setState` и `updateView`.
:::

## Используем компонент

В `main.ts` от шестидесяти строк кнопки «Играть» остаётся четыре:

```ts main.ts
const playButton = new Button({ text: 'Играть' });
playButton.label = 'playButton';
playButton.y = 60;
startPanel.addChild(playButton);
```

Ожидание нажатия — через `onPress`:

```ts main.ts
// Ждём нажатия: промис выполнится, когда кнопка вызовет onPress
await new Promise<void>((resolve) => (playButton.onPress = resolve));
```

А кнопка паузы наконец становится кнопкой, а не одиноким значком:

```ts main.ts
const pauseButton = new Button({ size: 'small', icon: 'icon-pause' });
pauseButton.label = 'pauseButton';
// Якорь фона в центре, поэтому отступаем от угла на половину кнопки
pauseButton.position.set(app.screen.width - 16 - 67 / 2, 16 + 53 / 2);
app.stage.addChild(pauseButton);

pauseButton.onPress = () => {
  board.locked = !board.locked;
  board.alpha = board.locked ? 0.5 : 1;
};
```

Импортируйте `Button` и уберите из импорта `pixi.js` в `main.ts` ставший ненужным `Sprite`.

## Что получилось

Внешне кнопка «Играть» не изменилась, а значок паузы в правом верхнем углу стал маленькой розовой кнопкой с тремя состояниями. Проверка подтвердила, что обе кнопки работают: «Играть» запускает отсчёт, а пауза блокирует и разблокирует поле.

## Эксперименты

- Добавьте в панель вторую кнопку, например `new Button({ text: 'Правила', width: 200, height: 70 })`, под кнопкой «Играть». Одна строка — и у неё уже есть все три состояния.
- Сделайте маленькую кнопку с текстом: `new Button({ size: 'small', text: '?' })`.
- Выведите в консоль `playButton.children.length`. Там два объекта: фон и надпись. Всё остальное — флаги и обработчики — данные класса, а не объекты сцены.

::: deep Под капотом: компоненты в оригинале
В оригинальной игре интерфейс целиком собран из таких компонентов: `LargeButton`, `SmallButton`, `RoundedBox`, `Label`, `GameTimer`, `GameScore`. У каждого есть конструктор с параметрами по умолчанию и, если нужно, методы `show` и `hide` с анимацией появления. Экран игры только создаёт компоненты, расставляет их и связывает колбэками.

Этот подход не про PixiJS, а про любой интерфейс: так же устроены компоненты в React или Vue. Разница в том, что в PixiJS нет готовой системы компонентов, и договорённости придумываете вы сами. Наши договорённости: параметры передаются объектом в конструкторе, события — колбэками `onЧтото`, а якорь у компонента в центре.
:::
