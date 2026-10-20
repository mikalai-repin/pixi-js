// Проверка оформления платформы: загрузчик до запуска, тема и палитра по умолчанию, подсветка кода темой курса
// (редактор и текст урока), липкая строка главы, выбор палитры и темы с сохранением после перезагрузки.
// node tools/e2e/checks/platform.mjs
import { BASE_URL, OUT, launch, wait } from '../lib.mjs';

const STORAGE_KEY = 'pixi-course:v1';
const ROUTE = '/first-app/application';
const STEP_ID = 'first-app/application';
// Код с ключевым словом, классом, вызовом метода и числом — у каждого свой цвет в теме курса
const CODE = `import { Application } from 'pixi.js';

const app = new Application();
await app.init({ background: 0x1099bb });
`;

let failed = 0;
const expect = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failed++;
};

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

// Чистый localStorage, кроме кода шага — без темы и палитры, то есть значения по умолчанию
await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
await page.evaluate(
  (key, id, code) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({ steps: { [id]: { code: { 'main.ts': code } } } }));
  },
  STORAGE_KEY,
  STEP_ID,
  CODE,
);

// Загрузчик из index.html виден до запуска JavaScript, и уже в цветах сохранённой темы
await page.setJavaScriptEnabled(false);
await page.goto(`${BASE_URL}${ROUTE}`, { waitUntil: 'domcontentloaded' });
const boot = await page.evaluate(() => {
  const el = document.querySelector('.boot');
  return el && { text: el.textContent.trim(), bg: getComputedStyle(el).backgroundColor };
});
await page.screenshot({ path: `${OUT}/platform-boot.png` });
expect(boot?.text === 'Загружаем курс…', `загрузчик до запуска JavaScript: ${JSON.stringify(boot)}`);
// Тема — после запуска скрипта в index.html; без JavaScript его нет, проверяем ниже по data-theme после перезагрузки
await page.setJavaScriptEnabled(true);

await page.goto(`${BASE_URL}${ROUTE}`, { waitUntil: 'networkidle0' });
await page.waitForSelector('.monaco-editor .view-line');
await wait(2500);

const look = () =>
  page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      theme: document.documentElement.dataset.theme,
      palette: document.documentElement.dataset.palette ?? null,
      accent: style.getPropertyValue('--accent').trim(),
      bg: style.getPropertyValue('--bg').trim(),
      editor: getComputedStyle(document.querySelector('.monaco-editor .monaco-editor-background')).backgroundColor,
    };
  });

const defaults = await look();
expect(
  defaults.theme === 'dark' && defaults.palette === null && defaults.accent === '#f06595' && defaults.bg === '#14121b',
  `по умолчанию — тёмная тема и палитра «PixiJS» ${JSON.stringify(defaults)}`,
);
expect(defaults.editor === 'rgb(25, 23, 34)', `редактор в тёмной теме курса (course-dark): ${defaults.editor}`);

// Подсветка в редакторе (Shiki, src/editor/course-themes.ts): фрагменты одного цвета Monaco склеивает,
// поэтому сравниваем по обрезанному тексту фрагмента
const editorColors = () =>
  page.evaluate(() => {
    const spans = [...document.querySelectorAll('.monaco-editor .view-line span span')];
    // Последнее вхождение: `Application` сначала встречается в import (там это просто имя), потом — после new
    const color = (text) => {
      const span = spans.findLast((s) => s.textContent.trim() === text);
      return span ? getComputedStyle(span).color : null;
    };
    return { keyword: color('new'), type: color('Application'), fn: color('init'), number: color('0x1099bb') };
  });
const dark = await editorColors();
expect(
  dark.keyword === 'rgb(177, 151, 252)' &&
    dark.type === 'rgb(102, 217, 232)' &&
    dark.fn === 'rgb(247, 131, 172)' &&
    dark.number === 'rgb(255, 169, 77)',
  `редактор: ключевое слово, класс, метод, число — цвета темы курса ${JSON.stringify(dark)}`,
);

