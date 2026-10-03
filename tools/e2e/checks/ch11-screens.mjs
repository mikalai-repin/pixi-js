// Проверка главы 11: полный цикл меню → игра → результат → игра/меню с укороченным временем игры,
// пауза посреди каскада (анимации и время стоят), настройки, потеря фокуса, рекорд, отсутствие утечек.
// node tools/e2e/checks/ch11-screens.mjs
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { CONTENT, OUT, compileDir, launch, openPreview, wait } from '../lib.mjs';

const C = `${CONTENT}/11-screens`;
const browser = await launch();
const problems = (logs) => logs.filter((l) => /^\[(pageerror|error|warn|runtime-error)\]/.test(l));

/** Копия решения шага с укороченным временем игры */
function prepare(step, gameTime) {
  const dir = `${OUT}/ch11-${step}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(`${C}/${step}/solution`, dir, { recursive: true });
  const file = `${dir}/GameScreen.ts`;
  writeFileSync(file, readFileSync(file, 'utf8').replace('const GAME_TIME = 60_000;', `const GAME_TIME = ${gameTime};`));
  return dir;
}

const screenName = (page) =>
  page.evaluate(() => {
    const all = [...__PIXI_APP__.stage.children, ...__PIXI_APP__.stage.children.flatMap((c) => c.children)];
    const screens = all.filter((s) => /(Screen|Popup)$/.test(s.constructor.name)).map((s) => s.constructor.name);
    return screens.length ? screens.join('+') : 'нет';
  });

async function waitScreen(page, name, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await screenName(page)).includes(name)) return Date.now() - t0;
    await wait(100);
  }
  return -1;
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
  if (!p) return false;
  await page.mouse.click(p.x, p.y);
  return true;
}

const board = (page, fn) => page.evaluate(fn);
const findMove = (page) =>
  page.evaluate(() => {
    const b = __PIXI_APP__.stage.getChildByLabel('board', true);
    const grid = b.grid;
    const has = (g) => {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) if (g[r][c] && g[r][c] === g[r][c + 1] && g[r][c] === g[r][c + 2]) return true;
      for (let c = 0; c < 7; c++) for (let r = 0; r < 7; r++) if (g[r][c] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 2][c]) return true;
      return false;
    };
    for (let r = 8; r >= 0; r--)
      for (let c = 0; c < 6; c++) {
        const g = grid.map((x) => x.slice());
        [g[r][c], g[r][c + 1]] = [g[r][c + 1], g[r][c]];
        if (has(g)) return { row: r, column: c };
      }
    return null;
  });

async function swipe(page) {
  const m = await findMove(page);
  if (!m) return; // на поле не осталось ходов: перемешивания в учебной игре нет
  const p = await page.evaluate((m) => {
    const app = __PIXI_APP__;
    const k = app.canvas.clientWidth / app.screen.width;
    const b = app.stage.getChildByLabel('board', true);
    const g = b.toGlobal(b.getViewPosition(m));
    return { x: g.x * k, y: g.y * k, cell: 50 * b.worldTransform.a * k };
  }, m);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + p.cell * 0.6, p.y, { steps: 5 });
  await page.mouse.up();
}

const timerText = (page) => page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('hud', true)?.children.find((c) => c.constructor.name === 'BitmapText')?.text);

// STEPS=07-focus,08-practice — проверить только эти шаги
const ALL = ['01-screen', '02-navigation', '03-load-screen', '04-result', '05-popups', '06-transitions', '07-focus', '08-practice'];
const STEPS = process.env.STEPS ? process.env.STEPS.split(',') : ALL;
for (const step of STEPS) {
  const dir = step >= '04' ? prepare(step, 9000) : `${C}/${step}/solution`;
  const { page, logs } = await openPreview(browser, compileDir(dir), { waitMs: 1500 });
  console.log(`\n# ${step}`);
  if (step === '08-practice') await page.evaluate(() => localStorage.removeItem('puzzling-potions:best-score'));

  if (step >= '02') {
    console.log('  меню через', await waitScreen(page, 'HomeScreen'), 'мс:', await screenName(page));
  }
  // «Играть»: в 11.1 — на стартовой панели, дальше — в меню
  await wait(800);
  await click(page, 'playButton');
  if (step >= '03') {
    await wait(50);
    console.log('  после «Играть»:', await screenName(page));
  }
  console.log('  игра через', await waitScreen(page, 'GameScreen'), 'мс');
  const t0 = Date.now();
  while (await board(page, () => __PIXI_APP__.stage.getChildByLabel('board', true).locked)) await wait(100);
  console.log('  поле разблокировано через', Date.now() - t0, 'мс (отсчёт), слушателей тикера:', await page.evaluate(() => __PIXI_APP__.ticker.count));

  // Ход и, начиная с 11.5, пауза посреди каскада
  await swipe(page);
  if (step >= '05') {
    await wait(320); // обмен закончился, идёт исчезновение и падение
    await click(page, 'pauseButton');
    await wait(450);
    const frozen = async () =>
      page.evaluate(() => {
        const b = __PIXI_APP__.stage.getChildByLabel('board', true);
        return b.getChildByLabel('pieces').children.map((p) => Math.round(p.y * 10)).join(',');
      });
    const a = await frozen();
    const ta = await timerText(page);
    await wait(700);
    const b = await frozen();
    const tb = await timerText(page);
    console.log('  пауза: попап', await screenName(page), '; фишки неподвижны', a === b, '; таймер стоит', ta === tb, ta);
    await click(page, 'resumeButton');
    await wait(1500);
    const consistent = await board(page, () => {
      const b = __PIXI_APP__.stage.getChildByLabel('board', true);
      let bad = 0;
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 7; c++) {
          const p = b.getPiece({ row: r, column: c });
          const v = b.getViewPosition({ row: r, column: c });
          if (!p || p.x !== v.x || p.y !== v.y || !b.grid[r][c]) bad++;
        }
      return { bad, processing: b.isProcessing, screens: undefined };
    });
    console.log('  после «Продолжить»:', await screenName(page), '; расхождений модели и вида', consistent.bad, '; каскад идёт', consistent.processing);

    // Настройки
    await click(page, 'settingsButton');
    await wait(900);
    const slider = await page.evaluate(() => {
      const app = __PIXI_APP__;
      const k = app.canvas.clientWidth / app.screen.width;
      const popup = app.stage.children.flatMap((c) => c.children).find((s) => s.constructor.name === 'SettingsPopup');
      const panel = popup.children[1];
      const s = panel.children.find((c) => 'slider1' in c);
      const cb = panel.children.find((c) => 'onCheck' in c);
      const h = s.slider1.getGlobalPosition();
      const cbb = cb.getBounds();
      return { x: h.x * k, y: h.y * k, w: 240 * k, cx: (cbb.x + 16) * k, cy: (cbb.y + 16) * k };
    });
    await page.mouse.move(slider.x, slider.y);
    await page.mouse.down();
    await page.mouse.move(slider.x - slider.w * 0.5, slider.y, { steps: 8 });
    await page.mouse.up();
    await wait(200);
    await page.mouse.click(slider.cx, slider.cy);
    await wait(300);
    const hintBefore = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('hud', true).parent.children.find((c) => c.constructor.name === 'HTMLText').visible);
    await click(page, 'doneButton');
    // Слайдер замедлил и GSAP: попап закрывается дольше обычного
    await wait(1200);
    const after = await page.evaluate(() => ({
      speed: __PIXI_APP__.ticker.speed,
      hint: __PIXI_APP__.stage.getChildByLabel('hud', true).parent.children.find((c) => c.constructor.name === 'HTMLText').visible,
    }));
    console.log('  настройки: скорость', after.speed, '; подсказка в попапе ещё видна', hintBefore, '→ после закрытия', after.hint, ';', await screenName(page));
    await page.evaluate(() => {
      __PIXI_APP__.ticker.speed = 1;
    });
  }

  if (step >= '07') {
    // Потеря фокуса: имитируем уход вкладки в фон
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(500);
    console.log('  вкладка в фоне →', await screenName(page));
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(600);
    await click(page, 'resumeButton');
    await wait(500);
  }

  if (step >= '04') {
    // Ходим, пока не кончится время, затем ждём результат
    const tEnd = Date.now();
    while (Date.now() - tEnd < 25000 && !(await screenName(page)).includes('ResultScreen')) {
      if (!(await board(page, () => __PIXI_APP__.stage.getChildByLabel('board', true)?.locked ?? true))) await swipe(page);
      await wait(400);
    }
    console.log('  результат через', Date.now() - tEnd, 'мс:', await screenName(page));
    await wait(4500);
    const res = await page.evaluate(() => {
      const r = __PIXI_APP__.stage.children.flatMap((c) => c.children).find((s) => s.constructor.name === 'ResultScreen');
      const texts = [];
      r?.children.forEach(function walk(o) {
        if (typeof o.text === 'string' && o.text) texts.push(o.text);
        o.children?.forEach(walk);
      });
      const stars = r ? r.children[0].children.filter((c, i) => i >= 2 && c.alpha === 1 && c.visible && c.texture?.label === 'star').length : 0;
      return { texts, stars, mask: !!r?.mask };
    });
    console.log('  экран результата:', JSON.stringify(res));
    await page.screenshot({ path: `${OUT}/ch11-${step}-result.png` });
    const listenersBefore = await page.evaluate(() => __PIXI_APP__.ticker.count);
    await click(page, step === '08-practice' ? 'menuButton' : 'againButton');
    await wait(400);
    if (step === '08-practice') {
      console.log('  «Меню» → меню через', await waitScreen(page, 'HomeScreen'), 'мс');
      await wait(1200);
      const best = await page.evaluate(() => ({
        stored: localStorage.getItem('puzzling-potions:best-score'),
        texts: __PIXI_APP__.stage.children.flatMap((c) => c.children).find((s) => s.constructor.name === 'HomeScreen')?.children.filter((c) => typeof c.text === 'string').map((c) => c.text),
      }));
      console.log('  рекорд в localStorage', best.stored, '; в меню', JSON.stringify(best.texts));
    } else {
      console.log('  «Ещё раз» → игра через', await waitScreen(page, 'GameScreen'), 'мс; слушателей тикера на результате', listenersBefore, ', в новой игре', await page.evaluate(() => __PIXI_APP__.ticker.count));
    }
  }
  await page.screenshot({ path: `${OUT}/ch11-${step}-end.png` });
  console.log('  ошибки:', problems(logs));
  await page.close();
}
await browser.close();
