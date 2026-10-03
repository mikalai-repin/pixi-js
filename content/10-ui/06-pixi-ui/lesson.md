---
title: '@pixi/ui'
files: [SettingsPanel.ts, main.ts, Button.ts, Board.ts, Label.ts, countdown.ts, Piece.ts, tween.ts, Background.ts, grid.ts, LoadScreen.ts, manifest.ts]
focus: SettingsPanel.ts
startFrom: custom
api: [FancyButton, Slider, CheckBox, 'onPress.connect', onUpdate, onCheck]
---

Свою кнопку мы написали за полсотни строк. А слайдер? Ручку нужно тянуть мышью и пальцем, ограничивать краями, переводить положение в значение с шагом, рисовать заливку до ручки. Флажок, переключатель, прокручиваемый список, поле ввода — каждый из этих компонентов можно написать самому, но это сотни строк и десятки краевых случаев. Для этого есть официальная библиотека компонентов PixiJS — **`@pixi/ui`**. Ею пользуется и оригинальная игра.

## Что в ней есть

`@pixi/ui` — отдельный пакет (`npm install @pixi/ui`). В превью он уже подключён, как GSAP. Главные компоненты:

| Компонент | Что делает | В оригинале |
|---|---|---|
| `FancyButton` | Кнопка с видами для состояний, надписью, иконкой и анимациями | `LargeButton`, `SmallButton`, `ImageButton` |
| `Slider` | Слайдер со значением от `min` до `max` | `VolumeSlider` в настройках |
| `CheckBox` | Флажок с подписью | Переключатель режимов `ModeSwitcher` |
| `ProgressBar` | Полоска прогресса | — |
| `ScrollBox`, `List` | Прокручиваемый и обычный список | — |
| `Input` | Поле ввода текста | — |

Все они — наследники `Container`: их добавляют на сцену, двигают и масштабируют как обычные объекты.

В этом шаге сделаем панель настроек с кнопкой «Готово», слайдером скорости игры и флажком подсказки. Слайдер скорости заменит отладочную клавишу `3` из главы 8, поэтому обработчик клавиш из `main.ts` можно удалить.

В редакторе появилась вкладка `SettingsPanel.ts`. В ней уже есть фон панели, заголовок и кнопка «Готово» на `FancyButton`, а также функция `createIconButton` для маленьких кнопок с иконкой. Разберём их, а слайдер и флажок допишете сами.

## FancyButton

```ts SettingsPanel.ts
function createButton(text: string) {
  const view = (name: string) => new NineSliceSprite({ texture: Texture.from(name), ...BUTTON_SLICES, width: 200, height: 84 });
  return new FancyButton({
    defaultView: view('button-large'),
    hoverView: view('button-large-hover'),
    pressedView: view('button-large-press'),
    text: new Label(text, { fontSize: 30 }),
    textOffset: { y: -8, pressed: { y: -3 } },
    anchor: 0.5,
    animations: {
      hover: { props: { scale: { x: 1.05, y: 1.05 } }, duration: 100 },
      pressed: { props: { scale: { x: 0.95, y: 0.95 } }, duration: 100 },
    },
  });
}
```

Сравните с нашим `Button`:

- **виды состояний** — `defaultView`, `hoverView`, `pressedView` и ещё `disabledView` для выключенной кнопки. Видом может быть любой объект: спрайт, `NineSliceSprite`, `Graphics`. FancyButton сама показывает нужный и прячет остальные — ровно то, что делал наш `updateView`;
- **`textOffset`** — сдвиг надписи, общий и отдельно для состояний. Это наши `contentY` и `pressedContentY`;
- **`animations`** — плавный переход размера или положения при смене состояния. Здесь кнопка чуть увеличивается под указателем и сжимается при нажатии. Этого наш `Button` не умел;
- **`anchor`** — точка привязки всей кнопки.

О нажатии FancyButton сообщает не колбэком, а **сигналом** — объектом, на который можно подписать сколько угодно функций:

```ts SettingsPanel.ts
done.onPress.connect(() => this.onClose?.());
```

