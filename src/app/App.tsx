import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router';
import { allSteps, course, stepPath } from '../content/course';
import { progress } from '../progress/storage';
import { Appearance } from './Appearance';
import { Loader, PotionLogo } from './Loader';
// Страница шага тянет Monaco, TypeScript-воркер, типы PixiJS и Prettier — грузим её отдельным чанком: шапка
// и оглавление появляются сразу, а вместо редактора — загрузчик
const StepPage = lazy(() => import('./StepPage').then((module) => ({ default: module.StepPage })));

function Home() {
  const last = allSteps.find((step) => step.id === progress.getLastStep()) ?? allSteps[0];
  return <Navigate to={stepPath(last)} replace />;
}

function TableOfContents() {
  const location = useLocation();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Закрываем оглавление после перехода
  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = false;
  }, [location.pathname]);

  return (
    <details className="toc" ref={detailsRef}>
      <summary>Оглавление</summary>
      <nav className="toc-panel">
        {course.chapters.map((chapter) => (
          <section key={chapter.slug}>
            <h3>
              {chapter.index + 1}. {chapter.title}
            </h3>
            <ol>
              {chapter.steps.map((step) => (
                <li key={step.id}>
                  <Link
                    to={stepPath(step)}
                    className={location.pathname === stepPath(step) ? 'current' : undefined}
                  >
                    {progress.isDone(step.id) && <span className="done-mark">✓</span>}
                    {step.meta.title}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </nav>
    </details>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="topbar">
          <Link to="/" className="brand">
            <PotionLogo size={26} />
            {course.title}
          </Link>
          <TableOfContents />
          <span className="topbar-version">PixiJS v{course.pixiVersion}</span>
          <Appearance />
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/:chapter/:step"
              element={
                <Suspense fallback={<Loader label="Загружаем редактор…" />}>
                  <StepPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
