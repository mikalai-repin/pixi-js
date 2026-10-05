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

/** Итог последнего сыгранного уровня: его записывает экран игры, а читает экран результата */
const lastResult = { won: false, movesLeft: 0, stars: 0 };

/** Записывает итог уровня, а заработанные звёзды — в прогресс, если их больше, чем было */
export function saveLevelResult(won: boolean, movesLeft: number) {
  lastResult.won = won;
  lastResult.movesLeft = movesLeft;
  lastResult.stars = won && currentLevel !== null ? countStars(movesLeft, LEVELS[currentLevel].moves) : 0;
  if (currentLevel !== null && lastResult.stars > getStars(currentLevel)) {
    progress[currentLevel] = lastResult.stars;
    saveProgress();
  }
}

/** Сколько звёзд принёс последний уровень: 0, если он не пройден */
export function getLastStars() {
  return lastResult.stars;
}

/** Пройден ли последний уровень */
export function isLevelWon() {
  return lastResult.won;
}

/** Сколько ходов осталось в запасе в последнем уровне */
export function getMovesLeft() {
  return lastResult.movesLeft;
}

/** Сколько ходов нужно оставить в запасе, в долях от всех ходов уровня, для двух и для трёх звёзд */
const STAR_RESERVE = [0.2, 0.4];

/** Уровень пройден — одна звезда. Чем больше ходов в запасе, тем больше звёзд */
export function countStars(movesLeft: number, moves: number) {
  return 1 + STAR_RESERVE.filter((share) => movesLeft >= moves * share).length;
}

/** Ключ прогресса в localStorage */
const PROGRESS_KEY = 'puzzling-potions:levels';

/** Лучший результат по уровням: progress[i] — звёзды за уровень i, от 1 до 3; нет записи — не пройден */
const progress = loadProgress();

/** Читает прогресс. Сохранённым данным не доверяем: берём только числа от 0 до 3 */
function loadProgress(): number[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    return saved.map((stars) => (Number.isInteger(stars) && stars >= 0 && stars <= 3 ? stars : 0));
  } catch {
    // Нет localStorage или там испорченная строка: начинаем с нуля
    return [];
  }
}

function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Прогресс не сохранится, но играть можно
  }
}

/** Звёзды за лучшее прохождение уровня, 0 — уровень не пройден */
export function getStars(index: number) {
  return progress[index] ?? 0;
}

/** Открыт ли уровень: первый открыт всегда, остальные — когда пройден предыдущий */
export function isUnlocked(index: number) {
  return index === 0 || getStars(index - 1) > 0;
}
