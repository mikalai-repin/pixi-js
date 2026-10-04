// Проверка контента курса: структура шагов и цепочка шагов (у шага startFrom: previous нет папки start/,
// его старт — результат предыдущего шага: scripts/step-files.mjs).
// Запуск: npm run validate (типы кода уроков проверяет отдельно `tsc -p tsconfig.content.json`)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { readFiles, readResult, readStart } from './step-files.mjs';

const root = join(import.meta.dirname, '..', 'content');
const errors = [];
const warnings = [];

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();

const course = JSON.parse(readFileSync(join(root, 'course.json'), 'utf8'));
let stepCount = 0;

for (const chapterDir of course.chapters) {
  const chapterPath = join(root, chapterDir);
  if (!existsSync(join(chapterPath, 'chapter.json'))) {
    errors.push(`${chapterDir}: нет chapter.json`);
    continue;
  }

  const steps = readdirSync(chapterPath).filter((name) => isDir(join(chapterPath, name))).sort();

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

    const startFrom = meta.startFrom ?? 'previous';
    const solution = readFiles(join(stepPath, 'solution'));
    if (startFrom === 'previous') {
      const index = steps.indexOf(stepDir);
      if (index === 0) errors.push(`${where}: первый шаг главы должен иметь startFrom: custom`);
      else if (isDir(join(stepPath, 'start'))) {
        const same =
          JSON.stringify(readFiles(join(stepPath, 'start'))) === JSON.stringify(readResult(join(chapterPath, steps[index - 1])));
        errors.push(
          `${where}: startFrom: previous, но есть папка start/ — ${same ? 'это копия результата предыдущего шага, удалите её' : 'она отличается от результата предыдущего шага: нужен startFrom: custom'}`,
        );
      }
    }
    const start = startFrom === 'previous' ? readStart(stepPath) : readFiles(join(stepPath, 'start'));
    if (!start['main.ts']) errors.push(`${where}: нет start/main.ts`);
    if (meta.noSolution && Object.keys(solution).length) errors.push(`${where}: noSolution: true, но папка solution/ не пуста`);
    if (!solution['main.ts'] && !meta.noSolution) warnings.push(`${where}: нет solution/main.ts — кнопки «Решение» не будет`);

  }
}

for (const warning of warnings) console.warn(`⚠ ${warning}`);
for (const error of errors) console.error(`✗ ${error}`);
console.log(`Проверено шагов: ${stepCount}. Ошибок: ${errors.length}, предупреждений: ${warnings.length}.`);
process.exit(errors.length ? 1 : 0);
