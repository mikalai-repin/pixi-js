// Проверка главы 8: подсветка вращается, отладочные клавиши меняют тикер, анимированные ходы и каскады
// оставляют модель и вид согласованными, неверный ход возвращает фишки, killTweensOf, обратный отсчёт.
// node tools/e2e/checks/ch08-animation.mjs
import { CONTENT, cellCenter, compileDir, launch, openPreview, wait } from '../lib.mjs';

const C = `${CONTENT}/08-animation`;
const browser = await launch();
const open = (step, waitMs = 3000) => openPreview(browser, compileDir(`${C}/${step}/solution`), { waitMs });

/** Сверяет каждую клетку: фишка есть, стоит на месте, знает клетку, показывает тип из модели и непрозрачна */
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
        if (!p || p.destroyed || p.alpha !== 1 || p.label !== NAMES[grid[r][c] - 1] || p.row !== r || p.column !== c || p.x !== pos.x || p.y !== pos.y)
          mismatches++;
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

const processing = (page) => page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board').processing);

/** Свайп вправо без ожидания: сразу после него анимация ещё идёт */
async function swipeRight(page, m) {
  const from = cellCenter(m.row, m.column);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y, { steps: 5 });
  await page.mouse.up();
}

/** Ждёт конца хода и возвращает его длительность в мс */
async function waitIdle(page) {
  const t0 = Date.now();
  while (await processing(page)) await wait(50);
  return Date.now() - t0;
}

const pageErrors = (logs) => logs.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]'));

// --- 8.1: подсветка выбранной фишки вращается, у невыбранной — нет ---
{
  const { page, logs } = await open('01-ticker');
  const c = cellCenter(4, 3);
  await page.mouse.click(c.x, c.y);
  const read = () =>
    page.evaluate(() => {
      const p = __PIXI_APP__.stage.getChildByLabel('board').getPiece({ row: 4, column: 3 });
      const other = __PIXI_APP__.stage.getChildByLabel('board').getPiece({ row: 0, column: 0 });
      return { highlight: p.children[0].rotation, image: p.children[1].rotation, other: other.children[0].rotation, listeners: __PIXI_APP__.ticker.count };
    });
  const a = await read();
  await wait(1000);
  const b = await read();
  console.log('# 01 поворот подсветки за ~1 с:', (b.highlight - a.highlight).toFixed(2), 'рад (ожидаем ~1.8), зелье покачивается:', a.image !== b.image, 'у невыбранной:', b.other, 'слушателей тикера:', b.listeners);
  // Отписка при уничтожении: ход убирает фишки, число слушателей не должно расти
  for (let i = 0; i < 3; i++) {
    const m = await findMove(page, true);
    if (m) await swipeRight(page, m);
    await wait(300);
  }
  console.log('  слушателей после трёх ходов:', (await read()).listeners, 'ошибки:', pageErrors(logs));
  await page.close();
}

// --- 8.2: клавиши меняют тикер; поворот за секунду не зависит от FPS ---
{
  const { page, logs } = await open('02-fps');
  const c = cellCenter(4, 3);
  await page.mouse.click(c.x, c.y);
  const measure = async () => {
    const r0 = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board').getPiece({ row: 4, column: 3 }).children[0].rotation);
    const t0 = Date.now();
    await wait(2000);
    const r1 = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board').getPiece({ row: 4, column: 3 }).children[0].rotation);
    return ((r1 - r0) / ((Date.now() - t0) / 1000)).toFixed(2);
  };
  const fpsOf = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          let n = 0;
          const f = () => n++;
          __PIXI_APP__.ticker.add(f);
          setTimeout(() => {
            __PIXI_APP__.ticker.remove(f);
            resolve(n);
          }, 1000);
        }),
    );
  console.log('# 02 обычный режим: рад/с', await measure(), 'кадров/с', await fpsOf());
  await page.keyboard.press('2');
  console.log('  клавиша 2: рад/с', await measure(), 'кадров/с', await fpsOf());
  await page.keyboard.press('3');
  console.log('  клавиша 3: рад/с', await measure(), 'кадров/с', await fpsOf());
  await page.keyboard.press('1');
  console.log('  клавиша 1: рад/с', await measure());
  console.log('  логи клавиш:', logs.filter((l) => l.includes('maxFPS')), 'ошибки:', pageErrors(logs));
  await page.close();
}

