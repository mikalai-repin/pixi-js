import { useEffect, useRef, useState } from 'react';
import type { FileMap } from '../content/course';
import type { Diagnostic } from '../editor/monaco';

export interface ConsoleEntry {
  id: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'ts';
  text: string;
}

export interface PreviewRun {
  files: FileMap;
  entry: string;
  id: number;
  /** Ошибки TypeScript: показываем их в консоли, но код всё равно запускаем */
  diagnostics: Diagnostic[];
}

interface PreviewMessage {
  source: 'pixi-course-preview';
  type: 'ready' | 'console' | 'error';
  level?: ConsoleEntry['level'];
  text?: string;
}

interface Props {
  /** Скомпилированный JS; новый объект = новый запуск */
  run: PreviewRun | null;
}

let nextEntryId = 1;

export function Preview({ run }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);

  // Новый запуск — пересоздаём iframe (через key) и чистим консоль
  useEffect(() => {
    setEntries(
      (run?.diagnostics ?? []).map((d) => ({
        id: nextEntryId++,
        level: 'ts',
        text: `${d.file}:${d.line}:${d.column} — ${d.message}`,
      })),
    );
  }, [run]);

  useEffect(() => {
    function onMessage(event: MessageEvent<PreviewMessage>) {
      const data = event.data;
      if (data?.source !== 'pixi-course-preview') return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (data.type === 'ready' && run) {
        iframeRef.current?.contentWindow?.postMessage({ type: 'run', files: run.files, entry: run.entry }, '*');
      } else if (data.type === 'console' || data.type === 'error') {
        const level: ConsoleEntry['level'] = data.type === 'error' ? 'error' : (data.level ?? 'log');
        setEntries((list) => [...list.slice(-199), { id: nextEntryId++, level, text: data.text ?? '' }]);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [run]);

  return (
    <div className="preview">
      <div className="preview-frame">
        {run ? (
          <iframe key={run.id} ref={iframeRef} src="/preview.html" title="Результат" />
        ) : (
          <div className="preview-empty">Компилируем…</div>
        )}
      </div>
      <div className="console">
        <div className="console-header">
          <span>Консоль</span>
          {entries.length > 0 && (
            <button className="link-button" onClick={() => setEntries([])}>
              Очистить
            </button>
          )}
        </div>
        <div className="console-body">
          {entries.length === 0 ? (
            <div className="console-empty">Здесь появится вывод console.log и ошибки</div>
          ) : (
            entries.map((entry) => (
              <pre key={entry.id} className={`console-line console-${entry.level}`}>
                {entry.level === 'ts' && <span className="console-badge">TS</span>}
                {entry.text}
              </pre>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
