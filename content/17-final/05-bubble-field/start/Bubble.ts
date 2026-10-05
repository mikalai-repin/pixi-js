import { Container } from 'pixi.js';
import type { BubbleType } from './bubbles';

/**
 * Пузырь на экране: цветная тень и сам пузырь.
 * Упрощённая версия BubbleView из Bubbo Bubbo. Нужен загруженный бандл bubbo
 */
export class Bubble extends Container {
  constructor(readonly type: BubbleType) {
    super();
    // TODO: тень bubble-shadow, тонированная цветом пузыря, и картинка пузыря размером BUBBLE_SIZE
  }
}
