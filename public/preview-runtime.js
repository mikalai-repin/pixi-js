// Среда выполнения кода ученика внутри iframe.
//
// Протокол с родительским окном (src/preview/protocol.ts):
//   iframe → родитель: { type: 'ready' }
//   родитель → iframe: { type: 'run', files: { 'main.ts': '<js>' }, entry: 'main.ts' }
//   iframe → родитель: { type: 'console', level, text } | { type: 'error', text }
//
// Каждый запуск — новый iframe, поэтому здесь нет никакой очистки состояния.

import { init, parse } from '/vendor/es-module-lexer.js';

const parentWindow = window.parent;
const send = (message) => parentWindow.postMessage({ source: 'pixi-course-preview', ...message }, '*');

/** blob-URL → имя файла, чтобы в ошибках было видно «Piece.ts:12», а не «blob:...» */
const blobNames = new Map();

/** Имя .ts-файла → разобранная source map: номера строк скомпилированного JS → строки исходника */
const sourceMaps = new Map();

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Разбирает поле mappings (Base64 VLQ) в массив строк: [[генКолонка, исхСтрока, исхКолонка], ...] */
function decodeMappings(mappings) {
  const lines = [];
  let sourceLine = 0;
  let sourceColumn = 0;
  for (const lineText of mappings.split(';')) {
    const segments = [];
    let generatedColumn = 0;
    for (const segmentText of lineText.split(',')) {
      if (!segmentText) continue;
      const values = [];
      let value = 0;
      let shift = 0;
      for (const char of segmentText) {
        const digit = BASE64.indexOf(char);
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
        } else {
          values.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = 0;
          shift = 0;
        }
      }
      generatedColumn += values[0];
      if (values.length >= 4) {
        sourceLine += values[2];
        sourceColumn += values[3];
        segments.push([generatedColumn, sourceLine, sourceColumn]);
      }
    }
    lines.push(segments);
  }
  return lines;
}

function readInlineSourceMap(code) {
  const match = /\/\/# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/.exec(code);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
    const map = JSON.parse(new TextDecoder().decode(bytes));
    return decodeMappings(map.mappings);
  } catch {
    return null;
  }
}

function mapPosition(file, line, column) {
  const segments = sourceMaps.get(file)?.[line - 1];
  if (!segments?.length) return null;
  let best = segments[0];
  for (const segment of segments) {
    if (segment[0] <= column - 1) best = segment;
    else break;
  }
  return { line: best[1] + 1, column: best[2] + 1 };
}

function prettify(text) {
  let result = String(text);
  for (const [url, name] of blobNames) result = result.split(url).join(name);
  return result.replace(/([\w./-]+\.ts):(\d+):(\d+)/g, (whole, file, line, column) => {
    const original = mapPosition(file, Number(line), Number(column));
    return original ? `${file}:${original.line}:${original.column}` : whole;
  });
}

// ---------- Консоль ----------

function formatValue(value, depth = 0) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  const type = typeof value;
  if (type === 'string') return depth === 0 ? value : JSON.stringify(value);
  if (type === 'number' || type === 'boolean' || type === 'bigint') return String(value);
  if (type === 'function') return `ƒ ${value.name || 'anonymous'}()`;
  if (type === 'symbol') return value.toString();
  if (value instanceof Error) return prettify(value.stack || `${value.name}: ${value.message}`);

  const name = value.constructor?.name;
  if (Array.isArray(value)) {
    if (depth >= 2) return `Array(${value.length})`;
    const items = value.slice(0, 20).map((item) => formatValue(item, depth + 1));
    if (value.length > 20) items.push(`… ещё ${value.length - 20}`);
    return `[${items.join(', ')}]`;
  }
  // Объекты PixiJS огромные и с циклическими ссылками — показываем только имя класса
  if (name && name !== 'Object') {
    if ('x' in value && 'y' in value && Object.keys(value).length <= 4) {
      return `${name} { x: ${value.x}, y: ${value.y} }`;
    }
    return `${name} {…}`;
  }
  if (depth >= 2) return '{…}';
  const keys = Object.keys(value);
  const entries = keys.slice(0, 20).map((key) => `${key}: ${formatValue(value[key], depth + 1)}`);
  if (keys.length > 20) entries.push(`… ещё ${keys.length - 20}`);
  return `{ ${entries.join(', ')} }`;
}

for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    try {
      send({ type: 'console', level, text: args.map((arg) => formatValue(arg)).join(' ') });
    } catch {
      // Ошибка форматирования не должна ломать код ученика
    }
  };
}

window.addEventListener('error', (event) => {
  send({ type: 'error', text: prettify(event.error?.stack || event.message) });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  send({ type: 'error', text: prettify(reason?.stack || String(reason)) });
});

// ---------- Модули ----------

function resolveFile(files, fromFile, specifier) {
  const baseParts = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') baseParts.pop();
    else baseParts.push(part);
  }
  const path = baseParts.join('/');
  for (const candidate of [path, `${path}.ts`, `${path}.js`, `${path}/index.ts`]) {
    if (candidate in files) return candidate;
  }
  return null;
}

/**
 * Превращает набор файлов в blob-модули. Относительные импорты (`./Piece`)
 * заменяются на blob-URL зависимостей, а «голые» (`pixi.js`) резолвит import map.
 */
function linkModules(files, entry) {
  const urls = new Map();
  const visiting = new Set();

  function build(file, chain) {
    if (urls.has(file)) return urls.get(file);
    if (visiting.has(file)) {
      throw new Error(`Циклический импорт: ${[...chain, file].join(' → ')}. Превью курса не поддерживает циклические зависимости между файлами.`);
    }
    visiting.add(file);

    const code = files[file];
    const [imports] = parse(code, file);
    const replacements = [];

    for (const imp of imports) {
      const spec = imp.specifier;
      if (!spec || !(spec.startsWith('./') || spec.startsWith('../'))) continue;
      const target = resolveFile(files, file, spec);
      if (!target) throw new Error(`${file}: не найден файл для импорта "${spec}"`);
      const url = build(target, [...chain, file]);
      // У статического импорта start/end — без кавычек, у динамического — с кавычками
      const text = imp.type === 'dynamic' ? JSON.stringify(url) : url;
      replacements.push({ start: imp.start, end: imp.end, text });
    }

    let linked = code;
    for (const r of replacements.sort((a, b) => b.start - a.start)) {
      linked = linked.slice(0, r.start) + r.text + linked.slice(r.end);
    }

    // Если есть source map, модуль называется именем исходника (Piece.ts) — так его видно в стеке и в DevTools
    const lines = readInlineSourceMap(code);
    const displayName = lines ? file.replace(/\.js$/, '.ts') : file;
    if (lines) sourceMaps.set(displayName, lines);

    const url = URL.createObjectURL(new Blob([`${linked}\n//# sourceURL=${displayName}`], { type: 'text/javascript' }));
    blobNames.set(url, displayName);
    visiting.delete(file);
    urls.set(file, url);
    return url;
  }

  return build(entry, []);
}

window.addEventListener('message', async (event) => {
  const data = event.data;
  if (event.source !== parentWindow || data?.type !== 'run') return;
  try {
    await init();
    const entryUrl = linkModules(data.files, data.entry);
    await import(entryUrl);
  } catch (error) {
    send({ type: 'error', text: prettify(error?.stack || String(error)) });
  }
});

send({ type: 'ready' });
