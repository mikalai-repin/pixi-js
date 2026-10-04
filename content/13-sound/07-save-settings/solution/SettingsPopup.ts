import { CheckBox, FancyButton, Slider } from '@pixi/ui';
import gsap from 'gsap';
import { Container, Graphics, NineSliceSprite, Sprite, Texture } from 'pixi.js';
import { bgm, sfx } from './audio';
import { Label } from './Label';
import { navigation, type AppScreen } from './navigation';
import { createDim, createPanel } from './PausePopup';
import { saveSettings, userSettings } from './userSettings';

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

/** Слайдер громкости: от 0 до 100 % с шагом 5 */
function createVolumeSlider(volume: number) {
  return new Slider({
    bg: new Graphics().roundRect(0, 0, 240, 20, 10).fill(0xcf4b00),
    fill: new Graphics().roundRect(0, 0, 240, 20, 10).fill(0xff8221),
    slider: new Graphics().circle(0, 0, 16).fill(0xcf4b00).circle(0, 0, 12).fill(0xffd579),
    min: 0,
    max: 100,
    step: 5,
    // Попап создаётся заново при каждом открытии и начинает с текущей настройки
    value: Math.round(volume * 100),
  });
}

/** Квадрат флажка: пустой или с галочкой */
function createCheckView(checked: boolean) {
  const view = new Graphics().roundRect(0, 0, 32, 32, 8).fill(0xffd27f).stroke({ color: 0xcf4b00, width: 3 });
  if (checked) view.moveTo(8, 17).lineTo(14, 23).lineTo(25, 9).stroke({ color: 0x2c136c, width: 4, cap: 'round', join: 'round' });
  return view;
}

/**
 * Попап настроек: громкость музыки и эффектов, флажок подсказки и «Готово».
 * Настройки записываются в userSettings, громкость применяется сразу
 */
export class SettingsPopup extends Container implements AppScreen {
  private readonly dim = createDim();
  private readonly panel = createPanel(320, 410);

  constructor() {
    super();
    const title = new Label('Настройки', { fontSize: 36, fill: 0xffd27f });
    title.y = -160;
    this.panel.addChild(title);

    const musicLabel = new Label(`Музыка: ${Math.round(userSettings.music * 100)}%`, { fontSize: 20 });
    musicLabel.y = -110;
    const music = createVolumeSlider(userSettings.music);
    music.label = 'musicSlider';
    music.position.set(-120, -85);
    music.onUpdate.connect((value) => {
      musicLabel.text = `Музыка: ${value}%`;
      userSettings.music = value / 100;
      bgm.setVolume(userSettings.music);
    });
    this.panel.addChild(musicLabel, music);

    const sfxLabel = new Label(`Звуки: ${Math.round(userSettings.sfx * 100)}%`, { fontSize: 20 });
    sfxLabel.y = -40;
    const effects = createVolumeSlider(userSettings.sfx);
    effects.label = 'sfxSlider';
    effects.position.set(-120, -15);
    effects.onUpdate.connect((value) => {
      sfxLabel.text = `Звуки: ${value}%`;
      userSettings.sfx = value / 100;
      sfx.setVolume(userSettings.sfx);
    });
    // Слайдер отпустили: пусть игрок услышит, как теперь звучат эффекты
    effects.onChange.connect(() => sfx.play('common/sfx-press.wav'));
    this.panel.addChild(sfxLabel, effects);

    const hint = new CheckBox({
      text: 'Подсказка',
      checked: userSettings.hint,
      style: {
        unchecked: createCheckView(false),
        checked: createCheckView(true),
        text: { fontFamily: 'Nunito', fontSize: 20, fill: 0xffffff },
      },
    });
    hint.position.set(-70, 40);
    // Экран игры применит эту настройку, когда попап закроется
    hint.onCheck.connect((checked) => (userSettings.hint = checked));
    this.panel.addChild(hint);

    const done = createButton('Готово');
    done.label = 'doneButton';
    done.y = 135;
    done.onPress.connect(() => {
      saveSettings();
      navigation.dismissPopup();
    });
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
