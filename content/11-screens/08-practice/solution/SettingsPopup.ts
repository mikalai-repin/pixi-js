import { CheckBox, FancyButton, Slider } from '@pixi/ui';
import gsap from 'gsap';
import { Container, Graphics, NineSliceSprite, Sprite, Texture } from 'pixi.js';
import { app } from './app';
import { Label } from './Label';
import { navigation, type AppScreen } from './navigation';
import { createDim, createPanel } from './PausePopup';
import { userSettings } from './userSettings';

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
 * Попап настроек: слайдер скорости, флажок подсказки и «Готово».
 * Настройки записываются в userSettings, а скорость применяется сразу
 */
export class SettingsPopup extends Container implements AppScreen {
  private readonly dim = createDim();
  private readonly panel = createPanel(320, 330);

  constructor() {
    super();
    const title = new Label('Настройки', { fontSize: 36, fill: 0xffd27f });
    title.y = -120;
    this.panel.addChild(title);

    const percent = Math.round(userSettings.speed * 100);
    const speedLabel = new Label(`Скорость: ${percent}%`, { fontSize: 20 });
    speedLabel.y = -70;
    const speed = new Slider({
      bg: new Graphics().roundRect(0, 0, 240, 20, 10).fill(0xcf4b00),
      fill: new Graphics().roundRect(0, 0, 240, 20, 10).fill(0xff8221),
      slider: new Graphics().circle(0, 0, 16).fill(0xcf4b00).circle(0, 0, 12).fill(0xffd579),
      min: 25,
      max: 100,
      step: 5,
      // Попап создаётся заново при каждом открытии и начинает с текущей настройки
      value: percent,
    });
    speed.position.set(-120, -45);
    speed.onUpdate.connect((value) => {
      speedLabel.text = `Скорость: ${value}%`;
      userSettings.speed = value / 100;
      // Замедляем и тикер приложения, и GSAP
      app.ticker.speed = userSettings.speed;
      gsap.globalTimeline.timeScale(userSettings.speed);
    });
    this.panel.addChild(speedLabel, speed);

    const hint = new CheckBox({
      text: 'Подсказка',
      checked: userSettings.hint,
      style: {
        unchecked: createCheckView(false),
        checked: createCheckView(true),
        text: { fontFamily: 'Nunito', fontSize: 20, fill: 0xffffff },
      },
    });
    hint.position.set(-70, 10);
    // Экран игры применит эту настройку, когда попап закроется
    hint.onCheck.connect((checked) => (userSettings.hint = checked));
    this.panel.addChild(hint);

    const done = createButton('Готово');
    done.label = 'doneButton';
    done.y = 100;
    done.onPress.connect(() => navigation.dismissPopup());
    this.panel.addChild(done);

    this.addChild(this.dim, this.panel);
  }

  resize(width: number, height: number) {
    this.dim.setSize(width, height);
    this.panel.position.set(width / 2, height / 2);
  }

  async show() {
    gsap.from(this.dim, { alpha: 0, duration: 0.2 });
    await gsap.from(this.panel.pivot, { y: 400, duration: 0.35, ease: 'back.out' });
  }

  async hide() {
    gsap.to(this.dim, { alpha: 0, duration: 0.2 });
    await gsap.to(this.panel.pivot, { y: 400, duration: 0.25, ease: 'back.in' });
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
