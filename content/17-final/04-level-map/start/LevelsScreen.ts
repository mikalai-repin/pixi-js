import { Container } from 'pixi.js';
import type { AppScreen } from './navigation';

/**
 * Карта уровней: кнопка на каждый уровень, под ней звёзды за лучшее прохождение.
 * Следующий уровень открывается, когда пройден предыдущий
 */
export class LevelsScreen extends Container implements AppScreen {
  /** Кнопки и звёзды лежат в атласе common */
  static assetBundles = ['common'];

  constructor() {
    super();
    // TODO: заголовок, кнопки уровней со звёздами, кнопка «Меню»
  }

  resize(width: number, height: number) {
    // TODO: расставить элементы
  }
}
