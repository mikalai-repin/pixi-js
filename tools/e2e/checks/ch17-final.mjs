// Проверка главы 17 (финальный проект).
// Вариант А — режим уровней Puzzling Potions: ходы тратят только удачные ходы, после последнего хода игра
// кончается, цели считаются, копии зелий летят к иконке цели, победа и поражение, рекорд игры на время не трогается,
// карта уровней (закрытые уровни, звёзды, «Дальше»), прогресс в localStorage, в том числе испорченный.
// Вариант Б — своя Bubbo Bubbo: соседи в сетке ровно на диаметре друг от друга, ствол следует за указателем,
// прицел отражается от стен и показывает, куда встанет выстрел, прилипание, группы и падение, спуск потолка,
// победа, проигрыш и новая игра; модель и вид совпадают после каждого выстрела.
// node tools/e2e/checks/ch17-final.mjs   (STEPS=03-goals,09-game-over — только эти шаги)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { BASE_URL, CONTENT, OUT, compileDir, copyStepDir, launch, wait } from '../lib.mjs';

const C = `${CONTENT}/17-final`;
const LEVEL_STEPS = ['02-moves', '03-goals', '04-level-map'];
const BUBBLE_STEPS = ['05-bubble-field', '06-cannon', '07-shot', '08-clusters', '09-game-over'];
const ALL = [...LEVEL_STEPS, ...BUBBLE_STEPS];
const STEPS = process.env.STEPS ? process.env.STEPS.split(',') : ALL;
const from = (step, first) => ALL.indexOf(step) >= ALL.indexOf(first);
const browser = await launch();
const problems = (logs) => logs.filter((l) => /^\[(pageerror|error|warn|runtime-error|assert)\]/.test(l));

let failures = 0;
const expect = (ok, text) => {
  console.log(`  ${ok ? 'ок ' : 'НЕТ'} ${text}`);
  if (!ok) failures++;
};

/** Копия решения шага; replace — правки текста файлов: { 'levels.ts': [[было, стало]] } */
function prepare(step, name, replace = {}) {
  const dir = `${OUT}/ch17-${step}-${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  copyStepDir(`${C}/${step}/solution`, dir);
  for (const [file, pairs] of Object.entries(replace)) {
    let code = readFileSync(`${dir}/${file}`, 'utf8');
    for (const [a, b] of pairs) {
      if (!code.includes(a)) throw new Error(`${step}/${file}: нет текста «${a.slice(0, 50)}»`);
      code = code.replace(a, b);
    }
    writeFileSync(`${dir}/${file}`, code);
  }
  return dir;
}

/** Открывает чистое превью, кладёт в localStorage storage и запускает код */
async function open(dir, storage = {}, waitMs = 3500) {
  const page = await browser.newPage();
  await page.setViewport({ width: 500, height: 600 });
  const logs = [];
  page.on('console', (m) => {
    if (!m.text().includes('GL Driver')) logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${BASE_URL}/preview.html`, { waitUntil: 'networkidle0' });
  await page.evaluate((storage) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
  }, storage);
  await page.evaluate((files) => window.postMessage({ type: 'run', files, entry: 'main.js' }, '*'), compileDir(dir));
  await wait(waitMs);
  return { page, logs };
}

// ---------- помощники: Puzzling Potions ----------

const screens = (page) => page.evaluate(() => __PIXI_APP__.stage.children.flatMap((c) => c.children).map((s) => s.constructor.name));
const until = async (page, name, tries = 60) => {
  for (let i = 0; i < tries && !(await screens(page)).includes(name); i++) await wait(300);
  return (await screens(page)).includes(name);
};

async function click(page, label) {
  const p = await page.evaluate((label) => {
    const app = __PIXI_APP__;
    const k = app.canvas.clientWidth / app.screen.width;
    const obj = app.stage.getChildByLabel(label, true);
    if (!obj) return null;
    for (let o = obj; o; o = o.parent) if (!o.visible) return null;
    const g = obj.getGlobalPosition();
    return { x: g.x * k, y: g.y * k };
  }, label);
  if (p) await page.mouse.click(p.x, p.y);
  return p;
}

