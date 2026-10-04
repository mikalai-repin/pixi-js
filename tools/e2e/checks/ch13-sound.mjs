// Проверка главы 13: какие звуки и с какими параметрами звучат в ответ на действия, музыка сменяется
// с кроссфейдом, звук молчит до первого нажатия и в фоне, глохнет под паузой, громкость применяется
// и сохраняется в localStorage, в практикуме — звуки кнопок, отсчёта и экрана результата.
// node tools/e2e/checks/ch13-sound.mjs   (STEPS=04-autoplay,08-practice — только эти шаги)
// Звук в headless заглушён (--mute-audio), но контекст WebAudio работает: время идёт, анализатор видит сигнал.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { BASE_URL, CONTENT, OUT, compileDir, copyStepDir, launch, wait } from '../lib.mjs';

const C = `${CONTENT}/13-sound`;
const browser = await launch();
const problems = (logs) => logs.filter((l) => /^\[(pageerror|error|warn|runtime-error|assert)\]/.test(l));
const ALL = ['01-pixi-sound', '02-sfx', '03-music', '04-autoplay', '05-sound-filters', '06-volume', '07-save-settings', '08-practice'];
const STEPS = process.env.STEPS ? process.env.STEPS.split(',') : ALL;
const from = (step, first) => ALL.indexOf(step) >= ALL.indexOf(first);

