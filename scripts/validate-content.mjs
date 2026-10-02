// Проверка контента курса: структура шагов и цепочка start/solution.
// Запуск: npm run validate (типы кода уроков проверяет отдельно `tsc -p tsconfig.content.json`)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';

const root = join(import.meta.dirname, '..', 'content');
const errors = [];
const warnings = [];

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();

function readFiles(dir) {
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

function sameFiles(a, b) {
  const diff = [];
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[name] !== b[name]) diff.push(name);
  }
  return diff;
}

const course = JSON.parse(readFileSync(join(root, 'course.json'), 'utf8'));
let stepCount = 0;

for (const chapterDir of course.chapters) {
  const chapterPath = join(root, chapterDir);
  if (!existsSync(join(chapterPath, 'chapter.json'))) {
    errors.push(`${chapterDir}: нет chapter.json`);
    continue;
  }

  const steps = readdirSync(chapterPath).filter((name) => isDir(join(chapterPath, name))).sort();
  let previousSolution = null;

  for (const stepDir of steps) {
    stepCount++;
    const where = `${chapterDir}/${stepDir}`;
    const stepPath = join(chapterPath, stepDir);
    if (!/^\d{2}-[a-z0-9-]+$/.test(stepDir)) errors.push(`${where}: имя папки должно быть вида NN-slug`);

    const lessonPath = join(stepPath, 'lesson.md');
    let meta = {};
    if (!existsSync(lessonPath)) {
      errors.push(`${where}: нет lesson.md`);
    } else {
      const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(lessonPath, 'utf8'));
      if (!match) errors.push(`${where}: нет frontmatter`);
      else {
        try {
          meta = parseYaml(match[1]) ?? {};
        } catch (error) {
          errors.push(`${where}: ошибка YAML во frontmatter: ${error.message.split('\n')[0]}`);
        }
      }
      if (!meta.title) errors.push(`${where}: во frontmatter нет title`);
    }

    const start = readFiles(join(stepPath, 'start'));
    const solution = readFiles(join(stepPath, 'solution'));
    if (!start['main.ts']) errors.push(`${where}: нет start/main.ts`);
    if (meta.noSolution && Object.keys(solution).length) errors.push(`${where}: noSolution: true, но папка solution/ не пуста`);
    if (!solution['main.ts'] && !meta.noSolution) warnings.push(`${where}: нет solution/main.ts — кнопки «Решение» не будет`);

    const startFrom = meta.startFrom ?? 'previous';
    if (startFrom === 'previous') {
      if (!previousSolution) {
        errors.push(`${where}: первый шаг главы должен иметь startFrom: custom`);
      } else {
        const diff = sameFiles(previousSolution, start);
        if (diff.length) errors.push(`${where}: start/ отличается от solution/ предыдущего шага в файлах: ${diff.join(', ')}`);
      }
    }
    previousSolution = solution;
  }
}

for (const warning of warnings) console.warn(`⚠ ${warning}`);
for (const error of errors) console.error(`✗ ${error}`);
console.log(`Проверено шагов: ${stepCount}. Ошибок: ${errors.length}, предупреждений: ${warnings.length}.`);
process.exit(errors.length ? 1 : 0);
