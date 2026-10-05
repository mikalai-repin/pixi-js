/** Уровень игры на ходы. Цели уровня появятся в следующем шаге */
export interface Level {
  /** Сколько ходов есть у игрока */
  moves: number;
}

/** Все уровни по порядку */
export const LEVELS: Level[] = [{ moves: 20 }, { moves: 16 }, { moves: 12 }];

/**
 * Номер уровня, который сейчас играется, или null — обычная игра на время.
 * Экраны создаёт навигация без аргументов, поэтому выбор передаётся через модуль, как счёт в stats.ts
 */
let currentLevel: number | null = null;

/** Выбирает уровень для следующей игры. null — игра на время */
export function selectLevel(index: number | null) {
  currentLevel = index;
}

/** Номер текущего уровня, с нуля, или null */
export function getLevelIndex() {
  return currentLevel;
}

/** Текущий уровень или null, если игра на время */
export function getLevel() {
  return currentLevel === null ? null : LEVELS[currentLevel];
}
