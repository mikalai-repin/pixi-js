/** Цель уровня: собрать count зелий одного вида */
export interface LevelGoal {
  /** Имя текстуры зелья, как у Piece.textureName */
  piece: string;
  count: number;
}

/** Уровень игры на ходы */
export interface Level {
  /** Сколько ходов есть у игрока */
  moves: number;
  /** Что нужно собрать, чтобы пройти уровень */
  goals: LevelGoal[];
}

/** Все уровни по порядку: от одной цели к трём. Числа подобраны симуляцией сотен партий */
export const LEVELS: Level[] = [
  { moves: 15, goals: [{ piece: 'piece-frog', count: 15 }] },
  { moves: 16, goals: [{ piece: 'piece-dragon', count: 12 }, { piece: 'piece-newt', count: 12 }] },
  { moves: 16, goals: [{ piece: 'piece-snake', count: 15 }, { piece: 'piece-yeti', count: 15 }] },
  {
    moves: 16,
    goals: [
      { piece: 'piece-spider', count: 12 },
      { piece: 'piece-frog', count: 12 },
      { piece: 'piece-dragon', count: 12 },
    ],
  },
  {
    moves: 15,
    goals: [
      { piece: 'piece-newt', count: 18 },
      { piece: 'piece-yeti', count: 18 },
      { piece: 'piece-snake', count: 18 },
    ],
  },
];

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
