import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { stepPath, type Step } from '../content/course';
import { renderMarkdown } from './markdown';

interface Props {
  step: Step;
  prev?: Step;
  next?: Step;
  hasSolution: boolean;
  hasBackup: boolean;
  onShowSolution: () => void;
  onRestoreBackup: () => void;
  /** Вызывается перед переходом к следующему шагу (отметить шаг пройденным) */
  onNext: () => void;
  /** Кнопки в шапке урока, например «свернуть панель» */
  actions?: ReactNode;
}

export function LessonPanel({
  step,
  prev,
  next,
  hasSolution,
  hasBackup,
  onShowSolution,
  onRestoreBackup,
  onNext,
  actions,
}: Props) {
  const navigate = useNavigate();
  const [html, setHtml] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    renderMarkdown(step.body).then((result) => {
      if (!cancelled) setHtml(result);
    });
    scrollRef.current?.scrollTo(0, 0);
    return () => {
      cancelled = true;
    };
  }, [step]);

  // Внутренние ссылки (step:...) переходят без перезагрузки страницы
  function onContentClick(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as HTMLElement).closest('a[data-internal]');
    if (!link) return;
    event.preventDefault();
    navigate(link.getAttribute('href')!);
  }

  const chapter = step.chapter;

  return (
    <div className="lesson">
      <div className="lesson-scroll" ref={scrollRef}>
        <header className="lesson-header">
          <div className="lesson-chapter-row">
            <div className="lesson-chapter">
              Глава {chapter.index + 1}. {chapter.title}
            </div>
            {actions}
          </div>
          <div className="lesson-title-row">
            <h1>{step.meta.title}</h1>
            <select
              className="step-select"
              value={step.slug}
              aria-label="Шаг главы"
              onChange={(event) => {
                const target = chapter.steps.find((s) => s.slug === event.target.value);
                if (target) navigate(stepPath(target));
              }}
            >
              {chapter.steps.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.index + 1} / {chapter.steps.length} — {s.meta.title}
                </option>
              ))}
            </select>
          </div>
        </header>
        <article className="lesson-content" onClick={onContentClick} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <footer className="lesson-footer">
        <button className="button" disabled={!prev} onClick={() => prev && navigate(stepPath(prev))}>
          ← Назад
        </button>
        <div className="lesson-footer-middle">
          {hasBackup ? (
            <button className="button" onClick={onRestoreBackup}>
              Вернуть мой код
            </button>
          ) : (
            hasSolution && (
              <button className="button" onClick={onShowSolution}>
                Решение
              </button>
            )
          )}
        </div>
        <button
          className="button primary"
          disabled={!next}
          onClick={() => {
            if (!next) return;
            onNext();
            navigate(stepPath(next));
          }}
        >
          Далее →
        </button>
      </footer>
    </div>
  );
}
