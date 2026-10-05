// Проверка главы 16 «Под капотом PixiJS»: рендереры (WebGL, WebGPU, Canvas), счёт вызовов отрисовки и инструкции,
// рендер-группа и отсечение в лаборатории (решение быстрее старта), миникарта в рендер-текстуре, меш со своим шейдером
// на WebGL и WebGPU, свой фильтр в конце игры, система-расширение (в том числе после потери контекста), кэш экрана
// под паузой (вызовы и время видеокарты), число текстур за несколько кругов игры и предупреждения WebGPU.
// Запускается на настоящей видеокарте (GPU=1 по умолчанию): нужны WebGPU и таймер видеокарты.
// node tools/e2e/checks/ch16-under-the-hood.mjs   (STEPS=02-batching,10-memory — только эти шаги)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { CONTENT, OUT, compileDir, copyStepDir, launch, openPreview, wait } from '../lib.mjs';

process.env.GPU ??= '1';
const C = `${CONTENT}/16-under-the-hood`;
const ALL = ['01-renderers', '02-batching', '03-render-groups', '04-culling', '05-render-texture', '06-mesh', '07-filter', '08-extensions', '09-profiling', '10-memory'];
const STEPS = process.env.STEPS ? process.env.STEPS.split(',') : ALL;
const browser = await launch();
const problems = (logs) => logs.filter((l) => /^\[(pageerror|error|warn|runtime-error|assert)\]/.test(l));

let failures = 0;
const expect = (ok, text) => {
  console.log(`  ${ok ? 'ок ' : 'НЕТ'} ${text}`);
  if (!ok) failures++;
};