/** Нажимает кнопку, пока не откроется экран name: нажатие во время анимации появления экрана теряется */
async function press(page, label, name) {
  for (let i = 0; i < 30 && !(await screens(page)).includes(name); i++) {
    await click(page, label);
    await wait(500);
  }
  return until(page, name, 20);
}

/** Ждёт конца отсчёта: поле разблокировано */
async function waitBoard(page) {
  for (let i = 0; i < 40 && !(await page.evaluate(() => !!__PIXI_APP__.stage.getChildByLabel('board', true))); i++) await wait(300);
  for (let i = 0; i < 150 && (await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true)?.locked)); i++) await wait(100);
}

/** Ход: valid — с совпадением или без; prefer — типы, совпадение из которых предпочтительно */
const findMove = (page, valid = true, prefer = []) =>
  page.evaluate(
    (valid, prefer) => {
      const grid = __PIXI_APP__.stage.getChildByLabel('board', true).grid;
      const ok = (t) => t && t < 7;
      const matches = (g) => {
        const found = [];
        for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) if (ok(g[r][c]) && g[r][c] === g[r][c + 1] && g[r][c] === g[r][c + 2]) found.push(g[r][c]);
        for (let c = 0; c < 7; c++) for (let r = 0; r < 7; r++) if (ok(g[r][c]) && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 2][c]) found.push(g[r][c]);
        return found;
      };
      let any = null;
      for (let r = 8; r >= 0; r--)
        for (let c = 0; c < 7; c++)
          for (const [dr, dc] of [[0, 1], [-1, 0]]) {
            if (c + dc > 6 || r + dr < 0) continue;
            if (!ok(grid[r][c]) || !ok(grid[r + dr][c + dc]) || grid[r][c] === grid[r + dr][c + dc]) continue;
            const g = grid.map((x) => x.slice());
            [g[r][c], g[r + dr][c + dc]] = [g[r + dr][c + dc], g[r][c]];
            const m = matches(g);
            if ((m.length > 0) !== valid) continue;
            const move = { cell: { row: r, column: c }, dx: dc, dy: dr, types: m };
            if (!valid || prefer.length === 0 || m.some((t) => prefer.includes(t))) return move;
            any ??= move;
          }
      return any;
    },
    valid,
    prefer,
  );

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

async function waitIdle(page) {
  await wait(250);
  for (let i = 0; i < 100 && (await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true)?.isProcessing)); i++) await wait(100);
}

/** Текст в котле (ходы или время) и подпись «ходы» */
const hudState = (page) =>
  page.evaluate(() => {
    const hud = __PIXI_APP__.stage.getChildByLabel('hud', true);
    const content = hud.cauldron.children.find((c) => c !== hud.cauldron.spine);
    return { value: content.children[0].text, caption: content.children[1]?.visible ?? false };
  });

/** Все надписи на текущем экране */
const texts = (page) =>
  page.evaluate(() => {
    const out = [];
    const walk = (o) => {
      if (typeof o.text === 'string' && o.text && o.visible !== false) out.push(o.text);
      o.children?.forEach(walk);
    };
    walk(__PIXI_APP__.stage);
    return out;
  });

const goals = (page) =>
  page.evaluate(() => {
    const g = __PIXI_APP__.stage.getChildByLabel('goals', true);
    return g ? g.children.map((c) => ({ texture: c.children[0].texture.label, count: c.children[1].text, done: c.children[2].visible })) : null;
  });

// Уровни для проверок: короткие, чтобы не играть по двадцать ходов
const LEVELS_RE = /export const LEVELS: Level\[\] = \[[\s\S]*?\];\n/;
function withLevels(dir, levels) {
  const file = `${dir}/levels.ts`;
  const code = readFileSync(file, 'utf8');
  if (!LEVELS_RE.test(code)) throw new Error(`${file}: не найден LEVELS`);
  writeFileSync(file, code.replace(LEVELS_RE, `export const LEVELS: Level[] = ${levels};\n`));
  return dir;
}

// ---------- Вариант А ----------

