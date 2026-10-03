// Прогон эксперимента из текста урока: node tools/e2e/exp.mjs <папка с .ts> <абсолютный путь к сценарию.mjs> [ждатьМс]
// Сценарий — модуль с export default async ({ page, logs, findMove, swipeRight, wait, cellCenter }) => {…}
import { compileDir, launch, openPreview, cellCenter, wait } from './lib.mjs';
const [dir, scenario, waitMs = '3000'] = process.argv.slice(2);
const browser = await launch();
const { page, logs } = await openPreview(browser, compileDir(dir), { waitMs: Number(waitMs) });
const findMove = (valid) => page.evaluate((valid) => {
  const grid = __PIXI_APP__.stage.getChildByLabel('board').grid; const R = grid.length, Cn = grid[0].length;
  const has = (g) => { for (let r = 0; r < R; r++) for (let c = 0; c < Cn - 2; c++) if (g[r][c] && g[r][c] === g[r][c+1] && g[r][c] === g[r][c+2]) return true;
    for (let c = 0; c < Cn; c++) for (let r = 0; r < R - 2; r++) if (g[r][c] && g[r][c] === g[r+1][c] && g[r][c] === g[r+2][c]) return true; return false; };
  for (let r = 0; r < R; r++) for (let c = 0; c < Cn - 1; c++) { const g = grid.map((x) => x.slice()); [g[r][c], g[r][c+1]] = [g[r][c+1], g[r][c]]; if (has(g) === valid) return { row: r, column: c }; }
  return null; }, valid);
async function swipeRight(m) { const f = cellCenter(m.row, m.column); await page.mouse.move(f.x, f.y); await page.mouse.down(); await page.mouse.move(f.x + 30, f.y, { steps: 5 }); await page.mouse.up(); }
const ctx = { page, logs, findMove, swipeRight, wait, cellCenter };
const mod = await import(scenario);
await mod.default(ctx);
console.log(logs.filter((l) => !l.includes('Сетка') && !l.startsWith('[log] |')).join('\n'));
await browser.close();