`connect` подписывает, а возвращённый объект соединения умеет `disconnect()`. Сигналы есть у всех компонентов `@pixi/ui`: `onPress`, `onDown`, `onUp`, `onHover`, `onOut` у кнопок, `onUpdate` и `onChange` у слайдера, `onCheck` у флажка.

## Слайдер

Слайдер собирается из трёх объектов: **фон** (`bg`), **заливка** (`fill`) — она видна от левого края до ручки, и **ручка** (`slider`). Вместо `// TODO` в конструкторе панели добавьте:

```ts SettingsPanel.ts
    // Слайдер: фон, заливка до текущего значения и ручка — любые объекты отображения
    const speedLabel = new Label('Скорость: 100%', { fontSize: 20 });
    speedLabel.y = -70;
    const speed = new Slider({
      bg: new Graphics().roundRect(0, 0, 240, 20, 10).fill(0xcf4b00),
      fill: new Graphics().roundRect(0, 0, 240, 20, 10).fill(0xff8221),
      slider: new Graphics().circle(0, 0, 16).fill(0xcf4b00).circle(0, 0, 12).fill(0xffd579),
      min: 25,
      max: 100,
      step: 5,
      value: 100,
    });
    speed.position.set(-120, -45);
    // onUpdate — во время перетаскивания, onChange — когда отпустили
    speed.onUpdate.connect((value) => {
      speedLabel.text = `Скорость: ${value}%`;
      this.onSpeedChange?.(value / 100);
    });
    this.addChild(speedLabel, speed);
```

- **значения** от 25 до 100 с шагом 5 — это проценты скорости. В колбэк отдаём долю: `value / 100`;
- **`onUpdate`** срабатывает при каждом изменении значения, в том числе пока ручку тянут. **`onChange`** — один раз, когда ручку отпустили. Для скорости нужен мгновенный отклик, поэтому `onUpdate`;
- **позиция** — у слайдера начало координат в левом верхнем углу фона, поэтому для полосы шириной 240 ставим `x = −120`, чтобы она оказалась по центру панели.

Стиль взят из `VolumeSlider` оригинала: те же цвета, только без обводки.

## Флажок

```ts SettingsPanel.ts
    const hint = new CheckBox({
      text: 'Подсказка',
      checked: true,
      style: {
        unchecked: createCheckView(false),
        checked: createCheckView(true),
        text: { fontFamily: 'Nunito', fontSize: 20, fill: 0xffffff },
      },
    });
    hint.position.set(-70, 10);
    hint.onCheck.connect((checked) => this.onHintChange?.(checked));
    this.addChild(hint);
```

У флажка два вида: без галочки и с галочкой. Нарисуем их в `Graphics` функцией рядом с `createButton`:

```ts SettingsPanel.ts
/** Квадрат флажка: пустой или с галочкой */
function createCheckView(checked: boolean) {
  const view = new Graphics().roundRect(0, 0, 32, 32, 8).fill(0xffd27f).stroke({ color: 0xcf4b00, width: 3 });
  if (checked) view.moveTo(8, 17).lineTo(14, 23).lineTo(25, 9).stroke({ color: 0x2c136c, width: 4, cap: 'round', join: 'round' });
  return view;
}
```

Импортируйте `Slider` и `CheckBox` из `@pixi/ui` и `Graphics` из `pixi.js`. Подпись `CheckBox` создаёт сам, обычным `Text` со стилем из `style.text`.

## Связываем с игрой

В `main.ts`, после кнопки паузы:

