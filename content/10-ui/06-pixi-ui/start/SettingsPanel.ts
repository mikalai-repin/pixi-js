import { FancyButton } from '@pixi/ui';
import { Container, NineSliceSprite, Sprite, Texture } from 'pixi.js';
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

    // TODO: слайдер скорости (Slider) от 25 до 100 % и флажок подсказки (CheckBox)

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
