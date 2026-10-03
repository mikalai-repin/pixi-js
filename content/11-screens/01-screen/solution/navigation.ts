import type { Container, Ticker } from 'pixi.js';

/**
 * Экран игры: меню, игра, результат, попап. Все методы необязательные —
 * у каждого экрана свой набор. Вызывать их будет навигация. Как AppScreen в Puzzling Potions
 */
export interface AppScreen extends Container {
  /** Экран уже на сцене, но ещё не показан: расставить начальное состояние */
  prepare?(): void;
  /** Анимация появления. Навигация дождётся её конца */
  show?(): Promise<void>;
  /** Анимация исчезновения. После неё экран уничтожат */
  hide?(): Promise<void>;
  /** Каждый кадр, пока экран на сцене */
  update?(ticker: Ticker): void;
  /** Изменился размер экрана */
  resize?(width: number, height: number): void;
}
