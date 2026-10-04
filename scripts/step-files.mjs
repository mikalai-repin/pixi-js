// Файлы шага на диске с учётом цепочки шагов (Node). Повторяет логику src/content/course.ts.
// Шаг хранит только то, что в нём меняется:
//   база шага   — результат предыдущего шага курса (через границы глав; у первого шага курса — пусто);
//   старт       — база без файлов из `remove` во frontmatter, поверх неё — файлы из start/;
//   решение     — старт, поверх него — файлы из solution/ (нет solution/ — нет решения);
//   результат   — решение, а у шага без решения — старт.
// Используют валидатор (scripts/validate-content.mjs), браузерные проверки (tools/e2e/lib.mjs)
// и генераторы глав (tools/authoring/steps.py — через командную строку ниже).
//
// Командная строка — полный снимок папки шага:
//   node scripts/step-files.mjs content/12-effects/05-particles/solution            → JSON в stdout
//   node scripts/step-files.mjs content/12-effects/05-particles/solution <папка>    → файлы в папку
// Вместо start/solution можно указать result. Путь к папке главы без шага — база её первого шага.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();
const isStep = (name) => /^\d{2}-/.test(name);

/** Все файлы папки (с подпапками): 'core/models.ts' → текст. Нет папки — пустой объект */
export function readFiles(dir) {
  const files = {};
  if (!isDir(dir)) return files;
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (isDir(path)) walk(path);
      else files[relative(dir, path)] = readFileSync(path, 'utf8');
    }
  };
  walk(dir);
  return files;
}

/** Frontmatter lesson.md шага (или пустой объект) */
export function readMeta(stepPath) {
  const lessonPath = join(stepPath, 'lesson.md');
  if (!existsSync(lessonPath)) return {};
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(lessonPath, 'utf8'));
  return match ? (parseYaml(match[1]) ?? {}) : {};
}

/** Папки глав по порядку: из course.json, а главы, которых там ещё нет, — по номеру в имени папки */
function chapterPaths(contentRoot) {
  const coursePath = join(contentRoot, 'course.json');
  const listed = existsSync(coursePath) ? JSON.parse(readFileSync(coursePath, 'utf8')).chapters : [];
  const onDisk = readdirSync(contentRoot).filter((name) => isStep(name) && isDir(join(contentRoot, name)));
  const all = [...listed, ...onDisk.filter((name) => !listed.includes(name))].sort();
  return all.map((name) => join(contentRoot, name));
}

/** Папки шагов главы по порядку */
export function stepPaths(chapterPath) {
  return readdirSync(chapterPath)
    .filter((name) => isStep(name) && isDir(join(chapterPath, name)))
    .sort()
    .map((name) => join(chapterPath, name));
}

/** Папка шага, который в курсе идёт перед данным (через границу главы), или null */
export function previousStepPath(stepPath) {
  const chapterPath = dirname(resolve(stepPath));
  const steps = stepPaths(chapterPath);
  const index = steps.indexOf(resolve(stepPath));
  if (index > 0) return steps[index - 1];
  return lastStepBefore(chapterPath);
}

/** Последний шаг глав, идущих перед данной, или null */
function lastStepBefore(chapterPath) {
  const chapters = chapterPaths(dirname(resolve(chapterPath)));
  for (let i = chapters.indexOf(resolve(chapterPath)) - 1; i >= 0; i--) {
    const steps = stepPaths(chapters[i]);
    if (steps.length) return steps[steps.length - 1];
  }
  return null;
}

// Снимки не меняются за время работы процесса: кэшируем, чтобы не разворачивать цепочку заново
const cache = new Map();
const cached = (key, compute) => {
  if (!cache.has(key)) cache.set(key, compute());
  return { ...cache.get(key) };
};

/** База шага: результат предыдущего шага курса */
export function readBase(stepPath) {
  const previous = previousStepPath(stepPath);
  return previous ? readResult(previous) : {};
}

/** Старт шага: база без файлов из remove, поверх неё — своя start/ */
export function readStart(stepPath) {
  return cached(`start:${resolve(stepPath)}`, () => {
    const start = readBase(stepPath);
    for (const name of readMeta(stepPath).remove ?? []) delete start[name];
    return { ...start, ...readFiles(join(stepPath, 'start')) };
  });
}

/** Решение шага: старт, поверх него — своя solution/. Нет solution/ — пустой объект (решения нет) */
export function readSolution(stepPath) {
  return cached(`solution:${resolve(stepPath)}`, () => {
    const own = readFiles(join(stepPath, 'solution'));
    return Object.keys(own).length ? { ...readStart(stepPath), ...own } : {};
  });
}

/** Код, которым шаг заканчивается: решение, а у шага без решения — старт */
export function readResult(stepPath) {
  const solution = readSolution(stepPath);
  return Object.keys(solution).length ? solution : readStart(stepPath);
}

/** Шаг ли это курса: папка внутри главы внутри content/ (а не временная папка эксперимента) */
const isCourseStep = (stepPath) => {
  const chapterPath = dirname(resolve(stepPath));
  return isStep(basename(resolve(stepPath))) && isStep(basename(chapterPath)) && existsSync(join(dirname(chapterPath), 'course.json'));
};

/** Полные файлы по пути …/<шаг>/start, …/<шаг>/solution или …/<шаг>/result. Другие папки читаются как есть */
export function readStepDir(dir) {
  const kind = basename(dir);
  const stepPath = dirname(dir);
  if (!isCourseStep(stepPath)) return readFiles(dir);
  if (kind === 'start') return readStart(stepPath);
  if (kind === 'solution') return readSolution(stepPath);
  if (kind === 'result') return readResult(stepPath);
  return readFiles(dir);
}

/** Записывает карту файлов в папку */
export function writeFiles(dir, files) {
  for (const [name, text] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [target, outDir] = process.argv.slice(2);
  if (!target) {
    console.error('Использование: node scripts/step-files.mjs <…/<шаг>/start|solution|result или папка главы> [папка для файлов]');
    process.exit(1);
  }
  // Папка главы (рядом лежит course.json) — база её первого шага: результат последнего шага прошлых глав
  const isChapter = existsSync(join(dirname(resolve(target)), 'course.json'));
  const previous = isChapter ? lastStepBefore(target) : null;
  const files = isChapter ? (previous ? readResult(previous) : {}) : readStepDir(target);
  if (outDir) writeFiles(outDir, files);
  else process.stdout.write(JSON.stringify(files));
}
