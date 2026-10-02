// Проходит все шаги главы в настоящем интерфейсе платформы: открывает шаг, нажимает «Решение»,
// печатает консоль превью, битые ссылки и ошибки страницы, сохраняет скриншоты.
// node tools/e2e/run-chapter.mjs 05-assets [ширина]
import { readdirSync, statSync } from 'node:fs';
import { BASE_URL, CONTENT, OUT, launch, wait } from './lib.mjs';

const [chapterDir, width = '1600'] = process.argv.slice(2);
if (!chapterDir) {
  console.error('Использование: node tools/e2e/run-chapter.mjs <папка главы, например 05-assets> [ширина окна]');
  process.exit(1);
}
const strip = (d) => d.replace(/^\d+-/, '');
const root = `${CONTENT}/${chapterDir}`;
const steps = readdirSync(root).filter((d) => statSync(`${root}/${d}`).isDirectory()).sort();

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: Number(width), height: 900 });
page.on('dialog', (d) => d.accept());
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());

for (const step of steps) {
  const url = `${BASE_URL}/${strip(chapterDir)}/${strip(step)}`;
  await page.goto(url, { waitUntil: 'networkidle0' });
  await wait(2500);
  const button = await page.$('.lesson-footer-middle .button');
  if (button && (await button.evaluate((e) => e.textContent)) === 'Решение') {
    await button.click();
    await wait(3500);
  }
  await page.screenshot({ path: `${OUT}/${chapterDir}-${step}.png` });
  const lines = await page.$$eval('.console-line', (els) => els.map((e) => e.className.replace('console-line console-', '') + ': ' + e.textContent));
  const broken = await page.$$eval('.broken-link', (e) => e.length);
  const title = await page.$eval('.lesson-title-row h1', (e) => e.textContent).catch(() => '!! страница урока не отрисовалась');
  console.log(`\n# ${step} — ${title}${page.url() !== url ? ` (переадресация на ${page.url()})` : ''}`);
  for (const line of lines) console.log('  ' + line.slice(0, 300));
  if (broken) console.log('  !! битых ссылок step:', broken);
}
console.log('\nОшибки страницы:', pageErrors);
console.log(`Скриншоты: ${OUT}`);
await browser.close();
