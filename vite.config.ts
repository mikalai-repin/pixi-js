import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
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