// --- 8.3–8.9: анимированные ходы ---
for (const step of ['03-tween', '04-easing', '05-async-cascade', '06-on-render', '07-tiling-sprite', '08-gsap', '09-animated-sprite']) {
  const { page, logs } = await open(step, step === '09-animated-sprite' ? 7500 : 3000);
  console.log(`\n# ${step}`);
  // Неверный ход
  const before = await inspect(page);
  const bad = await findMove(page, false);
  await swipeRight(page, bad);
  await wait(60);
  const midBad = await page.evaluate((m) => {
    const board = __PIXI_APP__.stage.getChildByLabel('board');
    const p = board.getPiece(m);
    return { processing: board.processing, x: p.x, target: board.getViewPosition(m).x };
  }, bad);
  const badMs = await waitIdle(page);
  const afterBad = await inspect(page);
  console.log('  неверный ход: во время анимации processing =', midBad.processing, ', сетка не изменилась:', before.grid === afterBad.grid, ', расхождений:', afterBad.mismatches, ', длился ~', badMs + 60, 'мс');

  // Верные ходы: анимация идёт, по окончании всё согласовано
  let combos = 0;
  let maxMs = 0;
  let midGood = null;
  for (let i = 0; i < 8; i++) {
    const m = await findMove(page, true);
    if (!m) break;
    const logCount = logs.length;
    await swipeRight(page, m);
    await wait(60);
    if (!midGood) midGood = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board').processing);
    // Свайп во время анимации должен игнорироваться
    const other = await findMove(page, true);
    if (other) await swipeRight(page, other);
    maxMs = Math.max(maxMs, await waitIdle(page));
    if (logs.slice(logCount).some((l) => l.includes('Комбо'))) combos++;
    const state = await inspect(page);
    if (state.mismatches || state.zeros || state.matches || state.pieces !== 63) {
      const { grid, ...rest } = state;
      console.log('  !!! рассогласование после хода', i + 1, rest);
    }
  }
  const { grid, ...rest } = await inspect(page);
  console.log('  верные ходы: processing во время анимации =', midGood, ', после 8 ходов:', rest, ', комбо:', combos, ', самый долгий ход ~', maxMs, 'мс');
  console.log('  ошибки:', pageErrors(logs));
  if (step === '07-tiling-sprite') {
    const t = await page.evaluate(async () => {
      const bg = __PIXI_APP__.stage.children[0];
      const a = { x: bg.tilePosition.x, y: bg.tilePosition.y };
      await new Promise((r) => setTimeout(r, 1000));
      return { label: bg.label, dx: bg.tilePosition.x - a.x, dy: bg.tilePosition.y - a.y, w: bg.width, h: bg.height, scaleX: bg.scale.x };
    });
    console.log('  фон за 1 с сдвинулся на', t.dx.toFixed(1), t.dy.toFixed(1), 'размер', t.w, '×', t.h, 'scale.x', t.scaleX);
    await page.setViewport({ width: 420, height: 640 });
    await wait(500);
    console.log('  после смены размера окна фон:', await page.evaluate(() => [__PIXI_APP__.stage.children[0].width, __PIXI_APP__.stage.children[0].height]));
  }
  await page.close();
}

// --- 8.8: killTweensOf — быстрый выбор двух фишек подряд ---
{
  const { page, logs } = await open('08-gsap');
  const a = cellCenter(2, 2);
  const b = cellCenter(6, 4);
  await page.mouse.click(a.x, a.y);
  await wait(50);
  await page.mouse.click(b.x, b.y);
  await wait(600);
  const s = await page.evaluate(() => {
    const board = __PIXI_APP__.stage.getChildByLabel('board');
    return [board.getPiece({ row: 2, column: 2 }).scale.x, board.getPiece({ row: 6, column: 4 }).scale.x];
  });
  console.log('\n# 08 быстрый выбор двух фишек: масштабы', s, '— ожидаем [1, 1.3]', pageErrors(logs));
  await page.close();
}

// --- 8.9: отсчёт блокирует поле и исчезает ---
{
  const { page, logs } = await open('09-animated-sprite', 1500);
  const during = await page.evaluate(() => ({
    locked: __PIXI_APP__.stage.getChildByLabel('board').locked,
    frames: __PIXI_APP__.stage.children.filter((c) => c.constructor.name === 'AnimatedSprite' || c.totalFrames).map((c) => [c.totalFrames, c.currentFrame, c.playing]),
  }));
  const t0 = Date.now();
  while (await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board').locked)) await wait(100);
  const after = await page.evaluate(() => ({ children: __PIXI_APP__.stage.children.map((c) => c.label), alpha: __PIXI_APP__.stage.getChildByLabel('board').alpha }));
  console.log('\n# 09 во время отсчёта:', during, 'поле разблокировано через ~', Date.now() - t0 + 1500, 'мс после запуска; потом на сцене:', after, pageErrors(logs));
  await page.close();
}
await browser.close();
