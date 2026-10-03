/** Пороги очков для одной, двух и трёх звёзд за игру в 60 секунд */
const GRADE_SCORES = [200, 600, 1200];

/** Последний результат: его записывает экран игры, а читает экран результата */
let lastScore = 0;

/** Ключ в localStorage: имя игры, чтобы не пересечься с другими страницами того же сайта */
const BEST_SCORE_KEY = 'puzzling-potions:best-score';

export function saveScore(score: number) {
  lastScore = score;
  // Рекорд хранится в браузере и переживает перезагрузку страницы
  if (score > getBestScore()) {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(score));
    } catch {
      // localStorage может быть недоступен, например в приватном режиме: игра работает и без рекорда
    }
  }
}

export function getLastScore() {
  return lastScore;
}

/** Сколько звёзд заслуживает счёт: от 0 до 3 */
export function getGrade(score: number) {
  return GRADE_SCORES.filter((threshold) => score >= threshold).length;
}

/** Лучший результат за всё время или 0 */
export function getBestScore() {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}
