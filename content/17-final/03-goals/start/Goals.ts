import { Container, type PointData } from 'pixi.js';
import type { LevelGoal } from './levels';

/**
 * Панель целей уровня: для каждой цели — иконка зелья и сколько его ещё собрать.
 * Сама ничего не считает: показывает числа, которые ей передаёт экран игры
 */
export class Goals extends Container {
  constructor(goals: LevelGoal[]) {
    super();
    this.label = 'goals';
    // TODO: для каждой цели — иконка зелья и число рядом с ней
  }

  /** Показывает, сколько зелий piece ещё нужно собрать. 0 — цель выполнена */
  setCount(piece: string, count: number) {
    // TODO
  }

  /** Где иконка зелья, в глобальных координатах, или null, если такой цели нет или она выполнена */
  getIconPosition(piece: string): PointData | null {
    // TODO
    return null;
  }

  /** Иконка вздрагивает, когда в неё прилетает зелье */
  bump(piece: string) {
    // TODO
  }
}