for (const step of STEPS.filter((s) => LEVEL_STEPS.includes(s))) {
  console.log(`\n# ${step}`);

  // --- Ходы: только удачные ходы тратятся, после последнего — конец ---
  {
    let dir = prepare(step, 'moves');
    dir = withLevels(dir, step === '02-moves' ? '[{ moves: 3 }]' : "[{ moves: 3, goals: [{ piece: 'piece-frog', count: 99 }] }]");
    const { page, logs } = await open(dir);
    if (from(step, '04-level-map')) {
      expect(await press(page, 'levelsButton', 'LevelsScreen'), 'кнопка «Уровни» открывает карту уровней');
      await press(page, 'level1', 'GameScreen');
    } else {
      await press(page, 'levelsButton', 'GameScreen');
    }
    await waitBoard(page);
    let hud = await hudState(page);
    expect(hud.value === '3' && hud.caption, `в котле — ходы: «${hud.value}», подпись «ходы» видна: ${hud.caption}`);
    const bad = await findMove(page, false);
    await swipe(page, bad);
    await waitIdle(page);
    hud = await hudState(page);
    expect(hud.value === '3', `неудачный ход не тратит ход: ${hud.value}`);
    for (let i = 0; i < 3; i++) {
      await swipe(page, await findMove(page));
      await wait(150);
      if (i < 2) await waitIdle(page);
    }
    hud = await hudState(page);
    const locked = await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true).locked);
    expect(hud.value === '0' && locked, `после третьего хода: «${hud.value}», поле закрыто: ${locked}`);
    await waitIdle(page);
    await wait(400);
    const t = await texts(page);
    expect(t.includes('Ходы кончились!'), `надпись «Ходы кончились!»: ${t.includes('Ходы кончились!')}`);
    expect(await until(page, 'ResultScreen'), 'после конца ходов — экран результата');
    await wait(4500);
    const result = await texts(page);
    if (step === '02-moves') {
      expect(result.includes('Результат'), `результат игры на ходы: ${result.filter((x) => x.length < 30).join(' | ')}`);
    } else {
      expect(result.includes('Уровень не пройден') && result.includes('Попробуйте ещё раз'), `поражение: ${result.filter((x) => x.length < 30).join(' | ')}`);
      const stars = await page.evaluate(() => {
        let n = 0;
        const walk = (o) => {
          if (o.texture?.label?.includes?.('star') && o.alpha === 1 && o.visible) n++;
          o.children?.forEach(walk);
        };
        walk(__PIXI_APP__.stage);
        return n;
      });
      expect(stars === 0, `звёзд за проигранный уровень: ${stars}`);
      const best = await page.evaluate(() => localStorage.getItem('puzzling-potions:best-score'));
      expect(best === null, `счёт уровня не стал рекордом игры на время: ${best}`);
      const buttons = await texts(page);
      if (from(step, '04-level-map')) expect(buttons.includes('Ещё раз') && buttons.includes('Уровни'), 'после поражения — «Ещё раз» и «Уровни»');
    }
    expect(problems(logs).length === 0, `без ошибок: ${problems(logs).join(' | ')}`);
    await page.close();
  }

  // --- Игра на время осталась прежней ---
  {
    const { page, logs } = await open(prepare(step, 'time'));
    await press(page, 'playButton', 'GameScreen');
    await waitBoard(page);
    const hud = await hudState(page);
    expect(/^\d:\d\d$/.test(hud.value) && !hud.caption, `«Играть» — игра на время: «${hud.value}», подпись скрыта`);
    if (from(step, '03-goals')) expect((await goals(page)) === null, 'в игре на время целей нет');
    expect(problems(logs).length === 0, `без ошибок: ${problems(logs).join(' | ')}`);
    await page.close();
  }

  if (!from(step, '03-goals')) continue;

  // --- Цели: счёт, полёт к иконке, победа ---
  {
    const dir = withLevels(prepare(step, 'goals'), "[{ moves: 30, goals: [{ piece: 'piece-frog', count: 3 }, { piece: 'piece-dragon', count: 3 }] }, { moves: 16, goals: [{ piece: 'piece-dragon', count: 12 }, { piece: 'piece-newt', count: 12 }] }]");
    const { page, logs } = await open(dir);
    if (from(step, '04-level-map')) {
      await press(page, 'levelsButton', 'LevelsScreen');
      await press(page, 'level1', 'GameScreen');
    } else {
      await press(page, 'levelsButton', 'GameScreen');
    }
    await waitBoard(page);
    let g = await goals(page);
    expect(g?.length === 2 && g[0].texture.includes('piece-frog') && g[0].count === '3', `панель целей: ${JSON.stringify(g)}`);
    const icons = await page.evaluate(() => {
      const g = __PIXI_APP__.stage.getChildByLabel('goals', true);
      const hud = __PIXI_APP__.stage.getChildByLabel('hud', true);
      return { frog: g.children[0].children[0].getGlobalPosition(), dragon: g.children[1].children[0].getGlobalPosition(), cauldron: hud.getCauldronPosition() };
    });
    // Записываем, где копии уходят обратно в пул: это точка прилёта
    await page.evaluate(() => {
      const fx = __PIXI_APP__.stage.getChildByLabel('effects', true);
      window.__landed = [];
      const giveBack = fx.copies.giveBack.bind(fx.copies);
      fx.copies.giveBack = (copy) => {
        window.__landed.push({ texture: copy.texture.label, ...copy.getGlobalPosition() });
        giveBack(copy);
      };
    });
    let finalGoals = null;
    for (let i = 0; i < 25; i++) {
      if (!(await screens(page)).includes('GameScreen')) break;
      if (await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true).locked)) {
        // Поле закрылось: цели выполнены. Панель читаем сейчас, пока экран игры на месте
        await wait(500);
        finalGoals = await goals(page);
        break;
      }
      g = await goals(page);
      const prefer = g.filter((x) => !x.done).map((x) => (x.texture.includes('frog') ? 2 : 1));
      await swipe(page, await findMove(page, true, prefer));
      await waitIdle(page);
    }
    await wait(1500);
    const landed = await page.evaluate(() => window.__landed);
    const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 35;
    const toFrog = landed.filter((l) => l.texture.includes('frog'));
    const toIcon = toFrog.filter((l) => near(l, icons.frog)).length;
    const toDragon = landed.filter((l) => l.texture.includes('dragon'));
    const toDragonIcon = toDragon.filter((l) => near(l, icons.dragon)).length;
    const others = landed.filter((l) => !l.texture.includes('frog') && !l.texture.includes('dragon'));
    expect(toFrog.length >= 3 && toIcon >= 3, `копии лягушек у иконки цели: ${toIcon} из ${toFrog.length}`);
    expect(toDragon.length >= 3 && toDragonIcon >= 3, `копии драконов у иконки цели: ${toDragonIcon} из ${toDragon.length}`);
    expect(others.every((l) => near(l, icons.cauldron)), `остальные зелья — в котёл: ${others.filter((l) => near(l, icons.cauldron)).length} из ${others.length}`);
    g = finalGoals;
    expect(g?.every((x) => x.done && x.count === '0'), `цели выполнены, вместо чисел — звёзды: ${JSON.stringify(g?.map((x) => [x.count, x.done]))}`);
    expect(await until(page, 'ResultScreen'), 'после победы — экран результата');
    await wait(4500);
    const t = await texts(page);
    expect(t.includes('Уровень 1 пройден!') && t.some((x) => x.startsWith('Ходов в запасе: ')), `победа: ${t.filter((x) => x.length < 30).join(' | ')}`);
    if (from(step, '04-level-map')) {
      const saved = await page.evaluate(() => localStorage.getItem('puzzling-potions:levels'));
      expect(/^\[[123]\]$/.test(saved), `прогресс в localStorage: ${saved}`);
      expect(t.includes('Дальше') && t.includes('Уровни'), 'после победы — «Дальше» и «Уровни»');
      expect(await press(page, 'menuButton', 'LevelsScreen'), '«Уровни» ведёт на карту уровней');
      await wait(1200);
      const map = await page.evaluate(() => [1, 2].map((n) => { const b = __PIXI_APP__.stage.getChildByLabel(`level${n}`, true); return { alpha: b.alpha, mode: b.eventMode }; }));
      expect(map[1].alpha === 1 && map[1].mode === 'static', `второй уровень открылся: ${JSON.stringify(map[1])}`);
      await press(page, 'level2', 'GameScreen');
      await waitBoard(page);
      g = await goals(page);
      expect(g?.length === 2 && g[0].texture.includes('piece-dragon') && g[1].texture.includes('piece-newt'), `уровень 2 — свои цели: ${g?.map((x) => x.texture).join(', ')}`);
    }
    expect(problems(logs).length === 0, `без ошибок: ${problems(logs).join(' | ')}`);
    await page.close();
  }

  if (!from(step, '04-level-map')) continue;

  // --- Карта уровней: закрытые уровни, звёзды, испорченный прогресс ---
  for (const [saved, expectStars, text] of [
    [null, [0, 0, 0, 0, 0], 'без прогресса'],
    ['[3,1]', [3, 1, 0, 0, 0], 'прогресс [3,1]'],
    ['{"a":1}', [0, 0, 0, 0, 0], 'в localStorage объект'],
    ['[5,"x",2]', [0, 0, 2, 0, 0], 'числа вне 0–3 и строки'],
    ['не json', [0, 0, 0, 0, 0], 'испорченная строка'],
  ]) {
    const { page, logs } = await open(prepare(step, 'map'), saved === null ? {} : { 'puzzling-potions:levels': saved });
    await press(page, 'levelsButton', 'LevelsScreen');
    await wait(1200);
    const cells = await page.evaluate(() =>
      [1, 2, 3, 4, 5].map((n) => {
        const b = __PIXI_APP__.stage.getChildByLabel(`level${n}`, true);
        const stars = b.parent.children.filter((c) => c !== b && c.alpha === 1).length;
        return { open: b.eventMode === 'static', stars };
      }),
    );
    const opened = cells.map((c) => c.open);
    const wantOpen = expectStars.map((_, i) => i === 0 || expectStars[i - 1] > 0);
    expect(
      JSON.stringify(cells.map((c) => c.stars)) === JSON.stringify(expectStars) && JSON.stringify(opened) === JSON.stringify(wantOpen),
      `${text}: звёзды ${cells.map((c) => c.stars).join(',')}, открыты ${opened.map(Number).join(',')}`,
    );
    if (!saved) {
      await click(page, 'level2');
      await wait(800);
      expect((await screens(page)).includes('LevelsScreen'), 'закрытый уровень не нажимается');
    }
    expect(problems(logs).length === 0, `без ошибок: ${problems(logs).join(' | ')}`);
    await page.close();
  }
}

