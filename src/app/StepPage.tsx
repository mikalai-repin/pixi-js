import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Group, Panel, Separator, usePanelRef, type PanelImperativeHandle } from 'react-resizable-panels';
import { Navigate, useParams } from 'react-router';
import { allSteps, findStep, type FileMap, type Step } from '../content/course';
import { CodeEditor } from '../editor/CodeEditor';
import { compileStep, disposeModels, formatEditor, refreshDiagnostics, syncModels } from '../editor/monaco';
import { LessonPanel } from '../lesson/LessonPanel';
import { Preview, type PreviewRun } from '../preview/Preview';
import { progress } from '../progress/storage';
import { downloadProject } from './download';
import { useMediaQuery } from './useMediaQuery';

const AUTORUN_DELAY = 1000;
const SAVE_DELAY = 300;

type PaneId = 'lesson' | 'code' | 'result';

const PANE_LABELS: Record<PaneId, string> = { lesson: 'Урок', code: 'Код', result: 'Результат' };
/** Ширина свёрнутой панели — полоска с подписью */
const COLLAPSED_SIZE = '34px';

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
  const [mobileTab, setMobileTab] = useState<PaneId>('lesson');
  const [downloading, setDownloading] = useState(false);

  const timers = useRef<{ save?: number; autorun?: number }>({});
  const panes = useCollapsiblePanes(!isNarrow, () => runCode());

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
    // Подчёркивания, посчитанные, пока воркер ещё не знал всех файлов шага, пересчитываем
    refreshDiagnostics(step.id, step.fileOrder);
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

  async function onDownload() {
    setDownloading(true);
    try {
      await downloadProject(step, filesRef.current);
    } catch (error) {
      window.alert(`Не удалось собрать архив: ${(error as Error).message}`);
    } finally {
      setDownloading(false);
    }
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
      actions={!isNarrow && panes.collapseButton('lesson', '«')}
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
        actions={!isNarrow && panes.collapseButton('code', '«')}
      />
      <div className="toolbar">
        <button className="button primary" onClick={runCode} title="Ctrl/Cmd + Enter">
          ▶ Запустить
        </button>
        <button className="button" onClick={() => formatEditor()} title="Prettier · Ctrl/Cmd + S, Shift + Alt + F">
          Формат
        </button>
        <button className="button" onClick={onReset}>
          Сброс
        </button>
        <button
          className="button"
          onClick={onDownload}
          disabled={downloading}
          title="Скачать код шага архивом — готовый проект Vite с ресурсами"
        >
          {downloading ? 'Собираю…' : 'Скачать'}
        </button>
        <label className="toggle">
          <input type="checkbox" checked={autorun} onChange={(event) => toggleAutorun(event.target.checked)} />
          Автозапуск
        </label>
      </div>
    </div>
  );

  const preview = <Preview run={run} actions={!isNarrow && panes.collapseButton('result', '»')} />;

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
      <Panel {...panes.panelProps('lesson')} defaultSize="32%" minSize="20%">
        {panes.content('lesson', lesson)}
      </Panel>
      <Separator className="separator" />
      <Panel {...panes.panelProps('code')} defaultSize="36%" minSize="20%">
        {panes.content('code', editor)}
      </Panel>
      <Separator className="separator" />
      <Panel {...panes.panelProps('result')} defaultSize="32%" minSize="15%">
        {panes.content('result', preview)}
      </Panel>
    </Group>
  );
}

/**
 * Сворачивание панелей рабочей области: кнопкой в шапке панели или перетаскиванием разделителя за минимальный размер.
 * Свёрнутая панель — узкая полоска с подписью; содержимое остаётся смонтированным, чтобы не терять редактор и превью
 */
function useCollapsiblePanes(isWide: boolean, onResultExpanded: () => void) {
  const refs: Record<PaneId, RefObject<PanelImperativeHandle | null>> = {
    lesson: usePanelRef(),
    code: usePanelRef(),
    result: usePanelRef(),
  };
  // Панели появляются развёрнутыми; свёрнутые в прошлый раз сворачивает эффект ниже, а sync отмечает их здесь
  const [collapsed, setCollapsed] = useState<PaneId[]>([]);
  const collapsedRef = useRef(collapsed);

  // До первой отрисовки: группа к этому моменту уже посчитала раскладку.
  // Ещё раз — при переходе с узкого экрана: панели создаются заново, развёрнутыми
  useLayoutEffect(() => {
    if (!isWide) return;
    const saved = progress.getCollapsed() as PaneId[];
    collapsedRef.current = [];
    setCollapsed([]);
    // Хотя бы одна панель должна остаться развёрнутой
    for (const id of saved.slice(0, 2)) refs[id].current?.collapse();
  }, [isWide]);

  /** Вызывается при каждом изменении размера панели: свернули её или развернули */
  function sync(id: PaneId) {
    const isCollapsed = refs[id].current?.isCollapsed() ?? false;
    const current = collapsedRef.current;
    if (current.includes(id) === isCollapsed) return;
    const next = isCollapsed ? [...current, id] : current.filter((pane) => pane !== id);
    collapsedRef.current = next;
    setCollapsed(next);
    progress.setCollapsed(next);
    // Скрытый iframe имеет нулевой размер: код, который читает app.screen при старте, расставит всё неверно — перезапускаем
    if (id === 'result' && !isCollapsed) onResultExpanded();
  }

  return {
    panelProps: (id: PaneId) => ({
      id,
      panelRef: refs[id],
      collapsible: true,
      collapsedSize: COLLAPSED_SIZE,
      onResize: () => sync(id),
    }),

    content: (id: PaneId, children: ReactNode) => (
      <>
        <div className="pane" hidden={collapsed.includes(id)}>
          {children}
        </div>
        {collapsed.includes(id) && (
          <button
            className="pane-strip"
            title={`Развернуть: ${PANE_LABELS[id]}`}
            onClick={() => refs[id].current?.expand()}
          >
            <span className="pane-strip-icon" aria-hidden="true">
              {id === 'result' ? '«' : '»'}
            </span>
            <span className="pane-strip-label">{PANE_LABELS[id]}</span>
          </button>
        )}
      </>
    ),

    /** Последнюю развёрнутую панель свернуть нельзя — кнопки у неё нет */
    collapseButton: (id: PaneId, icon: string) =>
      collapsed.length < 2 && (
        <button
          type="button"
          className="icon-button pane-collapse"
          title={`Свернуть: ${PANE_LABELS[id]}`}
          onClick={() => refs[id].current?.collapse()}
        >
          {icon}
        </button>
      ),
  };
}
