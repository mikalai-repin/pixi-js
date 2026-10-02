import { useEffect, useRef } from 'react';
import { modelUri, monaco } from './monaco';

interface Props {
  stepId: string;
  files: string[];
  active: string;
  readonly: string[];
  onSelect: (file: string) => void;
  onChange: (file: string, code: string) => void;
  onRun: () => void;
}

export function CodeEditor({ stepId, files, active, readonly, onSelect, onChange, onRun }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
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

  return (
    <div className="editor">
      <div className="tabs" role="tablist">
        {files.map((file) => (
          <button
            key={file}
            role="tab"
            aria-selected={file === active}
            className={file === active ? 'tab active' : 'tab'}
            onClick={() => onSelect(file)}
          >
            {file}
            {readonly.includes(file) && <span className="tab-lock" title="Только для чтения">🔒</span>}
          </button>
        ))}
      </div>
      <div className="editor-host" ref={hostRef} />
    </div>
  );
}
