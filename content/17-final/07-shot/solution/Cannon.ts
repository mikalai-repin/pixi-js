import gsap from 'gsap';
import { Container, Sprite, Texture } from 'pixi.js';
import { Bubble } from './Bubble';
import { BUBBLE_COLORS, type BubbleType } from './bubbles';

/** Масштаб частей пушки: в атласе они нарисованы для пузыря крупнее нашего */
const CANNON_SCALE = 0.5;

/**
 * Пушка: основание стоит на месте, ствол со стрелкой поворачиваются, в центре лежит заряженный пузырь.
 * Упрощённая версия Cannon из Bubbo Bubbo. Нужен загруженный бандл bubbo
 */
export class Cannon extends Container {
  private readonly barrel: Sprite;
  private readonly main: Sprite;
  private readonly arrow: Sprite;
  /** Заряженный пузырь: его и выпускает игра */
  private bubble?: Bubble;

  constructor() {
    super();
    const part = (name: string) => {
      const sprite = new Sprite({ texture: Texture.from(name), anchor: 0.5 });
      sprite.scale.set(CANNON_SCALE);
      this.addChild(sprite);
      return sprite;
    };
    // Порядок — снизу вверх: ствол под корпусом, стрелка и крышка поверх
    this.barrel = part('cannon-barrel');
    this.main = part('cannon-main');
    this.arrow = part('cannon-arrow');
    part('cannon-top');
  }

  /**
   * Куда смотрит ствол, в радианах: 0 — строго вверх, плюс — вправо. Корпус не поворачивается.
   * Имя angle занято: у Container это поворот в градусах
   */
  set aim(value: number) {
    this.barrel.rotation = this.arrow.rotation = value;
  }

  get aim() {
    return this.barrel.rotation;
  }

  /** Заряжает пузырь цвета type: он выпрыгивает в центре пушки, корпус и стрелка окрашиваются в его цвет */
  load(type: BubbleType) {
    this.bubble = new Bubble(type);
    this.addChild(this.bubble);
    this.main.tint = this.arrow.tint = BUBBLE_COLORS[type - 1];
    gsap.from(this.bubble.scale, { x: 0, y: 0, duration: 0.3, ease: 'back.out' });
  }

  /** Отдаёт заряженный пузырь: дальше он летит сам. Пушка снова белая */
  unload() {
    const bubble = this.bubble;
    this.bubble = undefined;
    this.main.tint = this.arrow.tint = 0xffffff;
    return bubble;
  }
}
