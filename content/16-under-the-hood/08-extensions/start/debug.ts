import {
  Batch,
  ExtensionType,
  extensions,
  RendererType,
  UPDATE_PRIORITY,
  type Application,
  type Container,
  type Instruction,
  type System,
  type WebGLRenderer,
} from 'pixi.js';

/** Раз в сколько кадров обновлять панель: числа усредняются, иначе они мелькают */
const AVERAGE_FRAMES = 30;
/** Приоритет выше всех встроенных: такой слушатель срабатывает первым в кадре */
const FIRST = UPDATE_PRIORITY.INTERACTION + 1;

/**
 * Система рендерера: считает вызовы отрисовки и время отрисовки каждого кадра.
 * Рендерер создаёт её сам, кладёт в renderer.stats и вызывает её методы на этапах своей работы
 */
export class StatsSystem implements System {
  /** Описание расширения: какого оно типа (система WebGL) и под каким именем появится в рендерере */
  static extension = {
    type: [ExtensionType.WebGLSystem],
    name: 'stats',
  } as const;

  /** Вызовов отрисовки в последнем кадре */
  drawCalls = 0;
  /** Время последней отрисовки на процессоре, мс */
  renderTime = 0;
  private counter = 0;
  private start = 0;
  private gl?: WebGL2RenderingContext;

  // TODO: contextChange(gl) — подменить gl.drawElements и gl.drawArrays и считать вызовы в this.counter
  // TODO: prerender() — обнулить счётчик и запомнить время начала отрисовки
  // TODO: postrender() — записать итоги кадра в drawCalls и renderTime

  destroy() {}
}

// TODO: зарегистрировать StatsSystem как расширение

/** Панель — обычный элемент HTML поверх canvas: нарисуй мы её средствами PixiJS, она сама добавила бы работы рендереру */
function createPanel() {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position: fixed; left: 4px; bottom: 4px; padding: 2px 6px; font: 12px monospace; color: #fff; background: rgba(0, 0, 0, 0.6); cursor: pointer';
  document.body.appendChild(panel);
  return panel;
}

/** Панель статистики кадра. extra — своя строка для панели. Щелчок по панели выводит инструкции кадра в консоль */
export function showStats(app: Application, extra?: () => string) {
  const panel = createPanel();
  panel.addEventListener('click', () => logInstructions(app.stage));
  // Система появляется только у рендерера WebGL
  const stats = (app.renderer as WebGLRenderer & { stats?: StatsSystem }).stats;
  if (app.renderer.type !== RendererType.WEBGL || !stats) {
    panel.textContent = 'Статистики нет: рендерер не WebGL или StatsSystem не зарегистрирована';
    return;
  }

  // Время кадра: от первого слушателя тикера до последнего. Сюда входит всё, что делается каждый кадр
  let frameStart = 0;
  app.ticker.add(() => (frameStart = performance.now()), undefined, FIRST);

  let frames = 0;
  let drawCalls = 0;
  let renderTime = 0;
  let frameTime = 0;
  // Приоритет UTILITY ниже, чем у отрисовки (LOW): слушатель срабатывает, когда кадр уже нарисован
  app.ticker.add(
    () => {
      frameTime += performance.now() - frameStart;
      drawCalls += stats.drawCalls;
      renderTime += stats.renderTime;
      if (++frames < AVERAGE_FRAMES) return;
      const lines = [
        `вызовов ${Math.round(drawCalls / frames)}`,
        `кадр ${(frameTime / frames).toFixed(2)} мс`,
        `отрисовка ${(renderTime / frames).toFixed(2)} мс`,
      ];
      if (extra) lines.push(extra());
      panel.textContent = lines.join(' · ');
      frames = drawCalls = renderTime = frameTime = 0;
    },
    undefined,
    UPDATE_PRIORITY.UTILITY,
  );
}

/**
 * Выводит в консоль инструкции, из которых рендерер собирает кадр.
 * renderGroup и instructionSet — внутренние данные PixiJS: читать их можно, менять нельзя
 */
export function logInstructions(root: Container) {
  const { instructionSet } = root.renderGroup;
  const lines: string[] = [];
  for (let i = 0; i < instructionSet.instructionSize; i++) {
    lines.push(`${i + 1}. ${describe(instructionSet.instructions[i])}`);
  }
  console.log(`Инструкций в кадре: ${instructionSet.instructionSize}\n${lines.join('\n')}`);
}

function describe(instruction: Instruction) {
  if (instruction instanceof Batch) {
    return `batch — объектов: ${instruction.elements.length}, текстур: ${instruction.textures.count}, смешивание: ${instruction.blendMode}`;
  }
  // Остальные инструкции: маски, фильтры, рендер-группы, объекты со своим шейдером
  return instruction.action ? `${instruction.renderPipeId} — ${instruction.action}` : instruction.renderPipeId;
}
