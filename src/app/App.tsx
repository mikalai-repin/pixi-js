import { useEffect, useRef } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router';
import { allSteps, course, stepPath } from '../content/course';
import { progress } from '../progress/storage';
import { StepPage } from './StepPage';

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
            {course.title}
          </Link>
          <TableOfContents />
          <span className="topbar-version">PixiJS v{course.pixiVersion}</span>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:chapter/:step" element={<StepPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
