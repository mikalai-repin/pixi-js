// Проверка главы 12: эффекты появляются и убираются, пулы переиспользуют объекты, искры стоят на паузе,
// фильтры ставятся и снимаются, в практикуме — спецфишки на подставном поле и цепная реакция.
// node tools/e2e/checks/ch12-effects.mjs   (STEPS=05-particles,09-practice — только эти шаги)
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { CONTENT, OUT, compileDir, launch, openPreview, wait } from '../lib.mjs';

const C = `${CONTENT}/12-effects`;
const browser = await launch();
const problems = (logs) => logs.filter((l) => /^\[(pageerror|error|warn|runtime-error)\]/.test(l));

/** Копия решения шага: укороченная игра и, если нужно, подставное поле */
function prepare(step, { gameTime = 40000, grid } = {}) {
  const dir = `${OUT}/ch12-${step}${grid ? '-grid' : ''}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(`${C}/${step}/solution`, dir, { recursive: true });
  const screen = `${dir}/GameScreen.ts`;
  writeFileSync(screen, readFileSync(screen, 'utf8').replace('const GAME_TIME = 60_000;', `const GAME_TIME = ${gameTime};`));
  if (grid) {
    const board = `${dir}/Board.ts`;
    const src = readFileSync(board, 'utf8');
    const patched = src.replace('this.grid = createGrid(ROWS, COLUMNS, TYPES);', `this.grid = ${JSON.stringify(grid)};`);
    if (patched === src) throw new Error('не удалось подставить поле');
    writeFileSync(board, patched);
  }
  return dir;
}

async function click(page, label) {
  const p = await page.evaluate((label) => {
    const app = __PIXI_APP__;
    const k = app.canvas.clientWidth / app.screen.width;
    const obj = app.stage.getChildByLabel(label, true);
    if (!obj) return null;
    const g = obj.getGlobalPosition();
    return { x: g.x * k, y: g.y * k };
  }, label);
  if (p) await page.mouse.click(p.x, p.y);
  return !!p;
}

/** Центр клетки на странице и размер клетки */
const cellOnPage = (page, cell) =>
  page.evaluate((cell) => {
    const app = __PIXI_APP__;
    const k = app.canvas.clientWidth / app.screen.width;
    const b = app.stage.getChildByLabel('board', true);
    const g = b.toGlobal(b.getViewPosition(cell));
    return { x: g.x * k, y: g.y * k, size: 50 * b.worldTransform.a * k };
  }, cell);

async function swipe(page, cell, dx, dy) {
  const p = await cellOnPage(page, cell);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + dx * p.size * 0.6, p.y + dy * p.size * 0.6, { steps: 5 });
  await page.mouse.up();
}

async function tap(page, cell) {
  const p = await cellOnPage(page, cell);
  await page.mouse.click(p.x, p.y);
}

/** Ход, который даёт совпадение: { cell, dx, dy } или null, если ходов нет */
const findMove = (page) =>
  page.evaluate(() => {
    const grid = __PIXI_APP__.stage.getChildByLabel('board', true).grid;
    const ok = (t) => t && t < 7;
    const has = (g) => {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) if (ok(g[r][c]) && g[r][c] === g[r][c + 1] && g[r][c] === g[r][c + 2]) return true;
      for (let c = 0; c < 7; c++) for (let r = 0; r < 7; r++) if (ok(g[r][c]) && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 2][c]) return true;
      return false;
    };
    for (let r = 8; r >= 0; r--)
      for (let c = 0; c < 7; c++)
        for (const [dr, dc] of [[0, 1], [-1, 0]]) {
          if (c + dc > 6 || r + dr < 0) continue;
          const g = grid.map((x) => x.slice());
          [g[r][c], g[r + dr][c + dc]] = [g[r + dr][c + dc], g[r][c]];
          if (has(g)) return { cell: { row: r, column: c }, dx: dc, dy: dr };
        }
    return null;
  });

/** Делает ход, если он есть */
async function move(page) {
  const m = await findMove(page);
  if (m) await swipe(page, m.cell, m.dx, m.dy);
  return !!m;
}

const idle = async (page) => {
  for (let i = 0; i < 100; i++) {
    if (!(await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true).isProcessing))) return;
    await wait(100);
  }
};

/** Совпадают ли модель и вид, нет ли пустых клеток */
const consistency = (page) =>
  page.evaluate(() => {
    const b = __PIXI_APP__.stage.getChildByLabel('board', true);
    let bad = 0;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 7; c++) {
        const p = b.getPiece({ row: r, column: c });
        const v = b.getViewPosition({ row: r, column: c });
        if (!p || p.x !== v.x || p.y !== v.y || !b.grid[r][c]) bad++;
        else if (p.special !== undefined && p.special !== b.grid[r][c] >= 7) bad++;
      }
    return bad;
  });

/** Что сейчас в слое эффектов */
const fxState = (page) =>
  page.evaluate(() => {
    const fx = __PIXI_APP__.stage.getChildByLabel('effects', true);
    const kinds = {};
    for (const c of fx.children) {
      const name = c.particleChildren ? 'particles' : c.constructor.name === 'Graphics' ? 'ring' : 'copy';
      kinds[name] = (kinds[name] ?? 0) + (c.particleChildren ? c.particleChildren.length : 1);
    }
    return {
      kinds,
      pools: ['rings', 'copies', 'sparkPool'].filter((k) => fx[k]).map((k) => `${k}: создано ${fx[k].created}, на складе ${fx[k].items.length}`),
    };
  });

const hasPopup = (page) => page.evaluate(() => __PIXI_APP__.stage.children.flatMap((c) => c.children).some((s) => s.constructor.name === 'PausePopup'));

/** Нажимает «Продолжить», пока попап не закроется: под размытием программный WebGL рисует кадры медленно */
async function resume(page) {
  for (let i = 0; i < 30 && (await hasPopup(page)); i++) {
    await click(page, 'resumeButton');
    await wait(400);
  }
}

async function startGame(page) {
  for (let i = 0; i < 40 && !(await page.evaluate(() => !!__PIXI_APP__.stage.getChildByLabel('board', true))); i++) {
    await click(page, 'playButton');
    await wait(500);
  }
  for (let i = 0; i < 150 && (await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true).locked)); i++) await wait(100);
}

const ALL = ['01-juice', '02-shake', '03-fly', '04-pool', '05-particles', '06-filters', '07-blend-modes', '08-pixi-filters', '09-practice'];
const STEPS = process.env.STEPS ? process.env.STEPS.split(',') : ALL;

for (const step of STEPS) {
  console.log(`\n# ${step}`);
  const { page, logs } = await openPreview(browser, compileDir(prepare(step)), { waitMs: 1500 });
  await startGame(page);
  // Считаем исчезнувшие фишки: сравним с числом объектов, которые создали пулы
  await page.evaluate(() => {
    const b = __PIXI_APP__.stage.getChildByLabel('board', true);
    const onPop = b.onPop;
    window.__pops = 0;
    b.onPop = (piece) => {
      window.__pops++;
      onPop(piece);
    };
  });
  const fxBefore = await fxState(page);

  // Ход: сразу после него в слое эффектов кольца, копии, искры
  await move(page);
  await wait(300);
  console.log('  через 0,3 с после хода:', JSON.stringify((await fxState(page)).kinds));
  await idle(page);
  await wait(1200);
  console.log('  после каскада:', JSON.stringify((await fxState(page)).kinds), '; было до хода:', JSON.stringify(fxBefore.kinds));

  if (step >= '02') {
    // Тряска: вызываем onMatch напрямую, как на комбо ×3
    const shake = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const app = __PIXI_APP__;
          const fx = app.stage.getChildByLabel('effects', true);
          const b = app.stage.getChildByLabel('board', true);
          fx.onMatch(3);
          let max = 0;
          let t = 0;
          const fn = (tk) => {
            t += tk.deltaMS;
            max = Math.max(max, Math.abs(b.pivot.x), Math.abs(b.pivot.y));
            if (t > 800) {
              app.ticker.remove(fn);
              resolve({ max: Math.round(max * 10) / 10, end: [b.pivot.x, b.pivot.y] });
            }
          };
          app.ticker.add(fn);
        }),
    );
    console.log('  тряска на комбо ×3: наибольший сдвиг pivot', shake.max, '; в конце', shake.end.join(', '));
  }

  if (step >= '04') {
    for (let i = 0; i < 5; i++) {
      if (!(await move(page))) break;
      await idle(page);
      await wait(1100);
    }
    console.log('  пулы после 6 ходов: исчезло фишек', await page.evaluate(() => window.__pops), ';', (await fxState(page)).pools.join('; '));
  }

  if (step >= '05') {
    // Пауза посреди взрыва: искры стоят, на экране размытие (с 12.6)
    await move(page);
    await wait(380);
    await click(page, 'pauseButton');
    await wait(150);
    const sparks = () =>
      page.evaluate(() =>
        __PIXI_APP__.stage
          .getChildByLabel('effects', true)
          .children.find((c) => c.particleChildren)
          .particleChildren.map((p) => Math.round(p.y))
          .join(','),
      );
    const a = await sparks();
    await wait(600);
    const b = await sparks();
    const filters = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('hud', true).parent.filters?.map((f) => f.constructor.name) ?? []);
    console.log('  пауза: искр', a ? a.split(',').length : 0, '; стоят на месте', a === b, '; фильтры экрана', JSON.stringify(filters));
    // Время кадра под размытием: среднее за полсекунды
    const frameMs = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const app = __PIXI_APP__;
          let n = 0;
          let t = 0;
          const fn = (tk) => {
            n++;
            t += tk.elapsedMS;
            if (t > 500) {
              app.ticker.remove(fn);
              resolve(Math.round(t / n));
            }
          };
          app.ticker.add(fn);
        }),
    );
    console.log('  кадр на паузе (headless, программный WebGL):', frameMs, 'мс');
    await resume(page);
    await wait(300);
    const after = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('hud', true).parent.filters?.length ?? 0);
    await idle(page);
    await wait(1200);
    console.log('  после паузы: фильтров экрана', after, '; эффекты', JSON.stringify((await fxState(page)).kinds));
  }

  if (step >= '08') {
    // Свечение выбранной фишки и ударная волна
    await tap(page, { row: 4, column: 3 });
    await wait(300);
    const glow = await page.evaluate(() => {
      const b = __PIXI_APP__.stage.getChildByLabel('board', true);
      const p = b.getPiece({ row: 4, column: 3 });
      return p.filters?.map((f) => f.constructor.name).join(',') ?? '';
    });
    await tap(page, { row: 4, column: 3 });
    const wave = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const app = __PIXI_APP__;
          const fx = app.stage.getChildByLabel('effects', true);
          const screen = app.stage.getChildByLabel('hud', true).parent;
          fx.playShockwave({ x: 0, y: 0 });
          const during = screen.filters?.length ?? 0;
          setTimeout(() => resolve({ during, after: screen.filters?.length ?? 0 }), 1200);
        }),
    );
    console.log('  фильтры выбранной фишки:', glow, '; волна: фильтров во время', wave.during, ', после', wave.after);
  }

  if (step >= '06') {
    // Конец игры: поле выцветает, затем экран результата
    for (let i = 0; i < 600; i++) {
      if (await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true)?.filters?.length)) break;
      await wait(100);
    }
    console.log('  время вышло: фильтры поля', await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true)?.filters?.map((f) => f.constructor.name).join(',')));
  }
  // Ждём экран результата: эффекты не должны мешать уничтожению экрана игры
  for (let i = 0; i < 600; i++) {
    if (await page.evaluate(() => __PIXI_APP__.stage.children.flatMap((c) => c.children).some((s) => s.constructor.name === 'ResultScreen'))) break;
    await wait(100);
  }
  await wait(1500);
  console.log(
    '  результат:',
    await page.evaluate(() => __PIXI_APP__.stage.children.flatMap((c) => c.children).map((s) => s.constructor.name).join('+')),
    '; твинов GSAP:',
    await page.evaluate(async () => (await import('gsap')).default.globalTimeline.getChildren().length),
    '; слушателей тикера:',
    await page.evaluate(() => __PIXI_APP__.ticker.count),
  );
  console.log('  ошибки:', JSON.stringify(problems(logs)));
  await page.close();
}

