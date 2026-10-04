import { parse as parseYaml } from 'yaml';

/** Набор файлов шага: имя файла → исходный код */
export type FileMap = Record<string, string>;

export interface StepMeta {
  title: string;
  files?: string[];
  readonly?: string[];
  focus?: string;
  startFrom?: 'previous' | 'custom';
  /** Файлы базы (результата предыдущего шага), которых нет в старте этого шага */
  remove?: string[];
  api?: string[];
  /** Шаг без задания (демо, теория): кнопки «Решение» нет */
  noSolution?: boolean;
}

export interface Step {
  /** Уникальный id для хранения прогресса: «sprites/anchor» */
  id: string;
  /** Папка на диске: «02-sprites/04-anchor» */
  dir: string;
  slug: string;
  /** Номер шага внутри главы, с нуля */
  index: number;
  meta: StepMeta;
  body: string;
  start: FileMap;
  solution: FileMap;
  /** Порядок вкладок в редакторе */
  fileOrder: string[];
  chapter: Chapter;
}

export interface Chapter {
  dir: string;
  slug: string;
  index: number;
  title: string;
  description: string;
  part: number;
  steps: Step[];
}

export interface Course {
  title: string;
  pixiVersion: string;
  chapters: Chapter[];
}

// Vite собирает весь content/ в бандл на этапе сборки
const raw = import.meta.glob<string>('/content/**/*', { query: '?raw', import: 'default', eager: true });

const stripOrder = (dir: string) => dir.replace(/^\d+-/, '');

function readJson<T>(path: string): T {
  const text = raw[path];
  if (text === undefined) throw new Error(`[content] не найден файл ${path}`);
  return JSON.parse(text) as T;
}

function parseLesson(path: string): { meta: StepMeta; body: string } {
  const text = raw[path];
  if (text === undefined) throw new Error(`[content] не найден файл ${path}`);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`[content] нет frontmatter в ${path}`);
  try {
    return { meta: parseYaml(match[1]) as StepMeta, body: match[2] };
  } catch (error) {
    throw new Error(`[content] ошибка YAML во frontmatter ${path}: ${(error as Error).message}`);
  }
}

function collectFiles(prefix: string): FileMap {
  const files: FileMap = {};
  for (const [path, text] of Object.entries(raw)) {
    if (path.startsWith(prefix)) files[path.slice(prefix.length)] = text;
  }
  return files;
}

function orderFiles(meta: StepMeta, files: FileMap): string[] {
  const names = Object.keys(files);
  const ordered = meta.files ? meta.files.filter((name) => name in files) : [...names].sort();
  for (const name of names) if (!ordered.includes(name)) ordered.push(name);
  // main.ts — всегда первая вкладка
  return ordered.sort((a, b) => Number(b === 'main.ts') - Number(a === 'main.ts'));
}

// Шаг хранит только то, что в нём меняется (так же считает scripts/step-files.mjs):
//   база     — результат предыдущего шага курса, через границы глав;
//   старт    — база без файлов из meta.remove, поверх неё — файлы из start/;
//   решение  — старт, поверх него — файлы из solution/ (нет solution/ — нет решения);
//   результат — решение, а у шага без решения — старт.
// Так в content/ нет копий одних и тех же файлов
function loadCourse(): Course {
  let previousResult: FileMap = {};
  const courseJson = readJson<{ title: string; pixiVersion: string; chapters: string[] }>('/content/course.json');

  const chapters = courseJson.chapters.map((chapterDir, chapterIndex): Chapter => {
    const info = readJson<{ title: string; description: string; part: number }>(`/content/${chapterDir}/chapter.json`);
    const chapter: Chapter = {
      dir: chapterDir,
      slug: stripOrder(chapterDir),
      index: chapterIndex,
      title: info.title,
      description: info.description,
      part: info.part,
      steps: [],
    };

    const stepDirs = new Set<string>();
    const prefix = `/content/${chapterDir}/`;
    for (const path of Object.keys(raw)) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length).split('/');
      if (rest.length > 1) stepDirs.add(rest[0]);
    }

    chapter.steps = [...stepDirs].sort().map((stepDir, index): Step => {
      const base = `${prefix}${stepDir}/`;
      const { meta, body } = parseLesson(`${base}lesson.md`);
      const start: FileMap = { ...previousResult };
      for (const name of meta.remove ?? []) delete start[name];
      Object.assign(start, collectFiles(`${base}start/`));
      const ownSolution = collectFiles(`${base}solution/`);
      const solution: FileMap = Object.keys(ownSolution).length ? { ...start, ...ownSolution } : {};
      previousResult = Object.keys(solution).length ? solution : start;
      return {
        id: `${chapter.slug}/${stripOrder(stepDir)}`,
        dir: `${chapterDir}/${stepDir}`,
        slug: stripOrder(stepDir),
        index,
        meta,
        body,
        start,
        solution,
        fileOrder: orderFiles(meta, { ...solution, ...start }),
        chapter,
      };
    });

    return chapter;
  });

  return { title: courseJson.title, pixiVersion: courseJson.pixiVersion, chapters };
}

export const course = loadCourse();

/** Все шаги курса подряд — для кнопок «Назад/Далее» через границы глав */
export const allSteps: Step[] = course.chapters.flatMap((chapter) => chapter.steps);

export function findStep(chapterSlug?: string, stepSlug?: string): Step | undefined {
  return allSteps.find((step) => step.chapter.slug === chapterSlug && step.slug === stepSlug);
}

export function stepPath(step: Step): string {
  return `/${step.chapter.slug}/${step.slug}`;
}

/** «02-sprites/04-anchor» → шаг; используется для ссылок `step:` в markdown */
export function findStepByDir(dir: string): Step | undefined {
  return allSteps.find((step) => step.dir === dir);
}
