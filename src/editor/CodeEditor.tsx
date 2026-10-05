import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatEditor, modelUri, monaco } from './monaco';

interface Props {
  stepId: string;
  files: string[];
  active: string;
  readonly: string[];
  onSelect: (file: string) => void;
  onChange: (file: string, code: string) => void;
  onRun: () => void;
  /** Кнопки справа в шапке редактора, например «свернуть панель» */
  actions?: ReactNode;
}

/** Ключ localStorage: открыта ли панель файлов */
const TREE_KEY = 'pixi-course:file-tree-open';

function loadTreeOpen() {
  try {
    return localStorage.getItem(TREE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveTreeOpen(open: boolean) {
  try {
    localStorage.setItem(TREE_KEY, open ? '1' : '0');
  } catch {
    // localStorage недоступен — панель просто не запомнится
  }
}

/** Узкий экран: панель файлов лежит поверх кода (см. styles.css), поэтому после выбора файла её закрываем */
const isNarrow = () => window.matchMedia('(max-width: 700px)').matches;

/** Файлы для панели: main.ts первым, остальные по алфавиту — так их проще найти, чем в порядке вкладок */
function sortForTree(files: string[]) {
  return [...files].sort((a, b) => (a === 'main.ts' ? -1 : b === 'main.ts' ? 1 : a.localeCompare(b)));
}

export function CodeEditor({ stepId, files, active, readonly, onSelect, onChange, onRun, actions }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [treeOpen, setTreeOpen] = useState(() => loadTreeOpen() && !isNarrow());
  // Колбэки меняются каждый рендер — храним последние в ref, чтобы не пересоздавать подписки
  const handlers = useRef({ onChange, onRun });
  handlers.current = { onChange, onRun };

  useEffect(() => {
    const editor = monaco.editor.create(hostRef.current!, {
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      tabSize: 2,
      padding: { top: 12 },
      renderLineHighlight: 'line',
      fixedOverflowWidgets: true,
      // Иначе Monaco подсвечивает кириллицу в комментариях как «похожие на латиницу» символы
      unicodeHighlight: { ambiguousCharacters: false },
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => handlers.current.onRun());
    // Ctrl/Cmd + S форматирует код (вместо диалога сохранения страницы): сохраняется он и так автоматически
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => formatEditor(editor));
    editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (!model) return;
      const file = model.uri.path.split('/').pop()!;
      handlers.current.onChange(file, model.getValue());
    });
    editorRef.current = editor;
    return () => editor.dispose();
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const model = monaco.editor.getModel(modelUri(stepId, active));
    if (!editor || !model || editor.getModel() === model) return;
    editor.setModel(model);
    editor.updateOptions({ readOnly: readonly.includes(active) });
  }, [stepId, active, readonly]);

  // Активная вкладка всегда видна в полосе вкладок, даже если её выбрали в панели файлов
  useEffect(() => {
    tabsRef.current?.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, files]);

  const toggleTree = () => {
    setTreeOpen((open) => {
      saveTreeOpen(!open);
      return !open;
    });
  };

  return (
    <div className="editor">
      <div className="editor-header">
        <button
          className={treeOpen ? 'tree-toggle active' : 'tree-toggle'}
          onClick={toggleTree}
          aria-pressed={treeOpen}
          title={treeOpen ? 'Скрыть файлы' : `Показать файлы (${files.length})`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M1.5 3.5a1 1 0 0 1 1-1h3.6l1.4 1.5h6a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
          <span className="tree-count">{files.length}</span>
        </button>
        <div className="tabs" role="tablist" ref={tabsRef}>
          {files.map((file) => (
            <button
              key={file}
              role="tab"
              aria-selected={file === active}
              className={file === active ? 'tab active' : 'tab'}
              onClick={() => onSelect(file)}
            >
              {file}
              {readonly.includes(file) && (
                <span className="tab-lock" title="Только для чтения">
                  🔒
                </span>
              )}
            </button>
          ))}
        </div>
        {actions}
      </div>
      <div className="editor-body">
        {treeOpen && (
          <nav className="file-tree" aria-label="Файлы шага">
            <div className="file-tree-root">Файлы шага</div>
            {sortForTree(files).map((file) => (
              <button
                key={file}
                className={file === active ? 'file-tree-item active' : 'file-tree-item'}
                aria-current={file === active ? 'true' : undefined}
                onClick={() => {
                  onSelect(file);
                  if (isNarrow()) setTreeOpen(false);
                }}
                title={file}
              >
                <span className="file-tree-name">{file}</span>
                {readonly.includes(file) && (
                  <span className="tab-lock" title="Только для чтения">
                    🔒
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}
        <div className="editor-host" ref={hostRef} />
      </div>
    </div>
  );
}
