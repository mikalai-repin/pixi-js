import { Container, Sprite, Texture } from 'pixi.js';
import { BUBBLE_COLORS, BUBBLE_NAMES, BUBBLE_SIZE, type BubbleType } from './bubbles';

/**
 * Пузырь на экране: цветная тень и сам пузырь.
 * Упрощённая версия BubbleView из Bubbo Bubbo. Нужен загруженный бандл bubbo
 */
export class Bubble extends Container {
  private readonly shadow: Sprite;
  private readonly image: Sprite;

  constructor(readonly type: BubbleType) {
    super();
    // Тень чуть крупнее пузыря и сдвинута вниз. Текстура белая, цвет даёт тонирование
    this.shadow = new Sprite({ texture: Texture.from('bubble-shadow'), anchor: 0.5 });
    this.shadow.setSize(BUBBLE_SIZE * 1.1);
    this.shadow.y = BUBBLE_SIZE * 0.08;
    this.shadow.tint = BUBBLE_COLORS[type - 1];
    this.image = new Sprite({ texture: Texture.from(BUBBLE_NAMES[type - 1]), anchor: 0.5 });
    this.image.setSize(BUBBLE_SIZE);
    this.addChild(this.shadow, this.image);
  }
}
