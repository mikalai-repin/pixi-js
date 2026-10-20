// Логотип-колба (зелье из Puzzling Potions, как в public/favicon.svg) и загрузчик платформы.
// Та же разметка — в index.html (виден до запуска JavaScript): при изменении правьте оба места.
import { useId } from 'react';

/** Контур колбы в координатах 0…32: горлышко с ободком, коническое дно со скруглёнными углами */
const FLASK = 'M12 6h8v3h-1v4.2l5.6 8.4A3 3 0 0 1 22.1 26H9.9a3 3 0 0 1-2.5-4.4L13 13.2V9h-1z';

/** Пузырьки загрузчика: x, радиус, задержка — поднимаются от дна к горлышку */
const BUBBLES = [
  { x: 13.5, r: 1.1, delay: 0 },
  { x: 17.5, r: 0.8, delay: -0.6 },
  { x: 15.8, r: 1.3, delay: -1.2 },
];

/** Колба с зельем. animated — пузырьки поднимаются, жидкость покачивается (только для загрузчика) */
export function PotionLogo({ size = 24, animated = false }: { size?: number; animated?: boolean }) {
  // Логотипов на странице может быть два (шапка и загрузчик) — id обрезки у каждого свой
  const clipId = useId();
  return (
    <svg
      className={animated ? 'potion-logo potion-logo-animated' : 'potion-logo'}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <clipPath id={clipId}>
        <path d={FLASK} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect className="potion-logo-liquid" x="4" y="17" width="24" height="12" />
        {animated
          ? BUBBLES.map(({ x, r, delay }) => (
              <circle key={x} className="potion-logo-bubble" cx={x} cy="25" r={r}>
                <animate attributeName="cy" values="25;13" dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  dur="1.8s"
                  begin={`${delay}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))
          : [
              <circle key="a" className="potion-logo-bubble" cx="14" cy="22" r="1.2" />,
              <circle key="b" className="potion-logo-bubble" cx="18" cy="20" r="0.8" />,
            ]}
      </g>
      <path className="potion-logo-flask" d={FLASK} />
    </svg>
  );
}

/** Загрузчик: колба и подпись. compact — для небольших областей (превью) */
export function Loader({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={compact ? 'loader loader-compact' : 'loader'} role="status">
      <PotionLogo size={compact ? 40 : 64} animated />
      <span className="loader-label">{label}</span>
    </div>
  );
}
