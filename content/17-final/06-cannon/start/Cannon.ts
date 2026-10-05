import { Container } from 'pixi.js';
import type { BubbleType } from './bubbles';

/**
 * Пушка: основание стоит на месте, ствол со стрелкой поворачиваются, в центре лежит заряженный пузырь.
 * Упрощённая версия Cannon из Bubbo Bubbo. Нужен загруженный бандл bubbo
 */
export class Cannon extends Container {
  constructor() {
    super();
    // TODO: части пушки — cannon-barrel, cannon-main, cannon-arrow, cannon-top
  }

  /**
   * Куда смотрит ствол, в радианах: 0 — строго вверх, плюс — вправо. Корпус не поворачивается.
   * Имя angle занято: у Container это поворот в градусах
   */
  set aim(value: number) {
    // TODO
  }

  get aim() {
    // TODO
    return 0;
  }

  /** Заряжает пузырь цвета type: он выпрыгивает в центре пушки, корпус и стрелка окрашиваются в его цвет */
  load(type: BubbleType) {
    // TODO
  }
}
