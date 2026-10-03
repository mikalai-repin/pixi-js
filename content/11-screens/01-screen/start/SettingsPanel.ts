import { CheckBox, FancyButton, Slider } from '@pixi/ui';
import { Container, Graphics, NineSliceSprite, Sprite, Texture } from 'pixi.js';
import { Label } from './Label';

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 330;
const PANEL_SLICES = { leftWidth: 34, topHeight: 34, rightWidth: 34, bottomHeight: 34 };
const BUTTON_SLICES = { leftWidth: 36, topHeight: 42, rightWidth: 36, bottomHeight: 52 };

/** Кнопка из готовых состояний: FancyButton сама переключает виды и анимирует нажатие */
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

/** Квадрат флажка: пустой или с галочкой */
function createCheckView(checked: boolean) {
  const view = new Graphics().roundRect(0, 0, 32, 32, 8).fill(0xffd27f).stroke({ color: 0xcf4b00, width: 3 });
  if (checked) view.moveTo(8, 17).lineTo(14, 23).lineTo(25, 9).stroke({ color: 0x2c136c, width: 4, cap: 'round', join: 'round' });
  return view;
}

/**
 * Панель настроек на компонентах @pixi/ui: слайдер скорости, флажок подсказки и кнопка «Готово».
 * О действиях игрока сообщает колбэками. Нужен загруженный бандл common
 */
export class SettingsPanel extends Container {
  /** Новая скорость игры, от 0.25 до 1 */
  onSpeedChange?: (speed: number) => void;
  /** Показывать ли подсказку */
  onHintChange?: (visible: boolean) => void;
  /** Панель закрыли кнопкой «Готово» */
  onClose?: () => void;

  constructor() {
    super();
    const texture = Texture.from('rounded-rectangle');
    const shadow = new NineSliceSprite({ texture, ...PANEL_SLICES, width: PANEL_WIDTH, height: PANEL_HEIGHT, anchor: 0.5, tint: 0x0a0025 });
    shadow.y = 14;
    const box = new NineSliceSprite({ texture, ...PANEL_SLICES, width: PANEL_WIDTH, height: PANEL_HEIGHT, anchor: 0.5, tint: 0x2c136c });
    const title = new Label('Настройки', { fontSize: 36, fill: 0xffd27f });
    title.y = -120;
    this.addChild(shadow, box, title);

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

    const done = createButton('Готово');
    done.y = 100;
    done.onPress.connect(() => this.onClose?.());
    this.addChild(done);
  }
}

/** Маленькая кнопка с иконкой на FancyButton */
export function createIconButton(icon: string) {
  const slices = { leftWidth: 16, topHeight: 16, rightWidth: 16, bottomHeight: 20 };
  const view = (name: string) => new NineSliceSprite({ texture: Texture.from(name), ...slices, width: 67, height: 53 });
  return new FancyButton({
    defaultView: view('button-small'),
    hoverView: view('button-small-hover'),
    pressedView: view('button-small-press'),
    icon: new Sprite(Texture.from(icon)),
    iconOffset: { y: -3, pressed: { y: 0 } },
    anchor: 0.5,
  });
}
