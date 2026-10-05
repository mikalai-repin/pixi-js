import assetFiles from 'virtual:asset-list';
import coursePackage from '../../package.json';
import type { FileMap, Step } from '../content/course';
import { createZip, type ZipEntry } from './zip';

/** Библиотеки, которые код ученика может импортировать, — с версиями, на которых работает курс */
const LIBRARIES = ['pixi.js', 'gsap', '@pixi/ui', 'pixi-filters', '@pixi/sound', '@esotericsoftware/spine-pixi-v8'];
const VERSIONS: Record<string, string> = { ...coursePackage.devDependencies, ...coursePackage.dependencies };
/** Точная версия без ^ и ~: проект должен работать на тех же версиях, что и курс */
const exact = (name: string) => VERSIONS[name].replace(/^[\^~]/, '');

const INDEX_HTML = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PixiJS</title>
    <link rel="icon" href="data:," />
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        overflow: hidden;
        background: #0e0a1a;
      }
      canvas {
        display: block;
      }
    </style>
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;

// Без erasableSyntaxOnly: код курса использует свойства в параметрах конструктора (см. шаг 15.7)
const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
`;

const GLOBALS = `// Ссылка на приложение для расширения браузера PixiJS DevTools: main.ts пишет её в globalThis.__PIXI_APP__
declare var __PIXI_APP__: import('pixi.js').Application | undefined;
`;

function readme(step: Step, assets: boolean, spine: boolean) {
  return `# ${step.chapter.title}: ${step.meta.title}

Код шага курса «PixiJS — интерактивный курс» как обычный проект [Vite](https://vite.dev).

\`\`\`bash
npm install
npm run dev      # http://localhost:5173
npm run build    # продакшен-сборка в dist/
\`\`\`

Код — в \`src/\` (точка входа \`src/main.ts\`).${
    assets
      ? ` Ресурсы — в \`public/assets/\`: Vite отдаёт папку \`public/\` как есть, поэтому код находит их по путям \`/assets/...\`. Откуда они и под какой лицензией — в \`public/assets/CREDITS.md\`.`
      : ''
  }${
    spine
      ? `\n\nПроект использует Spine Runtimes (\`@esotericsoftware/spine-pixi-v8\`): у них своя лицензия, не MIT. Прежде чем публиковать игру, прочитайте её: https://esotericsoftware.com/spine-runtimes-license`
      : ''
  }
`;
}

/** Какие библиотеки импортирует код: только они попадут в package.json */
function usedLibraries(files: FileMap) {
  const code = Object.values(files).join('\n');
  return LIBRARIES.filter((name) => code.includes(`'${name}'`) || code.includes(`"${name}"`));
}

/** Ресурсы, на которые ссылается код: целые папки public/assets/<папка>, плюс сведения об авторах */
function usedAssets(files: FileMap) {
  const code = Object.values(files).join('\n');
  const folders = new Set([...code.matchAll(/\/assets\/([\w-]+)\//g)].map((match) => match[1]));
  if (folders.size === 0) return [];
  return assetFiles.filter((path) => {
    const folder = path.split('/')[0];
    return folders.has(folder) || path === 'CREDITS.md';
  });
}

function packageJson(step: Step, libraries: string[]) {
  const dependencies = Object.fromEntries(libraries.map((name) => [name, exact(name)]));
  return `${JSON.stringify(
    {
      name: `pixi-course-${step.chapter.slug}-${step.slug}`,
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
      dependencies,
      devDependencies: { typescript: '~6.0.0', vite: VERSIONS.vite },
    },
    null,
    2,
  )}\n`;
}

/**
 * Собирает код шага в архив проекта Vite и отдаёт браузеру на скачивание:
 * код — в src/, ресурсы, на которые он ссылается, — в public/assets/
 */
export async function downloadProject(step: Step, files: FileMap) {
  const encoder = new TextEncoder();
  const text = (path: string, content: string): ZipEntry => ({ path, data: encoder.encode(content) });
  const root = `${step.chapter.slug}-${step.slug}`;

  const assets = usedAssets(files);
  const libraries = usedLibraries(files);
  const entries: ZipEntry[] = [
    text('package.json', packageJson(step, libraries)),
    text('index.html', INDEX_HTML),
    text('tsconfig.json', TSCONFIG),
    text('.gitignore', 'node_modules\ndist\n'),
    text('README.md', readme(step, assets.length > 0, libraries.includes('@esotericsoftware/spine-pixi-v8'))),
    text('src/globals.d.ts', GLOBALS),
    ...Object.entries(files).map(([name, code]) => text(`src/${name}`, code)),
  ];
  const downloaded = await Promise.all(
    assets.map(async (path) => {
      const response = await fetch(`/assets/${path}`);
      if (!response.ok) throw new Error(`Не удалось загрузить /assets/${path}: ${response.status}`);
      return { path: `public/assets/${path}`, data: new Uint8Array(await response.arrayBuffer()) };
    }),
  );
  entries.push(...downloaded);

  const zip = createZip(entries.map((entry) => ({ ...entry, path: `${root}/${entry.path}` })));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(zip);
  link.download = `${root}.zip`;
  link.click();
  // Ссылка уже отработала: освобождаем память архива чуть позже, когда браузер начал скачивание
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}