// --- Практикум: спецфишки на подставном поле ---
if (STEPS.includes('09-practice')) {
  const GRID_A = [
    [2, 3, 4, 5, 6, 1, 3],
    [2, 4, 5, 6, 1, 3, 4],
    [5, 2, 2, 1, 3, 4, 5],
    [2, 6, 1, 3, 4, 5, 6],
    [3, 1, 3, 4, 5, 6, 1],
    [4, 5, 4, 5, 6, 1, 2],
    [5, 6, 5, 6, 1, 2, 3],
    [6, 4, 1, 2, 3, 4, 5],
    [1, 1, 3, 1, 4, 5, 6],
  ];
  const GRID_B = [
    [1, 2, 3, 4, 5, 6, 1],
    [2, 3, 4, 5, 6, 1, 2],
    [3, 4, 5, 6, 1, 2, 3],
    [4, 5, 6, 1, 2, 3, 4],
    [5, 6, 1, 2, 3, 4, 5],
    [6, 1, 2, 7, 4, 5, 8],
    [1, 2, 3, 4, 5, 6, 1],
    [2, 3, 4, 5, 6, 1, 2],
    [3, 4, 5, 6, 1, 2, 3],
  ];
  const specials = (page) =>
    page.evaluate(() => {
      const g = __PIXI_APP__.stage.getChildByLabel('board', true).grid;
      const out = [];
      g.forEach((row, r) => row.forEach((t, c) => t >= 7 && out.push({ row: r, column: c, type: t })));
      return out;
    });
  const hook = (page) =>
    page.evaluate(() => {
      const b = __PIXI_APP__.stage.getChildByLabel('board', true);
      window.__log = [];
      const onMatch = b.onMatch;
      b.onMatch = (m, r) => {
        window.__log.push(`match r${r}: ${m.map((x) => x.length).join('+')}`);
        onMatch(m, r);
      };
      const onSpecial = b.onSpecial;
      b.onSpecial = (t, p) => {
        window.__log.push(`special ${t} @${p.row},${p.column}`);
        onSpecial?.(t, p);
      };
    });
  const takeLog = (page) => page.evaluate(() => window.__log.splice(0));

  console.log('\n# 09-practice: подставное поле A');
  {
    const { page, logs } = await openPreview(browser, compileDir(prepare('09-practice', { gameTime: 60000, grid: GRID_A })), { waitMs: 1500 });
    await startGame(page);
    await hook(page);
    await swipe(page, { row: 3, column: 0 }, 0, -1); // уголок → бомба
    await idle(page);
    console.log('  уголок:', JSON.stringify(await specials(page)), (await takeLog(page)).join(' | '));
    await swipe(page, { row: 7, column: 2 }, 0, 1); // четыре в ряд → полоса
    await idle(page);
    console.log('  четыре в ряд:', JSON.stringify(await specials(page)), (await takeLog(page)).join(' | '));
    await wait(600);
    const glowing = await page.evaluate(() => {
      const b = __PIXI_APP__.stage.getChildByLabel('board', true);
      return b.grid.flatMap((row, r) => row.map((t, c) => (t >= 7 ? b.getPiece({ row: r, column: c }) : null))).filter(Boolean).map((p) => p.children[0].visible);
    });
    console.log('  подсветка спецфишек видна:', JSON.stringify(glowing), '; расхождений модели и вида:', await consistency(page));
    await page.screenshot({ path: `${OUT}/ch12-specials.png` });
    for (const s of await specials(page)) {
      // Специальные фишки могли сдвинуться после предыдущего взрыва — ищем заново
      const now = (await specials(page)).find((x) => x.type === s.type);
      if (!now) continue;
      await tap(page, now);
      await wait(150);
      const fx = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('hud', true).parent.filters?.map((f) => f.constructor.name).join(',') ?? '');
      await idle(page);
      await wait(900);
      console.log(`  нажатие на ${now.type === 7 ? 'полосу' : 'бомбу'} (${now.row},${now.column}):`, (await takeLog(page)).join(' | '), '; фильтры экрана в момент взрыва:', fx || 'нет', '; расхождений:', await consistency(page));
    }
    console.log('  ошибки:', JSON.stringify(problems(logs)));
    await page.close();
  }

  console.log('\n# 09-practice: подставное поле B (цепная реакция)');
  {
    const { page, logs } = await openPreview(browser, compileDir(prepare('09-practice', { gameTime: 60000, grid: GRID_B })), { waitMs: 1500 });
    await startGame(page);
    await hook(page);
    const before = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('hud', true).parent.score);
    await tap(page, { row: 5, column: 3 });
    await idle(page);
    await wait(900);
    const after = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('hud', true).parent.score);
    console.log('  полоса задела бомбу:', (await takeLog(page)).join(' | '), '; очки', before, '→', after, '; спецфишек осталось', (await specials(page)).length, '; расхождений:', await consistency(page));
    console.log('  ошибки:', JSON.stringify(problems(logs)));
    await page.close();
  }
}

await browser.close();
