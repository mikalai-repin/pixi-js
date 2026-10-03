/** Пороги очков для одной, двух и трёх звёзд за игру в 60 секунд */
const GRADE_SCORES = [200, 600, 1200];

/** Последний результат: его записывает экран игры, а читает экран результата */
let lastScore = 0;

export function saveScore(score: number) {
  lastScore = score;
  // TODO: если счёт больше рекорда, сохранить его в localStorage
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
  // TODO: прочитать рекорд из localStorage
  return 0;
}
