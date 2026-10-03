import gsap from 'gsap';
import { Container, NineSliceSprite, Sprite, Texture } from 'pixi.js';
import { Button } from './Button';
import { Label } from './Label';
import { navigation, type AppScreen } from './navigation';

/** Затемнение под попапом: ловит все нажатия, чтобы они не дошли до экрана под ним */
export function createDim() {
  const dim = new Sprite(Texture.WHITE);
  dim.tint = 0x0a0025;
  dim.alpha = 0.7;
  dim.eventMode = 'static';
  return dim;
}

/** Панель со скруглёнными углами и тенью, как стартовая панель в главе 10 */
export function createPanel(width: number, height: number) {
  const slices = { leftWidth: 34, topHeight: 34, rightWidth: 34, bottomHeight: 34 };
  const texture = Texture.from('rounded-rectangle');
  const panel = new Container();
  const shadow = new NineSliceSprite({ texture, ...slices, width, height, anchor: 0.5, tint: 0x0a0025 });
  shadow.y = 14;
  const box = new NineSliceSprite({ texture, ...slices, width, height, anchor: 0.5, tint: 0x2c136c });
  panel.addChild(shadow, box);
  return panel;
}

/** Попап паузы: затемнение, панель и кнопка «Продолжить». Как PausePopup в Puzzling Potions */
export class PausePopup extends Container implements AppScreen {
  private readonly dim = createDim();
  private readonly panel = createPanel(320, 260);

  constructor() {
    super();
    const title = new Label('Пауза', { fontSize: 48, fill: 0xffd27f });
    title.y = -60;
    const resume = new Button({ text: 'Продолжить', width: 260 });
    resume.label = 'resumeButton';
    resume.y = 55;
    resume.onPress = () => navigation.dismissPopup();
    this.panel.addChild(title, resume);
    this.addChild(this.dim, this.panel);
  }

  resize(width: number, height: number) {
    this.dim.setSize(width, height);
    this.panel.position.set(width / 2, height / 2);
  }

  /** Затемнение проявляется, панель падает сверху */
  async show() {
    gsap.from(this.dim, { alpha: 0, duration: 0.2 });
    await gsap.from(this.panel.pivot, { y: 400, duration: 0.35, ease: 'back.out' });
  }

  async hide() {
    gsap.to(this.dim, { alpha: 0, duration: 0.2 });
    await gsap.to(this.panel.pivot, { y: 400, duration: 0.25, ease: 'back.in' });
  }
}
