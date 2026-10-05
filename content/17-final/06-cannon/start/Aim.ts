import { Container } from 'pixi.js';
import type { BubbleGrid, Shot } from './bubbles';

/**
 * Прицел: пунктир из точек по пути, которым полетит пузырь, с отскоками от стен.
 * Путь считает та же функция, что будет двигать настоящий выстрел. Как AimSystem в Bubbo Bubbo
 */
export class Aim extends Container {
  /** Рисует путь выстрела. from — копия выстрела, его не меняем */
  update(grid: BubbleGrid, from: Shot) {
    // TODO: точки shot-visualiser по пути выстрела, пока он не врежется
  }
}