// Код в тексте урока — той же темой
const lessonCode = await page.evaluate(() => {
  const span = [...document.querySelectorAll('.lesson-content .shiki span')].find((s) => s.textContent.trim() === 'new');
  return span ? getComputedStyle(span).color : null;
});
expect(lessonCode === 'rgb(177, 151, 252)', `код в тексте урока — та же тема: ${lessonCode}`);
await page.screenshot({ path: `${OUT}/platform-dark.png` });

// Строка главы с «Свернуть» прилипает к верху панели урока при прокрутке
await page.$eval('.lesson-scroll', (e) => e.scrollTo(0, 600));
await wait(300);
const stuck = await page.$eval('.lesson-chapter-row', (e) => ({
  top: Math.round(e.getBoundingClientRect().top - e.parentElement.getBoundingClientRect().top),
  scrolled: e.parentElement.classList.contains('scrolled'),
  button: Boolean(e.querySelector('.pane-collapse')),
}));
expect(
  stuck.top === 0 && stuck.scrolled && stuck.button,
  `строка главы с «Свернуть» прилипла к верху урока ${JSON.stringify(stuck)}`,
);
await page.screenshot({ path: `${OUT}/platform-sticky.png` });
await page.$eval('.lesson-scroll', (e) => e.scrollTo(0, 0));

// Палитра: выбор в шапке меняет цвета сразу и сохраняется (применяется до запуска приложения)
const choosePalette = async (name) => {
  await page.click('.palette summary');
  await page.evaluate(
    (name) => [...document.querySelectorAll('.palette-option')].find((b) => b.textContent.includes(name)).click(),
    name,
  );
  await wait(200);
};
await choosePalette('Изумрудная');
expect((await look()).accent === '#4fd1a1', `выбрана «Изумрудная» (тёмная): ${(await look()).accent}`);
await page.reload({ waitUntil: 'domcontentloaded' });
const early = await page.evaluate(() => document.documentElement.dataset.palette);
await page.waitForSelector('.monaco-editor .view-line');
await wait(1500);
expect(
  early === 'emerald' && (await look()).accent === '#4fd1a1',
  `палитра сохранилась после перезагрузки и применена до запуска (${early})`,
);
await page.screenshot({ path: `${OUT}/platform-palette.png` });
await choosePalette('PixiJS');
expect((await look()).accent === '#f06595', 'обратно на «PixiJS»');

// Тема: кнопка ☀/☾ переключает светлую и тёмную вместе с редактором; выбор сохраняется
await page.click('.theme-toggle');
await wait(400);
const light = await look();
expect(
  light.theme === 'light' && light.bg === '#f6f5f9' && light.editor === 'rgb(255, 255, 255)',
  `кнопка темы: тёмная → светлая, редактор тоже ${JSON.stringify(light)}`,
);
const lightColors = await editorColors();
expect(
  lightColors.keyword === 'rgb(103, 65, 217)' &&
    lightColors.type === 'rgb(11, 114, 133)' &&
    lightColors.fn === 'rgb(194, 37, 92)',
  `светлая тема кода в редакторе ${JSON.stringify(lightColors)}`,
);
await page.screenshot({ path: `${OUT}/platform-light.png` });
await page.reload({ waitUntil: 'domcontentloaded' });
const lightEarly = await page.evaluate(() => document.documentElement.dataset.theme);
await page.waitForSelector('.monaco-editor .view-line');
await wait(1500);
expect(lightEarly === 'light', `светлая тема сохранилась и применена до запуска (${lightEarly})`);
await page.click('.theme-toggle');
await wait(300);
expect((await look()).theme === 'dark', 'обратно на тёмную');

expect(pageErrors.length === 0, `без ошибок на странице ${JSON.stringify(pageErrors)}`);

await browser.close();
console.log(failed ? `\nПровалено: ${failed}` : '\nВсё прошло');
process.exit(failed ? 1 : 0);
