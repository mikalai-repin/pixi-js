/** Ключ в localStorage: с именем игры, как у рекорда */
const SETTINGS_KEY = 'puzzling-potions:settings';

/**
 * Настройки игрока, общие для всех экранов: попап настроек их меняет, игра применяет.
 * Хранятся в localStorage и переживают перезагрузку. Как userSettings в Puzzling Potions
 */
export const userSettings = loadSettings();

/** Записывает настройки в браузер */
export function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
  } catch {
    // Хранилище недоступно: настройки просто не запомнятся
  }
}

/** Читает сохранённые настройки. Чего нет или что испорчено, то берём по умолчанию */
function loadSettings() {
  const settings = {
    /** Громкость музыки: от 0 до 1 */
    music: 1,
    /** Громкость звуковых эффектов: от 0 до 1 */
    sfx: 1,
    /** Показывать ли подсказку под полем */
    hint: true,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    // В хранилище может оказаться что угодно: данные старой версии игры, ручная правка.
    // Берём только значения подходящего типа
    if (isVolume(saved?.music)) settings.music = saved.music;
    if (isVolume(saved?.sfx)) settings.sfx = saved.sfx;
    if (typeof saved?.hint === 'boolean') settings.hint = saved.hint;
  } catch {
    // Испорченный JSON или недоступное хранилище: остаёмся с настройками по умолчанию
  }
  return settings;
}

/** Громкость — число от 0 до 1 */
function isVolume(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}
