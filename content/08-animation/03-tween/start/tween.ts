import type { Ticker } from 'pixi.js';

/** Функция плавности: доля прошедшего времени (от 0 до 1) → доля пройденного пути */
export type Easing = (t: number) => number;

/** Равномерное движение: путь пропорционален времени */
export const linear: Easing = (t) => t;

export interface TweenOptions {
  /** Длительность в секундах */
  duration: number;
  /** Функция плавности, по умолчанию linear */
  ease?: Easing;
}

/** Линейная интерполяция: при t = 0 получаем a, при t = 1 — b, между ними — точки на отрезке */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Твин: плавно меняет числовые свойства target до значений из to за duration секунд.
 * Возвращает промис, который выполняется, когда анимация закончилась
 */
export function tween<T extends object, K extends keyof T>(
  ticker: Ticker,
  target: T,
  to: Record<K, number>,
  { duration, ease = linear }: TweenOptions,
) {
  // TODO: запомнить начальные значения, каждый кадр копить прошедшее время
  // и записывать в target промежуточные значения; в конце отписаться от тикера и выполнить промис
  return Promise.resolve();
}