// ---------- помощники: пузыри ----------

const GAME = '__PIXI_APP__.stage.children.find((c) => c.cannon || c.field)';

async function toPage(page, x, y) {
  return page.evaluate(
    (x, y, GAME) => {
      const g = eval(GAME);
      const app = __PIXI_APP__;
      const k = app.canvas.clientWidth / app.screen.width;
      const p = g.toGlobal({ x, y });
      return { x: p.x * k, y: p.y * k };
    },
    x,
    y,
    GAME,
  );
}

/** Наводит указатель под углом angle (рад от вертикали) от пушки; click — и стреляет */
async function aimAt(page, angle, click = false) {
  const c = await page.evaluate((GAME) => { const { x, y } = eval(GAME).cannon; return { x, y }; }, GAME);
  const p = await toPage(page, c.x + Math.sin(angle) * 150, c.y - Math.cos(angle) * 150);
  await page.mouse.move(p.x, p.y);
  if (click) await page.mouse.click(p.x, p.y);
}

/** Состояние игры и согласованность модели и вида */
const bubbleState = (page) =>
  page.evaluate((GAME) => {
    const g = eval(GAME);
    const bad = [];
    g.grid.forEach((cells, row) =>
      cells.forEach((type, column) => {
        const v = g.views[row][column];
        if (!!type !== !!v) bad.push(`${row}:${column} модель ${type}, вид ${!!v}`);
        if (v && v.type !== type) bad.push(`${row}:${column} цвет`);
        if (v && v.parent !== g.field) bad.push(`${row}:${column} не в поле`);
      }),
    );
    return { state: g.state, score: g.score, drops: g.drops, shots: g.shots, count: g.grid.flat().filter(Boolean).length, falling: g.falling?.children.length ?? 0, fieldY: g.field.y, bad };
  }, GAME);

