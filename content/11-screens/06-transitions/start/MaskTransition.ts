import gsap from 'gsap';
import { Container, Sprite, Texture } from 'pixi.js';

/**
 * Переход-маска: экран виден только внутри силуэта котла, а котёл растёт и вращается,
 * пока не закроет весь экран. Упрощённая версия MaskTransition из Puzzling Potions. Нужен бандл common
 */
export class MaskTransition {
  private readonly mask: Sprite;

  constructor() {
    this.mask = new Sprite(Texture.from('white-cauldron'));
    this.mask.anchor.set(0.5);
  }

  /** Центр экрана: оттуда растёт маска */
  resize(width: number, height: number) {
    this.mask.position.set(width / 2, height / 2);
  }

  /** Открывает target: маска растёт от нуля до размера, который накрывает весь экран */
  async play(target: Container) {
    // TODO
  }
}
