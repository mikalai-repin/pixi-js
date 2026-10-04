// Проверка главы 14: Spine-скелеты дракона и котла создаются и анимируются, таймер следует за костью котла,
// очередь анимаций и смешивание у дракона, котёл бурлит на комбо, зелья летят в котёл, Spine стоит на паузе,
// дракон на экране результата, слушатели Ticker.shared не копятся от игры к игре.
// node tools/e2e/checks/ch14-spine.mjs   (STEPS=02-bones,04-practice — только эти шаги)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { CONTENT, OUT, compileDir, copyStepDir, launch, openPreview, wait } from '../lib.mjs';

const C = `${CONTENT}/14-spine`;
const ALL = ['01-skeletal', '02-bones', '03-animation-state', '04-practice'];
const STEPS = process.env.STEPS ? process.env.STEPS.split(',') : ALL;
const from = (step, first) => ALL.indexOf(step) >= ALL.indexOf(first);
const browser = await launch();
const problems = (logs) => logs.filter((l) => /^\[(pageerror|error|warn|runtime-error|assert)\]/.test(l));

let failures = 0;
const expect = (ok, text) => {
  console.log(`  ${ok ? 'ок ' : 'НЕТ'} ${text}`);
  if (!ok) failures++;
};

/** Копия решения шага с короткой игрой */
function prepare(step, gameTime = 25000) {
  const dir = `${OUT}/ch14-${step}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  copyStepDir(`${C}/${step}/solution`, dir);
  const screen = `${dir}/GameScreen.ts`;
  writeFileSync(screen, readFileSync(screen, 'utf8').replace('const GAME_TIME = 60_000;', `const GAME_TIME = ${gameTime};`));
  return dir;
}

const screens = (page) => page.evaluate(() => __PIXI_APP__.stage.children.flatMap((c) => c.children).map((s) => s.constructor.name));

/** Все объекты Spine на сцене: у них есть skeleton и state. Имена классов в сборке изменены — ищем по свойствам */
const spines = (page) =>
  page.evaluate(() => {
    const out = [];
    const walk = (o) => {
      if (o.skeleton && o.state) {
        const tracks = o.state.tracks.map((t) => (t ? { name: t.animation.name, loop: t.loop, next: t.next?.animation.name ?? null, timeScale: t.timeScale, trackTime: +t.trackTime.toFixed(3) } : null));
        out.push({ skeleton: o.skeleton.data.bones.length === 6 ? 'cauldron' : 'dragon', tracks, autoUpdate: o.autoUpdate, mix: o.state.data.defaultMix, scale: +o.scale.x.toFixed(3), visible: o.worldVisible });
      }
      o.children?.forEach(walk);
    };
    walk(__PIXI_APP__.stage);
    return out;
  });

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
  return p;
}

async function startGame(page) {
  for (let i = 0; i < 40 && !(await page.evaluate(() => !!__PIXI_APP__.stage.getChildByLabel('board', true))); i++) {
    await click(page, 'playButton');
    await wait(500);
  }
  for (let i = 0; i < 150 && (await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true).locked)); i++) await wait(100);
}

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

async function swipe(page, m) {
  const p = await page.evaluate((cell) => {
    const app = __PIXI_APP__;
    const k = app.canvas.clientWidth / app.screen.width;
    const b = app.stage.getChildByLabel('board', true);
    const g = b.toGlobal(b.getViewPosition(cell));
    return { x: g.x * k, y: g.y * k, size: 50 * b.worldTransform.a * k };
  }, m.cell);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + m.dx * p.size * 0.6, p.y + m.dy * p.size * 0.6, { steps: 5 });
  await page.mouse.up();
}

/** Котёл в интерфейсе: позиция содержимого и кости bone2 в координатах скелета */
const cauldronState = (page) =>
  page.evaluate(() => {
    const hud = __PIXI_APP__.stage.getChildByLabel('hud', true);
    const c = hud.cauldron ?? hud.children.find((x) => x.spine);
    const bone = c.spine.skeleton.findBone('bone2');
    const content = c.children.find((x) => x !== c.spine);
    return {
      content: { x: +content.x.toFixed(2), y: +content.y.toFixed(2), r: +content.rotation.toFixed(4) },
      bone: { x: +bone.worldX.toFixed(2), y: +bone.worldY.toFixed(2), r: +((bone.getWorldRotationX() * Math.PI) / 180).toFixed(4) },
      timerInside: content.children.length === 1 && /^\d:\d\d$/.test(content.children[0].text),
    };
  });

for (const step of STEPS) {
  console.log(`\n# ${step}`);
  const { page, logs } = await openPreview(browser, compileDir(prepare(step)), { waitMs: 3500 });
  const sharedBefore = await page.evaluate(async () => (await import('pixi.js')).Ticker.shared.count);

  // --- Меню: дракон ---
  let list = await spines(page);
  const dragon = list.find((s) => s.skeleton === 'dragon');
  expect(dragon?.tracks[0]?.name === 'dragon-idle' && dragon.tracks[0].loop && dragon.scale === 0.3, `в меню дракон: ${JSON.stringify(dragon?.tracks)} масштаб ${dragon?.scale}`);
  const t1 = (await spines(page)).find((s) => s.skeleton === 'dragon').tracks[0].trackTime;
  await wait(500);
  const t2 = (await spines(page)).find((s) => s.skeleton === 'dragon').tracks[0].trackTime;
  expect(t2 > t1, `анимация идёт сама: trackTime ${t1} → ${t2}`);

  if (from(step, '03-animation-state')) {
    expect(dragon.mix === 0.2, `defaultMix ${dragon.mix}`);
    const p = await page.evaluate(() => {
      const app = __PIXI_APP__;
      const k = app.canvas.clientWidth / app.screen.width;
      const g = app.stage.getChildByLabel('playButton', true).getGlobalPosition();
      return { x: g.x * k, y: g.y * k };
    });
    await page.mouse.move(p.x - 200, p.y + 40);
    await page.mouse.move(p.x, p.y, { steps: 4 });
    await wait(100);
    const hovered = (await spines(page)).find((s) => s.skeleton === 'dragon').tracks[0];
    expect(hovered.name === 'dragon-bubbles' && hovered.next === 'dragon-idle', `наведение на «Играть»: ${JSON.stringify(hovered)}`);
    await wait(1300);
    const after = (await spines(page)).find((s) => s.skeleton === 'dragon').tracks[0];
    expect(after.name === 'dragon-idle' && after.loop, `через 1,3 с из очереди: ${after.name}, по кругу ${after.loop}`);
  }

  // --- Игра: котёл ---
  await startGame(page);
  if (from(step, '02-bones')) {
    const states = [];
    for (let i = 0; i < 4; i++) {
      states.push(await cauldronState(page));
      await wait(300);
    }
    const follows = states.every((s) => Math.abs(s.content.x - s.bone.x) < 0.01 && Math.abs(s.content.y - s.bone.y) < 0.01 && Math.abs(s.content.r - s.bone.r) < 1e-3);
    const moves = new Set(states.map((s) => s.content.y)).size > 1;
    expect(follows && moves && states[0].timerInside, `таймер в котле следует за bone2 и качается: y ${states.map((s) => s.content.y).join(' → ')}, поворот ${states.map((s) => s.content.r).join(' ')}`);
    list = await spines(page);
    expect(list.filter((s) => s.skeleton === 'cauldron').length === 1 && list.filter((s) => s.skeleton === 'dragon').length === 0, `в игре один котёл, дракона нет: ${list.map((s) => s.skeleton).join(', ')}`);
  }

  if (from(step, '03-animation-state')) {
    await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('effects', true).onMatch(3));
    const boiled = (await spines(page)).find((s) => s.skeleton === 'cauldron').tracks[0].timeScale;
    await wait(2000);
    const calm = (await spines(page)).find((s) => s.skeleton === 'cauldron').tracks[0].timeScale;
    expect(Math.abs(boiled - 3) < 0.2 && calm === 1, `комбо ×3: timeScale котла ${boiled.toFixed(2)} → через 2 с ${calm}`);
  }

  // Удачный ход: зелья летят в счёт (до 04) или в котёл (04)
  const m = await findMove(page);
  if (m) {
    const target = await page.evaluate(() => {
      const hud = __PIXI_APP__.stage.getChildByLabel('hud', true);
      const fx = __PIXI_APP__.stage.getChildByLabel('effects', true);
      const pos = hud.getCauldronPosition ? hud.getCauldronPosition() : hud.getScorePosition();
      return fx.toLocal(pos);
    });
    await swipe(page, m);
    // Ловим копии в полёте и их последние позиции
    const ends = await page.evaluate(async () => {
      const fx = __PIXI_APP__.stage.getChildByLabel('effects', true);
      // Копии берутся из пула и переиспользуются: позицию записываем в тот момент, когда копия ушла со слоя
      let prev = new Map();
      const ends = [];
      const scales = [];
      const hud = __PIXI_APP__.stage.getChildByLabel('hud', true);
      const c = hud.cauldron;
      for (let i = 0; i < 160; i++) {
        const now = new Map();
        for (const copy of fx.children) if (copy.texture && !copy.particleChildren && !copy.context) now.set(copy, { x: copy.x, y: copy.y });
        for (const [copy, pos] of prev) if (!now.has(copy)) ends.push(pos);
        prev = now;
        if (c) scales.push(c.spine.scale.x);
        await new Promise((r) => setTimeout(r, 20));
      }
      return { ends, maxScale: Math.max(1, ...scales) };
    });
    const dist = ends.ends.map((e) => Math.hypot(e.x - target.x, e.y - target.y));
    if (process.env.DEBUG) console.log("  цель", JSON.stringify(target), "концы", JSON.stringify(ends.ends.map((e) => [Math.round(e.x), Math.round(e.y)])));
    expect(ends.ends.length >= 3 && Math.max(...dist) < 100, `копии долетели к цели (${step === '04-practice' ? 'котёл' : 'счёт'}): ${ends.ends.length} шт., расстояние до цели в конце ≤ ${Math.max(...dist).toFixed(1)}`);
    if (step === '04-practice') expect(ends.maxScale > 1.05, `котёл вздрагивает: наибольший scale.x скелета ${ends.maxScale.toFixed(3)}`);
  }

  // --- Пауза ---
  if (step === '04-practice') {
    await wait(1000);
    for (let i = 0; i < 10 && !(await screens(page)).includes('PausePopup'); i++) {
      await click(page, 'pauseButton');
      await wait(500);
    }
    const a = (await spines(page)).find((s) => s.skeleton === 'cauldron');
    await wait(700);
    const b = (await spines(page)).find((s) => s.skeleton === 'cauldron');
    expect(!a.autoUpdate && a.tracks[0].trackTime === b.tracks[0].trackTime, `на паузе котёл стоит: autoUpdate ${a.autoUpdate}, trackTime ${a.tracks[0].trackTime} → ${b.tracks[0].trackTime}`);
    for (let i = 0; i < 30 && (await screens(page)).includes('PausePopup'); i++) {
      await click(page, 'resumeButton');
      await wait(400);
    }
    const c1 = (await spines(page)).find((s) => s.skeleton === 'cauldron');
    await wait(400);
    const c2 = (await spines(page)).find((s) => s.skeleton === 'cauldron');
    expect(c1.autoUpdate && c2.tracks[0].trackTime > c1.tracks[0].trackTime, `после «Продолжить» котёл снова идёт: ${c1.tracks[0].trackTime} → ${c2.tracks[0].trackTime}`);
  }

  // --- Результат ---
  for (let i = 0; i < 80 && !(await screens(page)).includes('ResultScreen'); i++) await wait(500);
  await wait(1300);
  list = await spines(page);
  if (step === '04-practice') {
    const d = list.find((s) => s.skeleton === 'dragon');
    expect(d?.tracks[0]?.name === 'dragon-transition' && d.tracks[0].next === 'dragon-idle', `на результате дракон: ${JSON.stringify(d?.tracks)}`);
    await wait(2600);
    const d2 = (await spines(page)).find((s) => s.skeleton === 'dragon');
    expect(d2.tracks[0].name === 'dragon-idle' && d2.tracks[0].loop, `после появления — ${d2.tracks[0].name} по кругу`);
  }
  expect(!list.some((s) => s.skeleton === 'cauldron'), 'котёл ушёл вместе с экраном игры');

  // Ещё раз: меню → игра → меню, слушатели Ticker.shared не копятся
  await click(page, 'menuButton');
  for (let i = 0; i < 20 && !(await screens(page)).includes('HomeScreen'); i++) await wait(300);
  await wait(1500);
  const sharedAfter = await page.evaluate(async () => (await import('pixi.js')).Ticker.shared.count);
  expect(sharedAfter <= sharedBefore, `слушателей Ticker.shared в меню не прибавилось: было ${sharedBefore}, после игры и возврата ${sharedAfter}`);

  const bad = problems(logs);
  expect(bad.length === 0, `ошибок и предупреждений нет${bad.length ? ': ' + bad.join(' | ') : ''}`);
  await page.close();
}

console.log(failures ? `\nПровалено проверок: ${failures}` : '\nВсе проверки пройдены');
await browser.close();