/** Копия решения шага с укороченной игрой */
function prepare(step, gameTime = 20000) {
  const dir = `${OUT}/ch13-${step}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  copyStepDir(`${C}/${step}/solution`, dir);
  const screen = `${dir}/GameScreen.ts`;
  writeFileSync(screen, readFileSync(screen, 'utf8').replace('const GAME_TIME = 60_000;', `const GAME_TIME = ${gameTime};`));
  // Пороги звёзд пониже: за короткую игру хотя бы две звезды
  const stats = `${dir}/stats.ts`;
  writeFileSync(stats, readFileSync(stats, 'utf8').replace('const GRADE_SCORES = [200, 600, 1200];', 'const GRADE_SCORES = [10, 20, 1e9];'));
  return dir;
}

/**
 * Открывает превью и до запуска кода ставит «шпиона» на Sound.prototype.play: каждый звук пишется
 * в window.__played как { alias, volume, speed, loop, t }. gesture: false — запуск без жеста пользователя
 * (page.evaluate в puppeteer по умолчанию считается жестом, и политика autoplay не проявилась бы)
 */
async function open(files, { gesture = true, storage } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 500, height: 600 });
  const logs = [];
  page.on('console', (m) => {
    const text = m.text();
    if (!text.includes('GL Driver') && !text.includes('AudioContext was not allowed')) logs.push(`[${m.type()}] ${text}`);
  });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${BASE_URL}/preview.html`, { waitUntil: 'networkidle0' });
  const cdp = await page.createCDPSession();
  const run = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, userGesture: gesture, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  if (storage !== undefined) await run(`localStorage.clear(); ${Object.entries(storage).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`).join(';')}`);
  await run(`(async () => {
    window.__runtimeErrors = [];
    window.addEventListener('message', (e) => {
      if (e.data?.source === 'pixi-course-preview' && e.data.type === 'error') window.__runtimeErrors.push(e.data.text);
    });
    const { sound, Sound } = await import('@pixi/sound');
    window.__sound = sound;
    window.__played = [];
    const play = Sound.prototype.play;
    Sound.prototype.play = function (options) {
      const alias = Object.keys(sound._sounds).find((k) => sound._sounds[k] === this);
      const o = typeof options === 'object' && options ? options : {};
      window.__played.push({ alias, volume: o.volume ?? 1, speed: o.speed ?? 1, loop: !!o.loop, t: Math.round(performance.now()) });
      return play.call(this, options);
    };
  })()`);
  await run(`window.postMessage({ type: 'run', files: ${JSON.stringify(files)}, entry: 'main.js' }, '*')`);
  await wait(3000);
  return { page, logs, run };
}

const flushErrors = async (page, logs) => {
  for (const text of await page.evaluate(() => window.__runtimeErrors.splice(0))) logs.push(`[runtime-error] ${text}`);
};

/** Звуки, сыгранные после отметки времени since */
const played = (page, since = 0) => page.evaluate((since) => window.__played.filter((p) => p.t >= since), since);
const now = (page) => page.evaluate(() => Math.round(performance.now()));
const short = (list) => list.map((p) => `${p.alias.replace('common/', '').replace(/\.(wav|mp3)$/, '')}${p.volume !== 1 ? ` v${+p.volume.toFixed(3)}` : ''}${p.speed !== 1 ? ` x${+p.speed.toFixed(3)}` : ''}`).join(', ');

/** Состояние музыкальных дорожек: громкость Sound, число копий, прогресс первой копии */
const music = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      ['common/bgm-main.mp3', 'common/bgm-game.mp3'].map((a) => {
        const s = window.__sound.find(a);
        return [a.replace('common/', '').replace('.mp3', ''), { volume: +s.volume.toFixed(2), instances: s.instances.length, progress: s.instances[0] ? +s.instances[0].progress.toFixed(4) : null }];
      }),
    ),
  );

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

/** Ход с совпадением (valid) или без него: { cell, dx, dy } */
const findMove = (page, valid) =>
  page.evaluate((valid) => {
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
          if (!ok(grid[r][c]) || !ok(grid[r + dr][c + dc])) continue;
          const g = grid.map((x) => x.slice());
          [g[r][c], g[r + dr][c + dc]] = [g[r + dr][c + dc], g[r][c]];
          if (has(g) === valid) return { cell: { row: r, column: c }, dx: dc, dy: dr };
        }
    return null;
  }, valid);

const idle = async (page) => {
  for (let i = 0; i < 100; i++) {
    if (!(await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true)?.isProcessing))) return;
    await wait(100);
  }
};

async function startGame(page) {
  for (let i = 0; i < 40 && !(await page.evaluate(() => !!__PIXI_APP__.stage.getChildByLabel('board', true))); i++) {
    await click(page, 'playButton');
    await wait(500);
  }
  for (let i = 0; i < 150 && (await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true).locked)); i++) await wait(100);
}

const screenName = (page) => page.evaluate(() => __PIXI_APP__.stage.children.flatMap((c) => c.children).map((s) => s.constructor.name).join('+'));
const hasPopup = (page, name) => page.evaluate((name) => __PIXI_APP__.stage.children.flatMap((c) => c.children).some((s) => s.constructor.name === name), name);

async function closePopup(page, name, button) {
  for (let i = 0; i < 30 && (await hasPopup(page, name)); i++) {
    await click(page, button);
    await wait(400);
  }
}

/**
 * Средний уровень звука в полосах частот, дБ, за 0,5 с: свой анализатор после компрессора контекста,
 * то есть уже после фильтров sound.filtersAll
 */
const BANDS = [[250, 500], [1000, 2000], [2000, 4000], [4000, 8000]];
const spectrum = (page) =>
  page.evaluate(async (bands) => {
    const ctx = window.__sound.context;
    if (!window.__probe) {
      window.__probe = ctx.audioContext.createAnalyser();
      // Без сглаживания: иначе каждый замер на 80 % состоит из предыдущего
      window.__probe.smoothingTimeConstant = 0;
      ctx.compressor.connect(window.__probe);
    }
    const a = window.__probe;
    const data = new Float32Array(a.frequencyBinCount);
    const hz = ctx.audioContext.sampleRate / a.fftSize;
    const sums = bands.map(() => 0);
    for (let k = 0; k < 10; k++) {
      await new Promise((r) => setTimeout(r, 50));
      a.getFloatFrequencyData(data);
      bands.forEach(([lo, hi], b) => {
        let s = 0, n = 0;
        data.forEach((v, i) => { if (i * hz >= lo && i * hz < hi) { s += Math.max(v, -140); n++; } });
        sums[b] += s / n / 10;
      });
    }
    return sums.map((v) => Math.round(v));
  }, BANDS);

/** Тянет слайдер с меткой label в положение fraction: 0 — левый край, 1 — правый */
async function dragSlider(page, label, fraction) {
  const s = await page.evaluate((label) => {
    const app = __PIXI_APP__;
    const k = app.canvas.clientWidth / app.screen.width;
    const slider = app.stage.getChildByLabel(label, true);
    const h = slider.slider1.getGlobalPosition();
    const left = slider.getGlobalPosition();
    return { x: h.x * k, y: h.y * k, left: left.x * k, w: 240 * slider.worldTransform.a * k };
  }, label);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.left + s.w * fraction, s.y, { steps: 8 });
  await page.mouse.up();
  await wait(300);
}

const sliderValues = (page) =>
  page.evaluate(() => ['musicSlider', 'sfxSlider'].map((l) => __PIXI_APP__.stage.getChildByLabel(l, true)?.value));

let failures = 0;
const expect = (ok, text) => {
  console.log(`  ${ok ? 'ок ' : 'НЕТ'} ${text}`);
  if (!ok) failures++;
};

for (const step of STEPS) {
  console.log(`\n# ${step}`);
  const dir = prepare(step);
  const files = compileDir(dir);
  const { page, logs } = await open(files, { storage: {} });

  // --- Меню и музыка меню ---
  if (from(step, '03-music')) {
    await wait(1200);
    const m = await music(page);
    console.log('  меню:', JSON.stringify(m));
    expect(m['bgm-main'].instances === 1 && m['bgm-main'].volume === 1, 'в меню играет bgm-main, громкость Sound нарастает до 1');
    const loop = (await played(page)).find((p) => p.alias === 'common/bgm-main.mp3');
    expect(loop?.loop && loop.volume === 0.7, `bgm-main — по кругу, громкость копии 0.7 (${JSON.stringify(loop)})`);
  }

  if (step === '08-practice') {
    const t = await now(page);
    const p = await page.evaluate(() => {
      const app = __PIXI_APP__;
      const k = app.canvas.clientWidth / app.screen.width;
      const g = app.stage.getChildByLabel('playButton', true).getGlobalPosition();
      return { x: g.x * k, y: g.y * k };
    });
    await page.mouse.move(p.x - 200, p.y - 200);
    await page.mouse.move(p.x, p.y, { steps: 4 });
    await wait(200);
    const hover = await played(page, t);
    expect(hover.some((s) => s.alias === 'common/sfx-hover.wav'), `наведение на «Играть»: ${short(hover)}`);
  }

  // --- Игра ---
  const tGame = await now(page);
  await startGame(page);
  if (step === '08-practice') {
    const list = await played(page, tGame);
    const counts = list.filter((s) => s.alias === 'common/sfx-countdown.wav');
    expect(list.some((s) => s.alias === 'common/sfx-press.wav'), 'нажатие «Играть» — sfx-press');
    expect(counts.length === 6 && counts.filter((s) => s.speed === 0.8).length === 5 && counts.at(-1).speed === 1.2, `отсчёт: ${short(counts)}`);
  }
  if (from(step, '03-music')) {
    await wait(1200);
    const m = await music(page);
    console.log('  игра:', JSON.stringify(m));
    expect(m['bgm-main'].instances === 0 && m['bgm-game'].instances === 1 && m['bgm-game'].volume === 1, 'в игре: bgm-main остановлена, bgm-game играет');
    const game = (await played(page, tGame)).find((p) => p.alias === 'common/bgm-game.mp3');
    expect(game?.volume === 0.5, 'bgm-game: громкость копии 0.5');
  }

  // Удачный ход
  let t = await now(page);
  const good = await findMove(page, true);
  if (good) {
    await swipe(page, good.cell, good.dx, good.dy);
    await wait(400);
    await idle(page);
    await wait(1500);
    const list = await played(page, t);
    console.log('  удачный ход:', short(list));
    expect(list.some((s) => s.alias === 'common/sfx-match.wav'), 'совпадение — sfx-match');
    if (from(step, '02-sfx')) {
      expect(list[0]?.alias === 'common/sfx-correct.wav' && list[0].volume === 0.5, 'первым — sfx-correct с громкостью 0.5');
      expect(list.filter((s) => s.alias === 'common/sfx-match.wav')[0]?.speed === 1, 'первый раунд — sfx-match со скоростью 1');
      expect(list.some((s) => s.alias === 'common/sfx-bubble.wav'), 'копии долетели до счёта — sfx-bubble');
    }
  } else console.log('  нет удачного хода');

  if (from(step, '02-sfx')) {
    t = await now(page);
    const bad = await findMove(page, false);
    await swipe(page, bad.cell, bad.dx, bad.dy);
    await wait(300);
    await idle(page);
    const list = await played(page, t);
    expect(list.length === 1 && list[0].alias === 'common/sfx-incorrect.wav' && list[0].volume === 0.5, `ход без совпадения: ${short(list)}`);
    t = await now(page);
    await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('effects', true).onMatch(3));
    const combo = (await played(page, t)).find((s) => s.alias === 'common/sfx-match.wav');
    expect(Math.abs(combo.speed - 2 ** (2 / 12)) < 1e-9, `третий раунд комбо — на два полутона выше: скорость ${combo.speed.toFixed(4)}`);
    await wait(700);
  }

  // --- Пауза: звуковой фильтр ---
  if (from(step, '05-sound-filters')) {
    // Музыка почти вся в низких частотах, её верх и так у порога шума: для замера играем звонкий sfx-special
    const probe = () => page.evaluate(() => window.__sound.play('common/sfx-special.wav'));
    await probe();
    const before = await spectrum(page);
    await wait(3200);
    await click(page, 'pauseButton');
    await wait(900);
    const paused = await page.evaluate(() => {
      const f = window.__sound.filtersAll;
      return { count: f?.length ?? 0, bands: f?.[0] ? [f[0].f1k, f[0].f2k, f[0].f4k, f[0].f8k, f[0].f16k] : null };
    });
    await probe();
    const during = await spectrum(page);
    expect(paused.count === 1 && paused.bands.join() === '-10,-20,-40,-40,-40', `под паузой фильтр на всём звуке, полосы ${paused.bands}`);
    const drop = before.map((v, i) => v - during[i]);
    console.log('  полосы', BANDS.map(([lo, hi]) => `${lo}–${hi}`).join(', '), 'Гц, дБ: без паузы', before.join(' '), '| под паузой', during.join(' '), '| разница', drop.join(' '));
    expect(drop[0] < 10 && drop[2] > 30 && drop[3] > 30, 'под паузой низкие частоты почти те же, высокие тише на 30+ дБ');
    await closePopup(page, 'PausePopup', 'resumeButton');
    await wait(300);
    const after = await page.evaluate(() => window.__sound.filtersAll?.length ?? 0);
    await wait(3200);
    await probe();
    const restored = await spectrum(page);
    expect(after === 0, `после «Продолжить» фильтров нет; полосы снова ${restored.join(' ')}`);
  }

  // --- Вкладка в фоне ---
  if (from(step, '04-autoplay')) {
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(400);
    const p1 = (await music(page))['bgm-game'].progress;
    await wait(1000);
    const hidden = await page.evaluate(() => ({ paused: window.__sound.context.paused, state: window.__sound.context.audioContext.state }));
    const p2 = (await music(page))['bgm-game'].progress;
    expect(hidden.paused && hidden.state === 'suspended' && p1 === p2, `вкладка скрыта: ${JSON.stringify(hidden)}, прогресс музыки стоит (${p1} → ${p2})`);
    expect(await hasPopup(page, 'PausePopup'), 'и открылась пауза');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(600);
    const p3 = (await music(page))['bgm-game'].progress;
    expect(p3 > p2 && (await page.evaluate(() => window.__sound.context.audioContext.state)) === 'running', `вкладка снова видна: музыка идёт дальше (${p2} → ${p3})`);
    await closePopup(page, 'PausePopup', 'resumeButton');
  }

  // --- Настройки громкости ---
  if (from(step, '06-volume')) {
    t = await now(page);
    await click(page, 'settingsButton');
    await wait(900);
    if (step === '08-practice') {
      const list = await played(page, t);
      expect(list.some((s) => s.alias === 'common/sfx-press.wav'), `кнопка настроек (FancyButton): ${short(list)}`);
    }
    expect((await sliderValues(page)).join() === '100,100', 'слайдеры начинают со 100 %');
    t = await now(page);
    await dragSlider(page, 'musicSlider', 0.5);
    await dragSlider(page, 'sfxSlider', 0.5);
    const vals = await sliderValues(page);
    const m = await music(page);
    const release = (await played(page, t)).filter((s) => s.alias === 'common/sfx-press.wav');
    expect(vals.join() === '50,50' && m['bgm-game'].volume === 0.5, `слайдеры ${vals}; громкость bgm-game ${m['bgm-game'].volume}`);
    expect(release.some((s) => s.volume === 0.5), `отпустили слайдер звуков — проба громкости: ${short(release)}`);
    t = await now(page);
    await closePopup(page, 'SettingsPopup', 'doneButton');
    await wait(300);
    if (from(step, '07-save-settings')) {
      const saved = await page.evaluate(() => localStorage.getItem('puzzling-potions:settings'));
      expect(saved === '{"music":0.5,"sfx":0.5,"hint":true}', `в localStorage: ${saved}`);
    }
    const bad = await findMove(page, false);
    t = await now(page);
    await swipe(page, bad.cell, bad.dx, bad.dy);
    await wait(300);
    await idle(page);
    const list = await played(page, t);
    expect(list[0]?.volume === 0.25, `эффекты тише вдвое: ${short(list)}`);
  }

  // --- Конец игры и экран результата ---
  for (let i = 0; i < 40 && !(await screenName(page)).includes('ResultScreen'); i++) await wait(500);
  const tResult = await now(page);
  await wait(4500);
  if (from(step, '03-music')) {
    const m = await music(page);
    console.log('  результат:', JSON.stringify(m));
    expect(m['bgm-main'].instances === 1 && m['bgm-game'].instances === 0, 'на экране результата снова bgm-main, bgm-game остановлена');
  }
  if (step === '08-practice') {
    const list = await played(page, tResult - 2000);
    const grade = await page.evaluate(() => {
      const r = __PIXI_APP__.stage.children.flatMap((c) => c.children).find((s) => s.constructor.name === 'ResultScreen');
      return r.stars.filter((s) => s.visible).length;
    });
    const stars = list.filter((s) => s.alias === 'common/sfx-correct.wav');
    const points = list.filter((s) => s.alias === 'common/sfx-points.wav');
    const gaps = points.slice(1).map((p, i) => p.t - points[i].t);
    console.log('  звёзды:', short(stars), '; очки:', points.length, 'раз, интервалы', gaps.join(' '), '; скорость', points[0]?.speed.toFixed(2), '→', points.at(-1)?.speed.toFixed(2));
    expect(stars.length === grade && stars.every((s, i) => s.speed === [0.9, 1, 1.5][i]), `звёзд ${grade}, звуков звёзд ${stars.length}`);
    expect(points.length > 3 && gaps.every((g) => g >= 99), 'очки набегают со звуком не чаще раза в 100 мс');
    expect(list.some((s) => s.alias === 'common/sfx-special.wav'), 'первая игра — новый рекорд, sfx-special');
  }
  await flushErrors(page, logs);
  const bad = problems(logs);
  expect(bad.length === 0, `ошибок и предупреждений нет${bad.length ? ': ' + bad.join(' | ') : ''}`);
  await page.close();

  // --- Политика autoplay: запуск без жеста пользователя ---
  if (from(step, '04-autoplay')) {
    const second = await open(files, { gesture: false, storage: {} });
    const hint = () => second.page.evaluate(() => {
      const home = __PIXI_APP__.stage.children.flatMap((c) => c.children).find((s) => s.constructor.name === 'HomeScreen');
      const label = home?.children.find((c) => c.text?.startsWith?.('Нажмите'));
      return { visible: label?.visible, state: window.__sound.context.audioContext.state };
    });
    await wait(1000);
    const before = await hint();
    const p1 = (await music(second.page))['bgm-main'].progress;
    expect(before.visible === true && before.state === 'suspended' && p1 === 0, `без жеста: подсказка видна, контекст ${before.state}, музыка стоит на ${p1}`);
    await second.page.mouse.click(30, 30);
    await wait(800);
    const after = await hint();
    const p2 = (await music(second.page))['bgm-main'].progress;
    expect(after.visible === false && after.state === 'running' && p2 > 0, `после щелчка: подсказка скрыта, контекст ${after.state}, музыка пошла (${p2})`);
    await second.page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await wait(300);
    const blurred = await hint();
    expect(blurred.visible === false && blurred.state === 'suspended', `окно потеряло фокус: контекст ${blurred.state}, подсказка ${blurred.visible ? 'видна' : 'скрыта'}`);
    await second.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await wait(300);
    expect((await hint()).state === 'running', 'фокус вернулся: контекст снова running');
    await second.page.close();
  }

  // --- Сохранённые настройки при новом запуске ---
  if (from(step, '07-save-settings')) {
    const cases = [
      ['{"music":0.3,"sfx":0.6,"hint":false}', '0.3/0.6/false'],
      ['{испорчено', 'по умолчанию'],
      ['{"music":7,"sfx":"громко","hint":1}', 'по умолчанию'],
    ];
    for (const [stored, label] of cases) {
      const third = await open(files, { storage: { 'puzzling-potions:settings': stored } });
      await wait(1200);
      const m = await music(third.page);
      await startGame(third.page);
      await click(third.page, 'settingsButton');
      await wait(900);
      const vals = await sliderValues(third.page);
      const hintBox = await third.page.evaluate(() => __PIXI_APP__.stage.children.flatMap((c) => c.children).find((s) => s.constructor.name === 'SettingsPopup').children[1].children.find((c) => 'onCheck' in c).checked);
      await flushErrors(third.page, third.logs);
      const errs = problems(third.logs);
      console.log(`  сохранено ${stored}: музыка меню ${m['bgm-main'].volume}, слайдеры ${vals}, подсказка ${hintBox}${errs.length ? ' ОШИБКИ ' + errs.join(' | ') : ''}`);
      const ok = label === 'по умолчанию' ? vals.join() === '100,100' && hintBox === true && m['bgm-main'].volume === 1 : vals.join() === '30,60' && hintBox === false && m['bgm-main'].volume === 0.3;
      expect(ok && errs.length === 0, `запуск с настройками «${label}»`);
      await third.page.close();
    }
  }
}

console.log(failures ? `\nПровалено проверок: ${failures}` : '\nВсе проверки пройдены');
await browser.close();
