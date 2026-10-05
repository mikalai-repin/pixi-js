import gsap from 'gsap';
import { Container, Sprite, Texture } from 'pixi.js';
import { BUBBLE_COLORS, BUBBLE_NAMES, BUBBLE_SIZE, type BubbleType } from './bubbles';

/**
 * Пузырь на экране: цветная тень, сам пузырь и блик, который вспыхивает при ударе.
 * Упрощённая версия BubbleView из Bubbo Bubbo. Нужен загруженный бандл bubbo
 */
export class Bubble extends Container {
  private readonly shadow: Sprite;
  private readonly image: Sprite;
  private readonly shine: Sprite;

  constructor(readonly type: BubbleType) {
    super();
    // Тень чуть крупнее пузыря и сдвинута вниз. Текстура белая, цвет даёт тонирование
    this.shadow = new Sprite({ texture: Texture.from('bubble-shadow'), anchor: 0.5 });
    this.shadow.setSize(BUBBLE_SIZE * 1.1);
    this.shadow.y = BUBBLE_SIZE * 0.08;
    this.shadow.tint = BUBBLE_COLORS[type - 1];
    this.image = new Sprite({ texture: Texture.from(BUBBLE_NAMES[type - 1]), anchor: 0.5 });
    this.image.setSize(BUBBLE_SIZE);
    this.shine = new Sprite({ texture: Texture.from('bubble-shine'), anchor: 0.5 });
    this.shine.setSize(BUBBLE_SIZE);
    this.shine.alpha = 0;
    this.addChild(this.shadow, this.image, this.shine);
  }

  /** Блик проворачивается и гаснет: пузырь встал на место */
  async shimmer() {
    this.shine.rotation = 0;
    gsap.to(this.shine, { rotation: Math.PI, duration: 0.1, ease: 'power3.out' });
    await gsap.to(this.shine, { alpha: 1, duration: 0.06, yoyo: true, repeat: 1 });
  }

  /** Твины не должны пережить пузырь */
  override destroy() {
    gsap.killTweensOf(this.shine);
    super.destroy({ children: true });
  }
}
