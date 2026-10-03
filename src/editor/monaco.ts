import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import pixiTypes from '../../node_modules/pixi.js/dist/pixi.js.d.ts?raw';
import type { FileMap } from '../content/course';

// Типы GSAP: набор .d.ts с /// <reference>, внутри — `declare module "gsap"`
const gsapTypes = import.meta.glob('../../node_modules/gsap/types/**/*.d.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

self.MonacoEnvironment = {
  getWorker(_id, label) {
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    return new EditorWorker();
  },
};

// Monaco отклоняет промисы объектом Canceled, когда модель удаляется посреди запроса к воркеру
// (быстрый переход между шагами). Это штатная ситуация, а не ошибка
window.addEventListener('unhandledrejection', (event) => {
  if ((event.reason as { name?: string } | undefined)?.name === 'Canceled') event.preventDefault();
});

const ts = monaco.typescript;

ts.typescriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  lib: ['es2022', 'dom', 'dom.iterable'],
  strict: true,
  noEmitOnError: false,
  allowNonTsExtensions: true,
  isolatedModules: true,
  // Встроенные source map: превью переводит номера строк в ошибках обратно в .ts, а DevTools показывает исходник
  inlineSourceMap: true,
  inlineSources: true,
});

// Ошибки показываем сразу, но запуск они не блокируют: так ученик видит, что TS ругается, и может поэкспериментировать
ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
ts.typescriptDefaults.setEagerModelSync(true);

// Типы pixi.js — один собранный .d.ts из пакета. Путь node_modules нужен, чтобы сработал `import ... from 'pixi.js'`
ts.typescriptDefaults.addExtraLib(pixiTypes, 'file:///node_modules/pixi.js/index.d.ts');
for (const [path, source] of Object.entries(gsapTypes)) {
  ts.typescriptDefaults.addExtraLib(source, 'file:///node_modules/gsap/types/' + path.split('/gsap/types/')[1]);
}
ts.typescriptDefaults.addExtraLib(
  `declare var __PIXI_APP__: import('pixi.js').Application | undefined;`,
  'file:///course-globals.d.ts',
);

function applyTheme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
}
applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

export function modelUri(stepId: string, file: string) {
  return monaco.Uri.parse(`file:///steps/${stepId}/${file}`);
}

/** Создаёт (или обновляет) модели всех файлов шага */
export function syncModels(stepId: string, files: FileMap) {
  for (const [file, code] of Object.entries(files)) {
    const uri = modelUri(stepId, file);
    const existing = monaco.editor.getModel(uri);
    if (existing) {
      if (existing.getValue() !== code) existing.setValue(code);
    } else {
      monaco.editor.createModel(code, file.endsWith('.ts') ? 'typescript' : undefined, uri);
    }
  }
}

/** Удаляет модели шага при уходе с него, чтобы TS не видел файлы чужих шагов */
export function disposeModels(stepId: string) {
  const prefix = `file:///steps/${stepId}/`;
  for (const model of monaco.editor.getModels()) {
    if (model.uri.toString().startsWith(prefix)) model.dispose();
  }
}

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface CompileResult {
  files: FileMap;
  diagnostics: Diagnostic[];
}

type DiagnosticMessage = string | { messageText: string; next?: DiagnosticMessage[] };

function flattenMessage(message: DiagnosticMessage): string {
  if (typeof message === 'string') return message;
  const nested = (message.next ?? []).map((m) => flattenMessage(m)).join(' ');
  return nested ? `${message.messageText} ${nested}` : message.messageText;
}

/**
 * Доступ к TS-воркеру. Языковой модуль TypeScript в Monaco загружается асинхронно, и при самом первом
 * открытии страницы getTypeScriptWorker может отклонить промис строкой «TypeScript not registered!».
 * Поэтому ждём с повторными попытками
 */
async function getTypeScriptWorker() {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ts.getTypeScriptWorker();
    } catch (error) {
      if (attempt >= 50) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

/** Компилирует TS-файлы шага в JS через воркер TypeScript, который уже работает в Monaco */
export async function compileStep(stepId: string, files: string[]): Promise<CompileResult> {
  const getWorker = await getTypeScriptWorker();
  const result: CompileResult = { files: {}, diagnostics: [] };
  for (const file of files) {
    const uri = modelUri(stepId, file);
    const model = monaco.editor.getModel(uri);
    if (!model) continue;
    if (!file.endsWith('.ts')) {
      result.files[file] = model.getValue();
      continue;
    }
    const worker = await getWorker(uri);
    const name = uri.toString();
    const [output, syntactic, semantic] = await Promise.all([
      worker.getEmitOutput(name),
      worker.getSyntacticDiagnostics(name),
      worker.getSemanticDiagnostics(name),
    ]);
    const js = output.outputFiles.find((f) => f.name.endsWith('.js'));
    result.files[file.replace(/\.ts$/, '.js')] = js?.text ?? '';

    for (const diagnostic of [...syntactic, ...semantic]) {
      const position = model.getPositionAt(diagnostic.start ?? 0);
      result.diagnostics.push({
        file,
        line: position.lineNumber,
        column: position.column,
        message: flattenMessage(diagnostic.messageText as DiagnosticMessage),
        // category: 0 — warning, 1 — error (ts.DiagnosticCategory)
        severity: diagnostic.category === 1 ? 'error' : 'warning',
      });
    }
  }
  return result;
}

export { monaco };
