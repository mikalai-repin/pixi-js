import { useRef, useState } from 'react';
import { progress } from '../progress/storage';
import { getTheme, setTheme } from './theme';

/** Палитры платформы: цвета — в src/styles.css (`[data-palette='…']`), для загрузчика — в index.html.
 *  Первая — по умолчанию (в src/styles.css её блок — с :root) */
export const PALETTES = [
  { id: 'pixi', name: 'PixiJS' },
  { id: 'violet', name: 'Фиолетовая' },
  { id: 'emerald', name: 'Изумрудная' },
  { id: 'azure', name: 'Лазурная' },
] as const;

type PaletteId = (typeof PALETTES)[number]['id'];

const isPalette = (id: string | undefined): id is PaletteId => PALETTES.some((p) => p.id === id);

/** Палитра из localStorage (её же до запуска приложения применяет скрипт в index.html) */
export function currentPalette(): PaletteId {
  const saved = progress.getPalette();
  return isPalette(saved) ? saved : PALETTES[0].id;
}

function applyPalette(id: PaletteId) {
  document.documentElement.dataset.palette = id;
}

/** Образец палитры: элемент с data-palette получает её CSS-переменные — фон, поверхность и акцент */
function Swatch({ id }: { id: PaletteId }) {
  return (
    <span className="palette-swatch" data-palette={id} aria-hidden="true">
      <span className="palette-swatch-accent" />
    </span>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}

/** Оформление в шапке: кнопка «светлая ⇄ тёмная» и меню палитры */
export function Appearance() {
  const [palette, setPalette] = useState(currentPalette);
  const [theme, setThemeState] = useState(getTheme);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function choosePalette(id: PaletteId) {
    setPalette(id);
    applyPalette(id);
    progress.setPalette(id);
    if (detailsRef.current) detailsRef.current.open = false;
  }

  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <>
      <button
        type="button"
        className="icon-button theme-toggle"
        title={next === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
        aria-label={next === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему'}
        onClick={() => {
          setThemeState(next);
          setTheme(next);
        }}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      <details className="palette" ref={detailsRef}>
        <summary title="Цветовая палитра">
          <Swatch id={palette} />
          <span className="palette-label">Палитра</span>
        </summary>
        <div className="palette-menu" role="radiogroup" aria-label="Цветовая палитра">
          {PALETTES.map(({ id, name }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={palette === id}
              className={palette === id ? 'palette-option current' : 'palette-option'}
              onClick={() => choosePalette(id)}
            >
              <Swatch id={id} />
              {name}
            </button>
          ))}
        </div>
      </details>
    </>
  );
}