/** Копия папки шага (start или solution) с правками: [файл, было, стало][] */
function prepare(name, from, edits = []) {
  const dir = `${OUT}/ch16-${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  copyStepDir(`${C}/${from}`, dir);
  for (const [file, before, after] of edits) {
    const path = `${dir}/${file}`;
    const code = readFileSync(path, 'utf8');
    if (!code.includes(before)) throw new Error(`${name}: в ${file} нет «${before}»`);
    writeFileSync(path, code.replace(before, after));
  }
  return dir;
}
const shortGame = (ms) => ['GameScreen.ts', 'const GAME_TIME = 60_000;', `const GAME_TIME = ${ms};`];
const prefer = (renderer) => ['main.ts', "preference: 'webgl',", `preference: '${renderer}',`];

const panel = (page) => page.evaluate(() => document.querySelector('body > div')?.textContent ?? '');
const number = (text, name) => Number(new RegExp(`${name}:? ([\\d.]+)`).exec(text)?.[1]);

/** Среднее показание панели за несколько обновлений */
async function panelAverage(page, name, samples = 6) {
  const values = [];
  for (let i = 0; i < samples; i++) {
    await wait(600);
    values.push(number(await panel(page), name));
  }
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
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
  return p;
}

async function startGame(page) {
  for (let i = 0; i < 40 && !(await page.evaluate(() => !!__PIXI_APP__.stage.getChildByLabel('board', true))); i++) {
    await click(page, 'playButton');
    await wait(500);
  }
  for (let i = 0; i < 150 && (await page.evaluate(() => __PIXI_APP__.stage.getChildByLabel('board', true).locked)); i++) await wait(100);
}

async function tapPiece(page, index = 10) {
  const p = await page.evaluate((index) => {
    const app = __PIXI_APP__;
    const k = app.canvas.clientWidth / app.screen.width;
    const g = app.stage.getChildByLabel('pieces', true).children[index].getGlobalPosition();
    return { x: g.x * k, y: g.y * k };
  }, index);
  await page.mouse.click(p.x, p.y);
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
      for (let c = 0; c < 6; c++) {
        const g = grid.map((x) => x.slice());
        [g[r][c], g[r][c + 1]] = [g[r][c + 1], g[r][c]];
        if (has(g)) return { row: r, column: c };
      }
    return null;
  });

async function swipeRight(page, cell) {
  const p = await page.evaluate((cell) => {
    const app = __PIXI_APP__;
    const k = app.canvas.clientWidth / app.screen.width;
    const b = app.stage.getChildByLabel('board', true);
    const g = b.toGlobal(b.getViewPosition(cell));
    return { x: g.x * k, y: g.y * k, size: 50 * b.worldTransform.a * k };
  }, cell);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + p.size * 0.6, p.y, { steps: 5 });
  await page.mouse.up();
}

const gameScreen = `(() => { const find = (c) => (c.board && c.hud ? c : c.children.map(find).find(Boolean)); return find(__PIXI_APP__.stage); })()`;

/** Круги «игра → результат → меню» с фиксированными паузами (раунд 4 с); после каждого — всего текстур и градиентов 256 × 1 */
async function cycles(page, count) {
  const out = [];
  await wait(1000);
  for (let round = 0; round < count; round++) {
    // Щелчок во время анимации появления экрана игнорируется: повторяем, пока экран не сменится
    for (let i = 0; i < 40 && !(await page.evaluate(() => !!__PIXI_APP__.stage.getChildByLabel('board', true))); i++) {
      await click(page, 'playButton');
      await wait(500);
    }
    await wait(11000);
    for (let i = 0; i < 40 && !(await page.evaluate(() => !!__PIXI_APP__.stage.getChildByLabel('playButton', true))); i++) {
      await click(page, 'menuButton');
      await wait(500);
    }
    await wait(2000);
    out.push(await page.evaluate(() => {
      const gradients = __PIXI_APP__.renderer.texture.managedTextures.filter((source) => source && source.pixelWidth === 256 && source.pixelHeight === 1);
      return `${__PIXI_APP__.renderer.stats?.textures}/${gradients.length}`;
    }));
  }
  return out;
}

async function run(name, dir, test, waitMs = 3500) {
  const { page, logs } = await openPreview(browser, compileDir(dir), { waitMs });
  try {
    await test(page, logs);
  } catch (error) {
    expect(false, `${name}: ${error.message}`);
  }
  await page.close();
  return logs;
}

const clean = (logs, allow = []) => {
  const bad = problems(logs).filter((l) => !allow.some((a) => l.includes(a)));
  expect(bad.length === 0, `ошибок и предупреждений нет${bad.length ? ': ' + [...new Set(bad)].slice(0, 4).join(' | ') : ''}`);
};

for (const step of STEPS) {
  console.log(`\n# ${step}`);

  if (step === '01-renderers') {
    for (const renderer of ['webgl', 'webgpu']) {
      const logs = await run(renderer, prepare(`01-${renderer}`, `${step}/solution`, [prefer(renderer)]), async (page, logs) => {
        expect(logs.some((l) => l.includes(`Рендерер: ${renderer}`)), `preference '${renderer}' → «Рендерер: ${renderer}»`);
      });
      clean(logs);
    }
    const logs = await run('canvas', prepare('01-canvas', `${step}/solution`, [prefer('canvas')]), async (page, logs) => {
      expect(logs.some((l) => l.includes('Рендерер: canvas')), 'Canvas: «Рендерер: canvas»');
      const pipes = await page.evaluate(() => Object.keys(__PIXI_APP__.renderer.renderPipes));
      expect(!pipes.includes('mesh') && pipes.includes('sprite'), `у Canvas нет конвейера mesh: ${pipes.join(', ')}`);
      await startGame(page);
      await tapPiece(page);
      await wait(800);
      expect(logs.some((l) => l.includes('is not supported in Canvas2D')), 'выбор фишки: фильтр свечения пропущен с предупреждением');
      await click(page, 'pauseButton');
      await wait(1000);
      expect(logs.some((l) => l.includes('filter "BlurFilter" is not supported')), 'пауза: размытие тоже пропущено');
    });
    clean(logs, ['not supported in Canvas2D']);
  }

  if (step === '02-batching') {
    const logs = await run('calls', prepare('02', `${step}/solution`, [shortGame(40000)]), async (page, logs) => {
      expect(logs.some((l) => /Текстур в одном вызове отрисовки: до \d+/.test(l)), 'выведено maxBatchableTextures');
      expect(number(await panel(page), 'Вызовов отрисовки') === 2, `меню: ${await panel(page)}`);
      await startGame(page);
      await wait(500);
      expect(number(await panel(page), 'Вызовов отрисовки') === 6, `игра: ${await panel(page)}`);
      logs.length = 0;
      await page.mouse.click(30, 590);
      await wait(300);
      const text = logs.join('\n');
      expect(/Инструкций в кадре: 11/.test(text) && text.includes('stencilMask — pushMaskBegin') && /batch — объектов: 63, текстур: 1/.test(text), 'щелчок по панели: 11 инструкций, маска, 63 зелья одним батчем');
      // Искры: пока они летят, конвейер частиц добавляет вызов
      const move = await findMove(page);
      await swipeRight(page, move);
      let max = 0;
      for (let i = 0; i < 40; i++) {
        max = Math.max(max, number(await panel(page), 'Вызовов отрисовки'));
        await wait(25);
      }
      expect(max >= 7, `во время взрыва вызовов больше шести (искры): максимум ${max}`);
      await wait(2500);
      await tapPiece(page);
      await wait(800);
      expect(number(await panel(page), 'Вызовов отрисовки') === 9, `выбрана фишка: ${await panel(page)}`);
    });
    clean(logs);
    for (const [name, file, before, after, expected] of [
      ['без add', 'Piece.ts', "    this.highlight.blendMode = 'add';", "    // this.highlight.blendMode = 'add';", 8],
      ['без маски', 'Board.ts', '    this.addChild(mask);\n    this.piecesContainer.mask = mask;', '', 2],
    ]) {
      await run(name, prepare(`02-${name}`, `${step}/solution`, [[file, before, after]]), async (page) => {
        await startGame(page);
        if (name === 'без add') await tapPiece(page);
        await wait(800);
        expect(number(await panel(page), 'Вызовов отрисовки') === expected, `эксперимент «${name}»: ${await panel(page)}`);
      });
    }
  }

  if (step === '03-render-groups' || step === '04-culling') {
    const times = {};
    for (const kind of ['start', 'solution']) {
      const logs = await run(kind, prepare(`${step}-${kind}`, `${step}/${kind}`), async (page) => {
        times[kind] = await panelAverage(page, step === '03-render-groups' ? 'отрисовка' : 'кадр');
        if (step === '04-culling') times[`${kind}Chunks`] = Number(/видно кусков (\d+)/.exec(await panel(page))?.[1]);
      });
      clean(logs);
    }
    const what = step === '03-render-groups' ? 'отрисовка' : 'кадр';
    expect(times.solution * (step === '03-render-groups' ? 5 : 1.5) < times.start, `${what}: старт ${times.start} мс → решение ${times.solution} мс`);
    if (step === '04-culling') expect(times.startChunks === 64 && times.solutionChunks < 16, `видно кусков: ${times.startChunks} → ${times.solutionChunks}`);
  }

  if (step === '05-render-texture') {
    const logs = await run('minimap', prepare('05', `${step}/solution`), async (page) => {
      const minimap = await page.evaluate(() => {
        const app = __PIXI_APP__;
        const sprite = app.stage.children.at(-1).children[1];
        const canvas = app.renderer.extract.canvas(sprite.texture);
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let filled = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) filled++;
        return { width: sprite.texture.width, filled, total: data.length / 4 };
      });
      expect(minimap.width === 150 && minimap.filled > minimap.total * 0.05, `миникарта 150 × 150, закрашено ${minimap.filled} из ${minimap.total} пикселей`);
      expect(number(await panel(page), 'вызовов') === 2, `вызовов 2: ${await panel(page)}`);
    });
    clean(logs);
  }

  if (step === '06-mesh') {
    for (const renderer of ['webgl', 'webgpu']) {
      const edit = renderer === 'webgpu' ? [['main.ts', "resizeTo: window });", "resizeTo: window, preference: 'webgpu' });"]] : [];
      const logs = await run(renderer, prepare(`06-${renderer}`, `${step}/solution`, edit), async (page) => {
        const state = await page.evaluate(async () => {
          const app = __PIXI_APP__;
          const mesh = app.stage.children[0];
          const t1 = mesh.shader.resources.waveUniforms.uniforms.uTime;
          await new Promise((r) => setTimeout(r, 300));
          return { name: app.renderer.name, vertices: mesh.geometry.positions.length / 2, triangles: mesh.geometry.indices.length / 3, grows: mesh.shader.resources.waveUniforms.uniforms.uTime > t1 };
        });
        expect(state.name === renderer && state.vertices === 121 && state.triangles === 200 && state.grows, `${renderer}: 121 вершина, 200 треугольников, uTime растёт`);
      });
      clean(logs);
    }
  }

  if (step === '07-filter') {
    for (const renderer of ['webgl', 'webgpu']) {
      const edits = [shortGame(4000)];
      if (renderer === 'webgpu') edits.push(['main.ts', "preference: 'webgl',", "preference: 'webgpu',"]);
      const logs = await run(renderer, prepare(`07-${renderer}`, `${step}/solution`, edits), async (page) => {
        await startGame(page);
        for (let i = 0; i < 40 && !(await page.evaluate(() => !!__PIXI_APP__.stage.getChildByLabel('board', true)?.filters?.length)); i++) await wait(250);
        const mid = await page.evaluate(() => (window.grey = __PIXI_APP__.stage.getChildByLabel('board', true).filters[0]).progress);
        await wait(1400);
        const end = await page.evaluate(() => window.grey.progress);
        expect(mid < 1 && end === 1, `${renderer}: фильтр на поле, progress ${mid.toFixed(2)} → ${end}`);
      });
      // Предупреждения WebGPU от шрифта таймера исправляются только в шаге 16.10
      clean(logs, renderer === 'webgpu' ? ['[BindGroup]'] : []);
    }
  }

  if (step === '08-extensions') {
    const logs = await run('stats', prepare('08', `${step}/solution`), async (page) => {
      const before = await page.evaluate(() => [!!__PIXI_APP__.renderer.stats, __PIXI_APP__.renderer.stats.drawCalls]);
      expect(before[0] && before[1] === 2, `renderer.stats есть, в меню ${before[1]} вызова`);
      await page.evaluate(() => {
        window.lose = __PIXI_APP__.renderer.gl.getExtension('WEBGL_lose_context');
        window.lose.loseContext();
      });
      await wait(800);
      await page.evaluate(() => window.lose.restoreContext());
      await wait(2000);
      const after = await page.evaluate(() => __PIXI_APP__.renderer.stats.drawCalls);
      expect(after === 2, `после потери и восстановления контекста снова ${after} вызова`);
    });
    clean(logs);
    await run('после init', prepare('08-late', `${step}/solution`, [
      ['debug.ts', '\nextensions.add(StatsSystem);', '\n// extensions.add(StatsSystem);'],
      ['main.ts', "import { showStats } from './debug';", "import { showStats, StatsSystem } from './debug';\nimport { extensions } from 'pixi.js';"],
      ['main.ts', 'document.body.appendChild(app.canvas);', "document.body.appendChild(app.canvas);\nextensions.add(StatsSystem);"],
    ]), async (page) => {
      expect(!(await page.evaluate(() => 'stats' in __PIXI_APP__.renderer)) && (await panel(page)).startsWith('Статистики нет'), 'регистрация после init не действует');
    });
  }

  if (step === '09-profiling') {
    for (const kind of ['start', 'solution']) {
      const logs = await run(kind, prepare(`09-${kind}`, `${step}/${kind}`), async (page) => {
        await startGame(page);
        const game = await panelAverage(page, 'видеокарта', 4);
        await click(page, 'pauseButton');
        await wait(1500);
        const text = await panel(page);
        const paused = await panelAverage(page, 'видеокарта', 4);
        const cached = await page.evaluate(`${gameScreen}.isCachedAsTexture`);
        const calls = number(text, 'вызовов');
        if (kind === 'start') expect(calls === 15 && !cached && paused > game * 1.5, `до: пауза ${calls} вызовов, видеокарта ${game} → ${paused} мс`);
        else expect(calls === 2 && cached && paused < game * 1.5, `после: пауза ${calls} вызова, кэш ${cached}, видеокарта ${game} → ${paused} мс`);
        if (kind === 'solution') {
          await page.setViewport({ width: 420, height: 600 });
          await wait(1000);
          for (let i = 0; i < 10 && (await page.evaluate(`${gameScreen}.isCachedAsTexture`)); i++) {
            await page.evaluate(() => {
              const find = (c) => (c.onPress && /Продолж/.test(c.children.map((x) => x.text ?? '').join()) ? c : c.children.map(find).find(Boolean));
              const button = find(__PIXI_APP__.stage);
              button?.onPress?.();
            });
            await wait(500);
          }
          await wait(800);
          expect(!(await page.evaluate(`${gameScreen}.isCachedAsTexture`)) && number(await panel(page), 'вызовов') === 6, `после паузы кэш снят: ${await panel(page)}`);
        }
      });
      clean(logs);
    }
  }

  if (step === '10-memory') {
    const counts = {};
    for (const kind of ['start', 'solution']) {
      const logs = await run(kind, prepare(`10-${kind}`, `${step}/${kind}`, [shortGame(4000)]), async (page) => {
        counts[kind] = await cycles(page, 4);
      });
      clean(logs);
    }
    // Общее число текстур колеблется (пул, текст); градиенты 256 × 1 считаем отдельно: всего/градиентов
    const gradients = (list) => list.map((x) => parseInt(x.split('/')[1]));
    expect(gradients(counts.start).join() === '1,2,3,4', `до: после кругов текстур/градиентов ${counts.start.join(', ')} — градиентов по одному на круг`);
    expect(gradients(counts.solution).every((n) => n === 1), `после: ${counts.solution.join(', ')} — градиент один`);
    for (const kind of ['start', 'solution']) {
      const logs = await run(`${kind}-webgpu`, prepare(`10-${kind}-webgpu`, `${step}/${kind}`, [shortGame(4000), prefer('webgpu')]), async (page) => {
        await cycles(page, 2);
      });
      const warnings = logs.filter((l) => l.includes('[BindGroup]')).length;
      if (kind === 'start') expect(warnings > 0, `до, WebGPU: предупреждений [BindGroup] ${warnings}`);
      else expect(warnings === 0 && problems(logs).length === 0, `после, WebGPU: предупреждений нет (${problems(logs).length})`);
    }
  }
}

console.log(failures ? `\nПровалено проверок: ${failures}` : '\nВсе проверки пройдены');
await browser.close();
