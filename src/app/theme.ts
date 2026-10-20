// Светлая и тёмная тема платформы: переключает кнопка ☀/☾ в шапке (src/app/Appearance.tsx), выбор —
// progress.theme в localStorage, по умолчанию тёмная. На <html> стоит data-theme="light" | "dark" — по нему работают
// стили (src/styles.css) и редактор (src/editor/monaco.ts следит за атрибутом). До запуска приложения атрибут ставит
// скрипт в index.html — там то же значение по умолчанию.
import { progress } from '../progress/storage';

export type Theme = 'light' | 'dark';

export const DEFAULT_THEME: Theme = 'dark';

export function getTheme(): Theme {
  const saved = progress.getTheme();
  return saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME;
}

export function setTheme(theme: Theme) {
  progress.setTheme(theme);
  document.documentElement.dataset.theme = theme;
}
