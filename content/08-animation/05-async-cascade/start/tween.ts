import type { Ticker } from 'pixi.js';

/** Функция плавности: доля прошедшего времени (от 0 до 1) → доля пройденного пути */
export type Easing = (t: number) => number;

/** Равномерное движение: путь пропорционален времени */
export const linear: Easing = (t) => t;

/** Быстрый старт и плавная остановка: квадратичное замедление */
export const quadOut: Easing = (t) => 1 - (1 - t) * (1 - t);

/** Как quadOut, но в конце проскакивает цель примерно на 10 % и возвращается */
export const backOut: Easing = (t) => {
  const s = 1.70158;
  const p = t - 1;
  return p * p * ((s + 1) * p + s) + 1;
};

/** Когда падающая фишка впервые касается дна: доля времени */
const LAND_TIME = 0.55;
/** Высота отскока: доля всего пути */
const BOUNCE_HEIGHT = 0.15;

/** Падение с ускорением и один небольшой отскок, как у фишек в оригинале */
export const singleBounce: Easing = (t) => {
  // Падение: путь растёт как квадрат времени, то есть с ускорением
  if (t < LAND_TIME) return (t / LAND_TIME) ** 2;
  // Отскок: невысокая парабола вверх и обратно
  const u = (t - LAND_TIME) / (1 - LAND_TIME);
  return 1 - BOUNCE_HEIGHT * 4 * u * (1 - u);
};

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
