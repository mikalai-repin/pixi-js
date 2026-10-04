// Проверка контента курса: структура шагов и цепочка шагов. Шаг хранит только изменённые файлы
// (scripts/step-files.mjs): в start/ — отличия от результата предыдущего шага, в solution/ — отличия от старта.
// Полные снимки всех шагов записываются в .steps/<глава>/<шаг>/{start,solution}: по ним
// `tsc -p tsconfig.content.json` проверяет типы, и их удобно смотреть глазами.
// Запуск: npm run validate
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { readBase, readFiles, readSolution, readStart, writeFiles } from './step-files.mjs';

const root = join(import.meta.dirname, '..', 'content');
const errors = [];
const warnings = [];

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();

const course = JSON.parse(readFileSync(join(root, 'course.json'), 'utf8'));
const snapshots = join(import.meta.dirname, '..', '.steps');
rmSync(snapshots, { recursive: true, force: true });
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
    const base = readBase(stepPath);
    const ownStart = readFiles(join(stepPath, 'start'));
    const remove = meta.remove ?? [];
    for (const name of remove) if (!(name in base)) errors.push(`${where}: remove: ${name} — такого файла нет в результате предыдущего шага`);
    for (const [name, text] of Object.entries(ownStart)) {
      if (base[name] === text) errors.push(`${where}: start/${name} совпадает с результатом предыдущего шага — удалите копию`);
    }
    const changesStart = Object.keys(ownStart).length > 0 || remove.length > 0;
    if (startFrom === 'previous' && changesStart) errors.push(`${where}: есть start/ или remove — нужен startFrom: custom`);
    if (startFrom === 'custom' && !changesStart) errors.push(`${where}: startFrom: custom, но старт совпадает с результатом предыдущего шага — уберите startFrom`);

    const start = readStart(stepPath);
    const ownSolution = readFiles(join(stepPath, 'solution'));
    for (const [name, text] of Object.entries(ownSolution)) {
      if (start[name] === text) errors.push(`${where}: solution/${name} совпадает со стартом — удалите копию`);
    }
    const solution = readSolution(stepPath);
    writeFiles(join(snapshots, where, 'start'), start);
    writeFiles(join(snapshots, where, 'solution'), solution);
    if (!start['main.ts']) errors.push(`${where}: в старте нет main.ts`);
    if (meta.noSolution && Object.keys(solution).length) errors.push(`${where}: noSolution: true, но папка solution/ не пуста`);
    if (!Object.keys(solution).length && !meta.noSolution) warnings.push(`${where}: нет solution/ — кнопки «Решение» не будет`);
  }
}

for (const warning of warnings) console.warn(`⚠ ${warning}`);
for (const error of errors) console.error(`✗ ${error}`);
console.log(`Проверено шагов: ${stepCount}. Ошибок: ${errors.length}, предупреждений: ${warnings.length}.`);
process.exit(errors.length ? 1 : 0);
