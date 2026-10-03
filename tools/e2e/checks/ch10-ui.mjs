// Проверка главы 10: кнопка «Играть» и её состояния, старт игры, ходы при масштабированном canvas,
// пауза, панель настроек (слайдер, флажок, «Готово»), раскладка на разных размерах окна.
// node tools/e2e/checks/ch10-ui.mjs
import { CONTENT, OUT, compileDir, launch, openPreview, wait } from '../lib.mjs';

const C = `${CONTENT}/10-ui`;
const browser = await launch();
const errors = (logs) => logs.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]') || l.startsWith('[warn]'));

/** Координаты объекта на странице: глобальная позиция × (CSS-ширина canvas / логическая ширина экрана) */
const pagePos = (page, label) =>
  page.evaluate((label) => {
    const app = __PIXI_APP__;
    const k = app.canvas.clientWidth / app.screen.width;
    const obj = app.stage.getChildByLabel(label, true);
    if (!obj) return null;
    const p = obj.getGlobalPosition();
    return { x: p.x * k, y: p.y * k };
  }, label);

const cellPos = (page, row, column) =>
  page.evaluate(
    ({ row, column }) => {
      const app = __PIXI_APP__;
      const k = app.canvas.clientWidth / app.screen.width;
      const board = app.stage.getChildByLabel('board');
      const p = board.toGlobal(board.getViewPosition({ row, column }));
      return { x: p.x * k, y: p.y * k, cell: 50 * board.scale.x * k };
    },
    { row, column },
  );

const findMove = (page) =>
  page.evaluate(() => {
    const grid = __PIXI_APP__.stage.getChildByLabel('board').grid;
    const has = (g) => {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) if (g[r][c] && g[r][c] === g[r][c + 1] && g[r][c] === g[r][c + 2]) return true;
      for (let c = 0; c < 7; c++) for (let r = 0; r < 7; r++) if (g[r][c] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 2][c]) return true;
      return false;
    };
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 6; c++) {
        const g = grid.map((x) => x.slice());
        [g[r][c], g[r][c + 1]] = [g[r][c + 1], g[r][c]];
        if (has(g)) return { row: r, column: c };
      }
    return null;
  });

async function swipeRight(page, m) {
  const p = await cellPos(page, m.row, m.column);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + p.cell * 0.6, p.y, { steps: 5 });
  await page.mouse.up();
}
const locked = (page) => page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board').locked);
const grid = (page) => page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board').grid.map((r) => r.join('')).join('/'));

