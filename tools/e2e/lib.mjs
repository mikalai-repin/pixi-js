// Общие помощники браузерных проверок курса.
// Нужен запущенный dev-сервер (npm run dev) и установленный Chrome.
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import puppeteer from 'puppeteer-core';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTENT = resolve(ROOT, 'content');
export const OUT = resolve(ROOT, 'tools/e2e/out');
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(OUT, { recursive: true });

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function launch() {
  // swiftshader — программный WebGL: работает в headless без видеокарты
  return puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}

/** Компилирует все .ts из папки шага (start/ или solution/) в карту { 'main.js': код } для превью */
export function compileDir(dir) {
  const files = {};
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const { code } = transformSync(readFileSync(`${dir}/${name}`, 'utf8'), { loader: 'ts', format: 'esm', target: 'esnext' });
    files[name.replace(/\.ts$/, '.js')] = code;
  }
  return files;
}

/**
 * Открывает чистую среду превью (без интерфейса платформы) размером 500 × 600 — как превью по умолчанию —
 * и запускает в ней карту файлов. Возвращает страницу и массив логов консоли.
 */
export async function openPreview(browser, files, { waitMs = 2500, width = 500, height = 600 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  const logs = [];
  page.on('console', (m) => {
    if (!m.text().includes('GL Driver')) logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${BASE_URL}/preview.html`, { waitUntil: 'networkidle0' });
  // Ошибки сборки модулей (например, циклический импорт) среда превью отправляет родительскому окну,
  // а в чистом превью родитель — само окно. Копим их в массиве: через console нельзя, перехваченный
  // console.error сам отправляет такое же сообщение, и получился бы бесконечный цикл
  await page.evaluate(() => {
    window.__runtimeErrors = [];
    window.addEventListener('message', (e) => {
      if (e.data?.source === 'pixi-course-preview' && e.data.type === 'error') window.__runtimeErrors.push(e.data.text);
    });
  });
  await page.evaluate((files) => window.postMessage({ type: 'run', files, entry: 'main.js' }, '*'), files);
  await wait(waitMs);
  for (const text of await page.evaluate(() => window.__runtimeErrors.splice(0))) logs.push(`[runtime-error] ${text}`);
  return { page, logs };
}

/** Центр клетки поля в координатах страницы превью 500 × 600 (поле 9 × 7, клетка 50, в центре экрана) */
export const cellCenter = (row, column) => ({ x: 250 + column * 50 - 150, y: 300 + row * 50 - 200 });

export async function swipe(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 5 });
  await page.mouse.up();
  await wait(300);
}