async function waitAiming(page) {
  for (let i = 0; i < 60; i++) {
    const s = await bubbleState(page);
    if (s.state !== 'flying') return s;
    await wait(100);
  }
  return bubbleState(page);
}

/** Подставное поле: cells — [ряд, столбец, цвет], в пушке — цвет loaded */
const rig = (page, cells, loaded) =>
  page.evaluate(
    (cells, loaded, GAME) => {
      const g = eval(GAME);
      for (const row of g.views) for (const v of row) v?.destroy();
      g.grid = g.grid.map((r) => r.map(() => 0));
      g.views = g.grid.map((r) => r.map(() => null));
      for (const [row, column, type] of cells) {
        g.grid[row][column] = type;
        g.views[row][column] = g.createBubble({ row, column }, type);
      }
      g.cannon.unload()?.destroy();
      g.cannon.load(loaded);
    },
    cells,
    loaded,
    GAME,
  );

/** Выстрел из точки сетки (x, y) прямо вверх: так пузырь встаёт в нужную клетку верхнего ряда */
const shootFrom = (page, x, y) =>
  page.evaluate(
    (x, y, GAME) => {
      const g = eval(GAME);
      const bubble = g.cannon.unload();
      bubble.position.set(x, y);
      g.field.addChild(bubble);
      g.flying = { bubble, shot: { x, y, dx: 0, dy: -1 } };
      g.state = 'flying';
    },
    x,
    y,
    GAME,
  );

