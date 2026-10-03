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
  // Внутри работаем с объектами как со словарями чисел: типы уже проверила сигнатура
  const values = target as Record<string, number>;
  const end = to as Record<string, number>;
  const start: Record<string, number> = {};
  for (const key in end) start[key] = values[key];

  let elapsed = 0;
  return new Promise<void>((resolve) => {
    const update = () => {
      elapsed += ticker.deltaMS / 1000;
      // Доля прошедшего времени от 0 до 1
      const t = Math.min(elapsed / duration, 1);
      const k = ease(t);
      for (const key in end) values[key] = lerp(start[key], end[key], k);
      if (t === 1) {
        ticker.remove(update);
        resolve();
      }
    };
    ticker.add(update);
  });
}