```ts main.ts
// --- Настройки на @pixi/ui: кнопка с шестерёнкой открывает панель ---
const settingsButton = createIconButton('icon-settings');
settingsButton.label = 'settingsButton';
settingsButton.visible = false;
app.stage.addChild(settingsButton);

const settingsPanel = new SettingsPanel();
settingsPanel.label = 'settingsPanel';
settingsPanel.visible = false;
app.stage.addChild(settingsPanel);

settingsPanel.onSpeedChange = (speed) => {
  // Замедляем и тикер приложения, и GSAP — как отладочная клавиша 3 в главе 8
  app.ticker.speed = speed;
  gsap.globalTimeline.timeScale(speed);
};
settingsPanel.onHintChange = (visible) => (hintText.visible = visible);

// FancyButton сообщает о нажатии сигналом: подписка через connect
settingsButton.onPress.connect(() => {
  settingsPanel.visible = true;
  board.locked = true;
  board.alpha = 0.5;
});
settingsPanel.onClose = () => {
  settingsPanel.visible = false;
  board.locked = false;
  board.alpha = 1;
};
```

В `layout` кнопка настроек встаёт левее паузы, панель — по центру экрана, а счёт теперь сторонится кнопки настроек:

```ts main.ts {2-3,5}
  pauseButton.position.set(width - MARGIN - 67 / 2, barY);
  settingsButton.position.set(pauseButton.x - 67 - 8, barY);
  settingsPanel.position.set(width / 2, height / 2);
  // Счёт по центру, но на узком экране сдвигаем его левее, чтобы не наехал на кнопки
  const buttonsLeft = settingsButton.x - 67 / 2;
```

И после отсчёта показываем её вместе с паузой: `settingsButton.visible = true`.

::: task
Допишите в `SettingsPanel` слайдер скорости и флажок подсказки. В `main.ts` удалите отладочные клавиши, добавьте кнопку настроек, открывающую панель, и свяжите панель со скоростью игры и подсказкой.
:::

## Что получилось

После отсчёта рядом с паузой появилась кнопка с шестерёнкой. Нажмите её: поле заблокировано, по центру — панель «Настройки». Потяните ручку слайдера влево: надпись показывает проценты, а фон и анимации замедляются прямо за панелью. Снимите флажок — подсказка внизу исчезла. «Готово» закрывает панель и возвращает игру.

Наша проверка протянула ручку на полпути влево и получила скорость 55 %. Тикер приложения при этом работал со `speed = 0.55`, флажок спрятал подсказку, а «Готово» закрыл панель и разблокировал поле.

## Эксперименты

- Добавьте в `createButton` вид для выключенного состояния: `disabledView: new NineSliceSprite({ texture: Texture.from('button-large'), ...BUTTON_SLICES, width: 200, height: 84, tint: 0x888888 })`, а после создания кнопки «Готово» поставьте `done.enabled = false`. Кнопка посерела и перестала нажиматься. Верните.
- Подпишите на `done.onPress` вторую функцию: `done.onPress.connect(() => console.log('Готово!'))`. Сработают обе: в этом преимущество сигнала перед полем-колбэком, где вторая функция заменила бы первую.
- Замените `onUpdate` на `onChange`. Скорость меняется только в момент, когда вы отпускаете ручку.

::: deep Под капотом: когда брать библиотеку
`@pixi/ui` устроена так же, как наш `Button`: контейнер, виды, события указателя, флаги состояния. Анимации `FancyButton` работают на собственном движке твинов `tweedle.js`, который обновляется от `Ticker.shared`. Поэтому слайдер скорости, который меняет `app.ticker.speed`, на анимации кнопок не влияет — как и на `AnimatedSprite` из главы 8.

Общее правило такое. Если компонент простой и вам нужен полный контроль над его поведением, как с нашей кнопкой, — пишите сами: кода немного, и он ваш. Если компонент сложный и стандартный (слайдер, прокрутка, поле ввода), берите библиотеку: краевые случаи там уже найдены и исправлены другими. Оригинальная Puzzling Potions делает именно так: кнопки и слайдер — из `@pixi/ui`, а остальной интерфейс — свои компоненты.

Ещё одна деталь подключения. `@pixi/ui` не содержит PixiJS внутри: она импортирует `pixi.js` и использует ту копию, что уже есть в проекте. Если бы в проект попали две разные копии PixiJS, объекты одной не работали бы в сцене другой. Поэтому в `package.json` библиотеки `pixi.js` указан как peer-зависимость: «используй мою, но установленную рядом».
:::
