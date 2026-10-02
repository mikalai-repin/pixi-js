import { useCallback, useEffect, useRef, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Navigate, useParams } from 'react-router';
import { allSteps, findStep, type FileMap, type Step } from '../content/course';
import { CodeEditor } from '../editor/CodeEditor';
import { compileStep, disposeModels, syncModels } from '../editor/monaco';
import { LessonPanel } from '../lesson/LessonPanel';
import { Preview, type PreviewRun } from '../preview/Preview';
import { progress } from '../progress/storage';
import { useMediaQuery } from './useMediaQuery';

const AUTORUN_DELAY = 1000;
const SAVE_DELAY = 300;

export function StepPage() {
  const params = useParams();
  const step = findStep(params.chapter, params.step);
  if (!step) return <Navigate to="/" replace />;
  // key: при смене шага всё состояние рабочей области создаётся заново
  return <StepWorkspace key={step.id} step={step} />;
}

/** Сохранённый код ученика, дополненный файлами, которые появились в шаге позже */
function initialFiles(step: Step): FileMap {
  const saved = progress.getCode(step.id);
  const files: FileMap = {};
  for (const name of step.fileOrder) files[name] = saved?.[name] ?? step.start[name] ?? step.solution[name] ?? '';
  return files;
}

let runCounter = 0;

function StepWorkspace({ step }: { step: Step }) {
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [files] = useState(() => {
    const initial = initialFiles(step);
    // Модели Monaco нужны до первого рендера редактора
    syncModels(step.id, initial);
    return initial;
  });
  const filesRef = useRef(files);
  const [active, setActive] = useState(() => step.meta.focus ?? step.fileOrder[0]);
  const [run, setRun] = useState<PreviewRun | null>(null);
  const [autorun, setAutorun] = useState(progress.getAutorun);
  const [hasBackup, setHasBackup] = useState(() => Boolean(progress.getBackup(step.id)));
  const [mobileTab, setMobileTab] = useState<'lesson' | 'code' | 'result'>('lesson');

  const timers = useRef<{ save?: number; autorun?: number }>({});

  const index = allSteps.indexOf(step);
  const prev = allSteps[index - 1];
  const next = allSteps[index + 1];

  const runCode = useCallback(async () => {
    window.clearTimeout(timers.current.autorun);
    const compiled = await compileStep(step.id, step.fileOrder);
    setRun({ files: compiled.files, diagnostics: compiled.diagnostics, entry: 'main.js', id: ++runCounter });
  }, [step]);

  useEffect(() => {
    syncModels(step.id, filesRef.current);
    progress.setLastStep(step.id);
    runCode();
    const pending = timers.current;
    return () => {
      window.clearTimeout(pending.autorun);
      window.clearTimeout(pending.save);
      disposeModels(step.id);
    };
  }, [step, runCode]);

  const onChange = useCallback(
    (file: string, code: string) => {
      if (filesRef.current[file] === code) return;
      filesRef.current = { ...filesRef.current, [file]: code };

      window.clearTimeout(timers.current.save);
      timers.current.save = window.setTimeout(() => progress.setCode(step.id, filesRef.current), SAVE_DELAY);

      if (autorun) {
        window.clearTimeout(timers.current.autorun);
        timers.current.autorun = window.setTimeout(runCode, AUTORUN_DELAY);
      }
    },
    [step, autorun, runCode],
  );

  /** Подменяет код во всех вкладках (сброс, решение, возврат своего кода) */
  function replaceFiles(nextFiles: FileMap) {
    const merged = { ...filesRef.current, ...nextFiles };
    filesRef.current = merged;
    syncModels(step.id, merged);
    progress.setCode(step.id, merged);
    runCode();
  }

  function onReset() {
    if (!window.confirm('Вернуть стартовый код шага? Ваши изменения пропадут.')) return;
    replaceFiles(step.start);
    progress.clearCode(step.id);
    setHasBackup(false);
  }

  function onShowSolution() {
    if (!window.confirm('Показать решение? Ваш код сохранится, его можно будет вернуть.')) return;
    progress.setBackup(step.id, filesRef.current);
    setHasBackup(true);
    replaceFiles(step.solution);
  }

  function onRestoreBackup() {
    const backup = progress.getBackup(step.id);
    if (backup) replaceFiles(backup);
    progress.setBackup(step.id, undefined);
    setHasBackup(false);
  }

  function toggleAutorun(value: boolean) {
    setAutorun(value);
    progress.setAutorun(value);
  }

  const lesson = (
    <LessonPanel
      step={step}
      prev={prev}
      next={next}
      hasSolution={Object.keys(step.solution).length > 0}
      hasBackup={hasBackup}
      onShowSolution={onShowSolution}
      onRestoreBackup={onRestoreBackup}
      onNext={() => progress.setDone(step.id)}
    />
  );

  const editor = (
    <div className="code-column">
      <CodeEditor
        stepId={step.id}
        files={step.fileOrder}
        active={active}
        readonly={step.meta.readonly ?? []}
        onSelect={setActive}
        onChange={onChange}
        onRun={runCode}
      />
      <div className="toolbar">
        <button className="button primary" onClick={runCode} title="Ctrl/Cmd + Enter">
          ▶ Запустить
        </button>
        <button className="button" onClick={onReset}>
          Сброс
        </button>
        <label className="toggle">
          <input type="checkbox" checked={autorun} onChange={(event) => toggleAutorun(event.target.checked)} />
          Автозапуск
        </label>
      </div>
    </div>
  );

  const preview = <Preview run={run} />;

  if (isNarrow) {
    return (
      <div className="workspace-narrow">
        <div className="mobile-tabs" role="tablist">
          {(
            [
              ['lesson', 'Урок'],
              ['code', 'Код'],
              ['result', 'Результат'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={mobileTab === id}
              className={mobileTab === id ? 'tab active' : 'tab'}
              onClick={() => {
                setMobileTab(id);
                // Скрытый iframe имеет нулевой размер, и код, который читает app.screen при старте, расставит всё неверно.
                // Поэтому при открытии результата перезапускаем код уже в видимом окне
                if (id === 'result') runCode();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Все панели остаются смонтированными, чтобы не терять редактор и превью при переключении */}
        <div className="mobile-pane" hidden={mobileTab !== 'lesson'}>
          {lesson}
        </div>
        <div className="mobile-pane" hidden={mobileTab !== 'code'}>
          {editor}
        </div>
        <div className="mobile-pane" hidden={mobileTab !== 'result'}>
          {preview}
        </div>
      </div>
    );
  }

  return (
    <Group orientation="horizontal" className="workspace">
      <Panel defaultSize="32%" minSize="20%">
        {lesson}
      </Panel>
      <Separator className="separator" />
      <Panel defaultSize="36%" minSize="20%">
        {editor}
      </Panel>
      <Separator className="separator" />
      <Panel defaultSize="32%" minSize="15%">
        {preview}
      </Panel>
    </Group>
  );
}