for (const step of ['01-button', '02-nine-slice', '03-component', '04-resize', '05-layout', '06-pixi-ui', '07-practice']) {
  const { page, logs } = await openPreview(browser, compileDir(`${C}/${step}/solution`), { waitMs: 2500 });
  console.log(`\n# ${step}`);
  const screen = await page.evaluate(() => ({ w: __PIXI_APP__.screen.width, h: __PIXI_APP__.screen.height, res: __PIXI_APP__.renderer.resolution, css: __PIXI_APP__.canvas.clientWidth }));
  console.log('  экран:', JSON.stringify(screen));

  // Состояния кнопки «Играть»: имена текстур фона
  const play = await pagePos(page, 'playButton');
  const bgTexture = () =>
    page.evaluate(() => {
      const b = __PIXI_APP__.stage.getChildByLabel('playButton', true);
      const bg = b.children[0];
      return [bg.constructor.name, bg.texture.label, Math.round(bg.width), Math.round(bg.height)].join(' ');
    });
  const states = [await bgTexture()];
  await page.mouse.move(play.x, play.y);
  await wait(100);
  states.push(await bgTexture());
  await page.mouse.down();
  await wait(100);
  states.push(await bgTexture());
  const lockedBefore = await locked(page);
  await page.mouse.up();
  await wait(200);
  console.log('  состояния кнопки (обычное, наведение, нажатие):', states.join(' | '));
  console.log('  поле заблокировано до нажатия:', lockedBefore, '; кнопка исчезла после нажатия:', (await pagePos(page, 'playButton')) === null);
  await wait(5700);
  console.log('  поле разблокировано после отсчёта:', !(await locked(page)));

  // Ход при текущем масштабе
  const g0 = await grid(page);
  const m = await findMove(page);
  await swipeRight(page, m);
  await wait(1800);
  console.log('  верный ход изменил сетку:', g0 !== (await grid(page)));

  // Пауза
  const pause = await pagePos(page, 'pauseButton');
  await page.mouse.click(pause.x, pause.y);
  await wait(150);
  const paused = await locked(page);
  await page.mouse.click(pause.x, pause.y);
  await wait(150);
  console.log('  пауза: заблокировано', paused, '→ снова доступно', !(await locked(page)));

  if (step >= '06') {
    const settings = await pagePos(page, 'settingsButton');
    await page.mouse.click(settings.x, settings.y);
    await wait(300);
    const opened = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('settingsPanel').visible);
    // Слайдер: тянем ручку влево
    const slider = await page.evaluate(() => {
      const app = __PIXI_APP__;
      const k = app.canvas.clientWidth / app.screen.width;
      const panel = app.stage.getChildByLabel('settingsPanel');
      const s = panel.children.find((c) => 'slider1' in c);
      const handle = s.slider1.getGlobalPosition();
      return { x: handle.x * k, y: handle.y * k, w: 240 * k };
    });
    await page.mouse.move(slider.x, slider.y);
    await page.mouse.down();
    await page.mouse.move(slider.x - slider.w * 0.5, slider.y, { steps: 8 });
    await page.mouse.up();
    await wait(150);
    const speed = await page.evaluate(() => ({ ticker: __PIXI_APP__.ticker.speed }));
    const label = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('settingsPanel').children.find((c) => c.text?.startsWith?.('Скорость'))?.text);
    // Флажок подсказки (классы @pixi/ui в минифицированной сборке переименованы, ищем по свойствам)
    const check = await page.evaluate(() => {
      const app = __PIXI_APP__;
      const k = app.canvas.clientWidth / app.screen.width;
      const cb = app.stage.getChildByLabel('settingsPanel').children.find((c) => 'onCheck' in c);
      const b = cb.getBounds();
      return { x: (b.x + 16) * k, y: (b.y + 16) * k };
    });
    await page.mouse.click(check.x, check.y);
    await wait(150);
    const hintVisible = await page.evaluate(() => __PIXI_APP__.stage.children.find((c) => c.constructor.name === 'HTMLText').visible);
    await page.screenshot({ path: `${OUT}/ch10-${step}-settings.png` });
    const done = await page.evaluate(() => {
      const app = __PIXI_APP__;
      const k = app.canvas.clientWidth / app.screen.width;
      const panel = app.stage.getChildByLabel('settingsPanel');
      // «Готово» добавлена в панель последней
      const btn = panel.children[panel.children.length - 1];
      const p = btn.getGlobalPosition();
      return { x: p.x * k, y: p.y * k };
    });
    const lockedOpen = await locked(page);
    await page.mouse.click(done.x, done.y);
    await wait(300);
    const closed = !(await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('settingsPanel').visible));
    console.log('  настройки: открылись', opened, ', поле заблокировано', lockedOpen, ', скорость после слайдера', speed.ticker, label, ', подсказка видна', hintVisible, ', закрылись', closed, ', поле доступно', !(await locked(page)));
  }

  if (step >= '04') {
    for (const [w, h] of [[375, 667], [500, 600], [1280, 800]]) {
      await page.setViewport({ width: w, height: h });
      await wait(600);
      const info = await page.evaluate(() => {
        const app = __PIXI_APP__;
        const board = app.stage.getChildByLabel('board');
        const b = board.getChildByLabel('background').getBounds();
        const objs = app.stage.children.filter((c) => c.visible && c.label !== 'TilingSprite' && c.label !== 'settingsPanel');
        const outside = objs
          .map((o) => [o.label || o.constructor.name, o.getBounds()])
          .filter(([, r]) => r.x < -1 || r.y < -1 || r.x + r.width > app.screen.width + 1 || r.y + r.height > app.screen.height + 1)
          .map(([n]) => n);
        return {
          screen: `${Math.round(app.screen.width)}×${Math.round(app.screen.height)}`,
          css: `${app.canvas.clientWidth}×${app.canvas.clientHeight}`,
          boardScale: +board.scale.x.toFixed(3),
          boardTop: Math.round(b.y),
          boardBottom: Math.round(b.y + b.height),
          outside,
        };
      });
      console.log(`  окно ${w}×${h}:`, JSON.stringify(info));
      await page.screenshot({ path: `${OUT}/ch10-${step}-${w}x${h}.png` });
    }
  }
  console.log('  ошибки и предупреждения:', errors(logs));
  await page.close();
}
await browser.close();
