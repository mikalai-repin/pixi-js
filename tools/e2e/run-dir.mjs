// Запускает код из папки шага в чистом превью, печатает консоль и сохраняет скриншот.
// node tools/e2e/run-dir.mjs content/04-graphics/08-mask/solution [ждатьМс]
import { resolve, basename, dirname } from 'node:path';
import { compileDir, launch, openPreview, OUT, ROOT } from './lib.mjs';

const [dirArg, waitMs = '2500'] = process.argv.slice(2);
if (!dirArg) {
  console.error('Использование: node tools/e2e/run-dir.mjs <папка с .ts> [ждатьМс]');
  process.exit(1);
}
const dir = resolve(ROOT, dirArg);
const browser = await launch();
const { page, logs } = await openPreview(browser, compileDir(dir), { waitMs: Number(waitMs) });
const shot = `${OUT}/${basename(dirname(dir))}-${basename(dir)}.png`;
await page.screenshot({ path: shot });
for (const line of logs) console.log(line);
console.log(`скриншот: ${shot}`);
await browser.close();