// ---------- Вариант Б ----------

for (const step of STEPS.filter((s) => BUBBLE_STEPS.includes(s))) {
  console.log(`\n# ${step}`);
  const { page, logs } = await open(prepare(step, 'play'));

  // Шестиугольная сетка: у каждой пары соседей центры ровно на диаметре
  const geometry = await page.evaluate((GAME) => {
    const g = eval(GAME);
    const views = g.views.flat().filter(Boolean);
    let pairs = 0;
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < views.length; i++)
      for (let j = i + 1; j < views.length; j++) {
        const d = Math.hypot(views[i].x - views[j].x, views[i].y - views[j].y);
        min = Math.min(min, d);
        if (d < 41) {
          pairs++;
          max = Math.max(max, d);
        }
      }
    const xs = views.map((v) => v.x);
    return { count: views.length, pairs, min: +min.toFixed(3), max: +max.toFixed(3), left: Math.min(...xs), right: Math.max(...xs) };
  }, GAME);
  expect(geometry.count === 48 && geometry.min === 40 && geometry.max === 40, `48 пузырей, соседи ровно на 40 пикселях: ${JSON.stringify(geometry)}`);
  expect(geometry.left === 20 && geometry.right === 380, `крайние пузыри касаются стен: x от ${geometry.left} до ${geometry.right}`);

  if (from(step, '06-cannon')) {
    await aimAt(page, 0.5);
    await wait(200);
    let aim = await page.evaluate((GAME) => eval(GAME).cannon.aim, GAME);
    expect(Math.abs(aim - 0.5) < 0.02, `ствол следует за указателем: ${aim.toFixed(3)}`);
    await aimAt(page, -1.55);
    await wait(200);
    aim = await page.evaluate((GAME) => eval(GAME).cannon.aim, GAME);
    expect(Math.abs(aim + 1.35) < 1e-9, `угол ограничен: ${aim.toFixed(3)}`);
    // Прицел под крутым углом отражается от стены: x точек уходит влево, затем возвращается
    await aimAt(page, -1.2);
    await wait(200);
    const dots = await page.evaluate((GAME) => eval(GAME).aim.children.filter((d) => d.visible).map((d) => ({ x: d.x, y: d.y })), GAME);
    const minX = Math.min(...dots.map((d) => d.x));
    const turn = dots.findIndex((d) => d.x === minX);
    expect(dots.length > 5 && minX >= 20 && turn > 0 && turn < dots.length - 1 && dots.at(-1).x > minX + 40, `прицел отражается от стены: ${dots.length} точек, ближе всего к стене x = ${minX.toFixed(1)}`);
    expect(dots.every((d, i) => i === 0 || d.y <= dots[i - 1].y + 1e-9), 'прицел всё время идёт вверх');
  }

  if (from(step, '07-shot')) {
    // Прицел не врёт: пузырь встаёт рядом с последней точкой прицела
    let mismatched = 0;
    for (let i = 0; i < 12; i++) {
      const angle = -1.2 + Math.random() * 2.4;
      await aimAt(page, angle);
      await wait(150);
      const last = await page.evaluate((GAME) => { const d = eval(GAME).aim.children.filter((d) => d.visible).at(-1); return { x: d.x, y: d.y }; }, GAME);
      const before = await page.evaluate((GAME) => eval(GAME).views.map((r) => r.map(Boolean)), GAME);
      await aimAt(page, angle, true);
      const s = await waitAiming(page);
      await wait(100);
      const placed = await page.evaluate(
        (before, GAME) => {
          const g = eval(GAME);
          for (let r = 0; r < g.views.length; r++) for (let c = 0; c < g.views[r].length; c++) if (g.views[r][c] && !before[r][c]) return { x: g.views[r][c].x, y: g.views[r][c].y };
          return null;
        },
        before,
        GAME,
      );
      if (s.bad.length) console.log('   несогласованность:', s.bad.join(', '));
      if (placed && Math.hypot(placed.x - last.x, placed.y - last.y) > 40) mismatched++;
      if (s.state === 'over') break;
    }
    const s = await bubbleState(page);
    expect(s.bad.length === 0, `модель и вид совпадают после 12 выстрелов (${s.count} пузырей)`);
    expect(mismatched === 0, `пузырь встаёт у последней точки прицела: расхождений ${mismatched}`);
  }

  if (from(step, '08-clusters')) {
    // Красные (0,0) и (0,1), под ними синий (1,0). Красный встаёт в (0,2): три красных лопаются, синий падает
    await rig(page, [[0, 0, 1], [0, 1, 1], [1, 0, 3], [0, 9, 2]], 1);
    const before = await bubbleState(page);
    await shootFrom(page, 100, 60);
    let s = await waitAiming(page);
    expect(s.count === 1 && s.score - before.score === 50, `три красных лопнули, синий упал: осталось ${s.count}, +${s.score - before.score} очков`);
    expect(s.falling === 1, `падает пузырей: ${s.falling}`);
    await wait(1500);
    s = await bubbleState(page);
    expect(s.falling === 0, 'упавший пузырь удалён, когда ушёл за экран');
  }

  if (from(step, '09-game-over')) {
    // Потолок опускается после каждого шестого выстрела
    await page.evaluate((GAME) => eval(GAME).start(), GAME);
    await wait(500);
    for (let i = 0; i < 6; i++) {
      await aimAt(page, i % 2 ? 0.9 : -0.9, true);
      await waitAiming(page);
      await wait(400);
    }
    let s = await bubbleState(page);
    expect(s.drops === 1 && Math.abs(s.fieldY - (60 + (40 * Math.sqrt(3)) / 2)) < 1e-6, `после 6 выстрелов потолок опустился на ряд: drops ${s.drops}, y ${s.fieldY.toFixed(2)}`);
    // Победа: на поле только два красных, третий их добивает
    await rig(page, [[0, 0, 1], [0, 1, 1]], 1);
    await shootFrom(page, 100, 60);
    s = await waitAiming(page);
    let t = await texts(page);
    expect(s.state === 'over' && t.some((x) => x.startsWith('Победа!')), `поле пустое — победа: ${t.find((x) => x.includes('Очки'))?.replace(/\n/g, ' / ')}`);
    // Новая игра по нажатию
    await aimAt(page, 0, true);
    await wait(500);
    s = await bubbleState(page);
    expect(s.state === 'aiming' && s.count === 48 && s.score === 0 && s.drops === 0 && s.fieldY === 60, `нажатие — новая игра: ${JSON.stringify({ state: s.state, count: s.count, score: s.score, drops: s.drops })}`);
    // Проигрыш: пузырь в ряду 11, выстрел без совпадения
    await rig(page, [[0, 0, 2], [11, 4, 3]], 1);
    await shootFrom(page, 300, 60);
    s = await waitAiming(page);
    t = await texts(page);
    expect(s.state === 'over' && t.some((x) => x.startsWith('Игра окончена')), 'пузырь за линией — проигрыш');
  }

  expect(problems(logs).length === 0, `без ошибок: ${problems(logs).join(' | ')}`);
  await page.close();
}

await browser.close();
console.log(failures === 0 ? '\nВсе проверки пройдены' : `\nНе пройдено: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
