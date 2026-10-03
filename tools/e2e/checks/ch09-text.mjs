// Проверка главы 9: счёт совпадает с подсчётом очков, шрифт загружен, счёт набегает, таймер идёт только
// во время игры и стоит на паузе, HTMLText отрисован, всплывающие надписи создаются и уничтожаются.
// node tools/e2e/checks/ch09-text.mjs
import { CONTENT, cellCenter, compileDir, launch, openPreview, wait } from '../lib.mjs';

const C = `${CONTENT}/09-text`;
const browser = await launch();
const open = (step) => openPreview(browser, compileDir(`${C}/${step}/solution`), { waitMs: 1500 });

const findMove = (page) =>
  page.evaluate(() => {
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
        if (has(g)) return { row: r, column: c };
      }
    return null;
  });

async function swipeRight(page, m) {
  const from = cellCenter(m.row, m.column);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y, { steps: 5 });
  await page.mouse.up();
}
const board = (page, fn, arg) => page.evaluate(fn, arg);
const waitUnlocked = async (page) => {
  while (await board(page, () => __PIXI_APP__.stage.getChildByLabel('board').locked)) await wait(100);
};
const waitIdle = async (page) => {
  await wait(80);
  while (await board(page, () => __PIXI_APP__.stage.getChildByLabel('board').processing)) await wait(50);
};
/** Подменяет board.onMatch: сам считает очки по правилу шага и вызывает исходный обработчик */
const spy = (page, multiplyByRound) =>
  board(
    page,
    (multiply) => {
      const b = __PIXI_APP__.stage.getChildByLabel('board');
      const original = b.onMatch;
      window.__expected = 0;
      window.__rounds = [];
      b.onMatch = (matches, round) => {
        for (const m of matches) window.__expected += m.length * 10 * (multiply ? round : 1);
        window.__rounds.push(round);
        original(matches, round);
      };
    },
    multiplyByRound,
  );
const scoreLabel = (page) => board(page, () => __PIXI_APP__.stage.children.find((c) => c.text?.startsWith?.('Очки')));
const errors = (logs) => logs.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]') || l.startsWith('[warn]'));

async function play(page, moves) {
  for (let i = 0; i < moves; i++) {
    const m = await findMove(page);
    if (!m) break;
    await swipeRight(page, m);
    await waitIdle(page);
  }
  await wait(1200); // счёт набегает и всплывающие надписи исчезают
}

for (const step of ['01-text', '02-styles', '03-fonts', '04-update-cost', '05-bitmap-text', '06-html-text', '07-score']) {
  const { page, logs } = await open(step);
  await waitUnlocked(page);
  console.log(`\n# ${step}`);
  const info = await board(page, () => {
    const texts = __PIXI_APP__.stage.children.filter((c) => typeof c.text === 'string');
    return texts.map((t) => ({
      type: t.constructor.name,
      text: t.text.slice(0, 40),
      font: t.style.fontFamily,
      size: t.style.fontSize,
      x: Math.round(t.x),
      y: Math.round(t.y),
      w: Math.round(t.width),
      h: Math.round(t.height),
    }));
  });
  console.log('  тексты на сцене:', JSON.stringify(info));
  const fontReady = await page.evaluate(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Nunito' && f.status === 'loaded'));
  console.log('  шрифт Nunito загружен в document.fonts:', fontReady);

  await spy(page, step === '07-score');
  const childrenBefore = await board(page, () => __PIXI_APP__.stage.getChildByLabel('board').children.length);
  // Счёт во время набегания: проверяем, что промежуточные значения есть
  const m = await findMove(page);
  await swipeRight(page, m);
  const samples = [];
  for (let i = 0; i < 12; i++) {
    samples.push(await board(page, () => __PIXI_APP__.stage.children.find((c) => c.text?.startsWith?.('Очки'))?.text));
    await wait(70);
  }
  await waitIdle(page);
  await play(page, 7);
  const result = await board(page, () => ({
    shown: __PIXI_APP__.stage.children.find((c) => c.text?.startsWith?.('Очки'))?.text,
    expected: window.__expected,
    rounds: window.__rounds,
    boardChildren: __PIXI_APP__.stage.getChildByLabel('board').children.length,
  }));
  console.log('  счёт на экране:', result.shown, '— ожидаем', result.expected, '; раунды:', result.rounds.join(','));
  console.log('  промежуточные значения счёта после хода:', [...new Set(samples)].join(' | '));
  console.log('  детей у поля до/после ходов:', childrenBefore, result.boardChildren, '(всплывающие надписи должны исчезнуть)');

  if (step >= '05') {
    // Таймер: идёт во время игры, стоит на паузе
    const timer = () => board(page, () => __PIXI_APP__.stage.children.find((c) => c.constructor.name === 'BitmapText')?.text);
    const t1 = await timer();
    await wait(2100);
    const t2 = await timer();
    await page.mouse.click(468, 32); // пауза
    await wait(100);
    const t3 = await timer();
    await wait(2100);
    const t4 = await timer();
    await page.mouse.click(468, 32);
    console.log('  таймер: идёт', t1, '→', t2, '; на паузе', t3, '→', t4);
  }
  if (step === '06-html-text' || step === '07-score') {
    const html = await board(page, () => {
      const h = __PIXI_APP__.stage.children.find((c) => c.constructor.name === 'HTMLText');
      return { w: Math.round(h.width), h: Math.round(h.height) };
    });
    console.log('  HTMLText:', html);
  }
  console.log('  ошибки и предупреждения:', errors(logs));
  await page.close();
}

// 9.5: формат времени и мигание в последние секунды — на коротком таймере
{
  const { readFileSync, writeFileSync, mkdirSync, cpSync } = await import('node:fs');
  const tmp = `${process.cwd()}/tools/e2e/out/ch09-timer`;
  mkdirSync(tmp, { recursive: true });
  cpSync(`${C}/05-bitmap-text/solution`, tmp, { recursive: true });
  const main = readFileSync(`${tmp}/main.ts`, 'utf8').replace('const GAME_TIME = 60_000;', 'const GAME_TIME = 12_000;');
  writeFileSync(`${tmp}/main.ts`, main);
  const { page, logs } = await openPreview(browser, compileDir(tmp), { waitMs: 1500 });
  await waitUnlocked(page);
  const seen = new Set();
  const tints = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 13500) {
    const s = await board(page, () => {
      const t = __PIXI_APP__.stage.children.find((c) => c.constructor.name === 'BitmapText');
      return [t.text, t.tint];
    });
    seen.add(s[0]);
    if (s[0] < '0:10') tints.add(s[1]);
    await wait(100);
  }
  console.log('\n# 05 короткий таймер, показанные значения:', [...seen].join(' '), '; цвета в последние 10 с:', [...tints].map((t) => t.toString(16)));
  console.log('  ошибки:', errors(logs));
  await page.close();
}
await browser.close();
