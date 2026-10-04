// Файлы шага на диске с учётом цепочки шагов (Node). Повторяет логику src/content/course.ts:
// шаг со startFrom: previous не хранит папку start/ — его старт = solution/ предыдущего шага главы,
// а если у предыдущего шага решения нет (noSolution) — его старт.
// Используют валидатор (scripts/validate-content.mjs) и браузерные проверки (tools/e2e/lib.mjs).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();

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

/** Папка предыдущего шага той же главы или null */
export function previousStepPath(stepPath) {
  const chapterPath = dirname(stepPath);
  const steps = readdirSync(chapterPath).filter((name) => isDir(join(chapterPath, name))).sort();
  const index = steps.indexOf(basename(stepPath));
  return index > 0 ? join(chapterPath, steps[index - 1]) : null;
}

/** Старт шага: своя папка start/ или, для startFrom: previous, результат предыдущего шага */
export function readStart(stepPath) {
  const own = readFiles(join(stepPath, 'start'));
  if (Object.keys(own).length || readMeta(stepPath).startFrom === 'custom') return own;
  const previous = previousStepPath(stepPath);
  return previous ? readResult(previous) : {};
}

/** Код, которым шаг заканчивается: решение, а у шага без решения — старт */
export function readResult(stepPath) {
  const solution = readFiles(join(stepPath, 'solution'));
  return Object.keys(solution).length ? solution : readStart(stepPath);
}

/** Файлы папки шага по пути …/<шаг>/start или …/<шаг>/solution (start/ разрешается по цепочке) */
export function readStepDir(dir) {
  return basename(dir) === 'start' ? readStart(dirname(dir)) : readFiles(dir);
}
