import react from '@vitejs/plugin-react';
import { readdirSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * Виртуальный модуль со списком файлов public/assets: кнопка «Скачать проект» кладёт в архив
 * ресурсы, на которые ссылается код. Список читается при каждой загрузке модуля
 */
function assetList(): Plugin {
  const id = 'virtual:asset-list';
  return {
    name: 'asset-list',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load(resolved) {
      if (resolved !== `\0${id}`) return;
      const files = readdirSync('public/assets', { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
        .map((entry) => `${entry.parentPath}/${entry.name}`.replace(/^public\/assets\//, ''))
        .sort();
      return `export default ${JSON.stringify(files)};`;
    },
  };
}

export default defineConfig({
  plugins: [react(), assetList()],
  server: { port: 5173 },
  optimizeDeps: {
    entries: ['index.html'],
    // Модули, которые грузятся динамически: без явного списка Vite находит их уже после старта,
    // пересобирает зависимости и ломает открытую страницу
    include: [
      'monaco-editor',
      'shiki/core',
      'shiki/engine/javascript',
      'shiki/themes/github-light.mjs',
      'shiki/themes/github-dark.mjs',
      'shiki/langs/typescript.mjs',
      'shiki/langs/javascript.mjs',
      'shiki/langs/json.mjs',
      'shiki/langs/html.mjs',
      'shiki/langs/css.mjs',
      'shiki/langs/bash.mjs',
      'shiki/langs/glsl.mjs',
      // Prettier грузится лениво при первом форматировании
      'prettier/standalone',
      'prettier/plugins/typescript',
      'prettier/plugins/estree',
    ],
  },
});
