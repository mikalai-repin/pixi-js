// Проверка главы 7: модель и вид согласованы после неверных и верных ходов, каскады, юнит-тесты практикума.
// node tools/e2e/checks/ch07-logic.mjs
import { CONTENT, cellCenter, compileDir, launch, openPreview, swipe } from '../lib.mjs';

const C = `${CONTENT}/07-logic`;
const browser = await launch();
const open = (step) => openPreview(browser, compileDir(`${C}/${step}/solution`), { waitMs: 3000 });

/** Сверяет каждую клетку: фишка есть, стоит на месте, знает клетку и показывает тип из модели */
const inspect = (page) =>
  page.evaluate(() => {
    const board = __PIXI_APP__.stage.getChildByLabel('board');
    const grid = board.grid;
    const NAMES = ['piece-dragon', 'piece-frog', 'piece-newt', 'piece-snake', 'piece-spider', 'piece-yeti'];
    let mismatches = 0;
    let zeros = 0;
    let matches = 0;
    const R = grid.length;
    const Cn = grid[0].length;
    for (let r = 0; r < R; r++)
      for (let c = 0; c < Cn; c++) {
        if (grid[r][c] === 0) zeros++;
        const p = board.getPiece({ row: r, column: c });
        const pos = board.getViewPosition({ row: r, column: c });
        if (!p || p.label !== NAMES[grid[r][c] - 1] || p.row !== r || p.column !== c || p.x !== pos.x || p.y !== pos.y) mismatches++;
      }
    for (let r = 0; r < R; r++) for (let c = 0; c < Cn - 2; c++) if (grid[r][c] && grid[r][c] === grid[r][c + 1] && grid[r][c] === grid[r][c + 2]) matches++;
    for (let c = 0; c < Cn; c++) for (let r = 0; r < R - 2; r++) if (grid[r][c] && grid[r][c] === grid[r + 1][c] && grid[r][c] === grid[r + 2][c]) matches++;
    return { pieces: board.getChildByLabel('pieces').children.length, zeros, matches, mismatches, grid: grid.map((x) => x.join('')).join('/') };
  });

/** Ищет перебором горизонтальный обмен, который даёт (valid = true) или не даёт совпадение */
const findMove = (page, valid) =>
  page.evaluate((valid) => {
    const grid = __PIXI_APP__.stage.getChildByLabel('board').grid;
    const R = grid.length;
    const Cn = grid[0].length;
    const has = (g) => {
      for (let r = 0; r < R; r++) for (let c = 0; c < Cn - 2; c++) if (g[r][c] && g[r][c] === g[r][c + 1] && g[r][c] === g[r][c + 2]) return true;
      for (let c = 0; c < Cn; c++) for (let r = 0; r < R - 2; r++) if (g[r][c] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 2][c]) return true;
      return false;
    };
    for (let r = 0; r < R; r++)
      for (let c = 0; c < Cn - 1; c++) {
        const g = grid.map((x) => x.slice());
        [g[r][c], g[r][c + 1]] = [g[r][c + 1], g[r][c]];
        if (has(g) === valid) return { row: r, column: c };
      }
    return null;
  }, valid);
const swipeRight = (page, m) => swipe(page, cellCenter(m.row, m.column), 30, 0);

for (const step of ['02-create-grid', '04-valid-move', '05-pop', '06-gravity', '07-refill', '08-cascade']) {
  const { page, logs } = await open(step);
  const before = await inspect(page);
  const bad = await findMove(page, false);
  if (bad) await swipeRight(page, bad);
  const afterBad = await inspect(page);
  const good = await findMove(page, true);
  if (good) await swipeRight(page, good);
  const after = await inspect(page);
  console.log(`\n# ${step}`);
  console.log('  при старте:', { matches: before.matches, mismatches: before.mismatches, zeros: before.zeros }, '— ожидаем все нули');
  console.log('  неверный ход не изменил сетку:', before.grid === afterBad.grid, step === '02-create-grid' ? '(в шаге 2 проверки хода ещё нет)' : '');
  const { grid, ...rest } = after;
  console.log('  после верного хода:', rest);
  console.log('  последние логи:', logs.filter((l) => !l.includes('Сетка')).slice(-3));
  await page.close();
}
{
  const { page, logs } = await open('08-cascade');
  for (let i = 0; i < 15; i++) {
    const m = await findMove(page, true);
    if (!m) break;
    await swipeRight(page, m);
  }
  const { grid, ...rest } = await inspect(page);
  console.log('\n# 08 после 15 ходов:', rest, '— ожидаем 63 фишки и нули; комбо:', logs.filter((l) => l.includes('Комбо')).length, 'ошибки:', logs.filter((l) => l.startsWith('[pageerror]')));
  await page.close();
}
{
  const { page, logs } = await open('09-practice');
  console.log('\n# 09 тесты:', logs.filter((l) => /[✓✗]|Тестов/.test(l)));
  await page.close();
}
await browser.close();
