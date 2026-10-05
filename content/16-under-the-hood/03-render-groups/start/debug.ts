import {
  Batch,
  RendererType,
  UPDATE_PRIORITY,
  type Application,
  type Container,
  type Instruction,
  type RenderOptions,
  type WebGLRenderer,
} from 'pixi.js';

/** Раз в сколько кадров обновлять панель: числа усредняются, иначе они мелькают */
const AVERAGE_FRAMES = 30;
/** Приоритет выше всех встроенных: такой слушатель срабатывает первым в кадре */
const FIRST = UPDATE_PRIORITY.INTERACTION + 1;

/** Панель — обычный элемент HTML поверх canvas: нарисуй мы её средствами PixiJS, она сама добавила бы работы рендереру */
function createPanel() {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position: fixed; left: 4px; bottom: 4px; padding: 2px 6px; font: 12px monospace; color: #fff; background: rgba(0, 0, 0, 0.6); cursor: pointer';
  document.body.appendChild(panel);
  return panel;
}

/**
 * Статистика кадра: вызовы отрисовки, время кадра и время отрисовки на процессоре.
 * extra — своя строка для панели. Щелчок по панели выводит инструкции кадра в консоль
 */
export function showStats(app: Application, extra?: () => string) {
  const panel = createPanel();
  panel.addEventListener('click', () => logInstructions(app.stage));

  // Время отрисовки: оборачиваем renderer.render — через него рисует и приложение, и наш код
  const render = app.renderer.render.bind(app.renderer);
  let renderTime = 0;
  app.renderer.render = (options: RenderOptions | Container) => {
    const start = performance.now();
    render(options);
    renderTime += performance.now() - start;
  };

  let drawCalls = 0;
  if (app.renderer.type === RendererType.WEBGL) {
    const gl = (app.renderer as WebGLRenderer).gl;
    // PixiJS рисует двумя методами контекста. Подменяем их: считаем вызов и передаём его настоящему методу
    const drawElements = gl.drawElements.bind(gl);
    gl.drawElements = (mode, count, type, offset) => {
      drawCalls++;
      drawElements(mode, count, type, offset);
    };
    const drawArrays = gl.drawArrays.bind(gl);
    gl.drawArrays = (mode, first, count) => {
      drawCalls++;
      drawArrays(mode, first, count);
    };
  }

  // Время кадра: от первого слушателя тикера до последнего. Сюда входит всё, что делается каждый кадр
  let frameStart = 0;
  let frameTime = 0;
  app.ticker.add(() => (frameStart = performance.now()), undefined, FIRST);

  let frames = 0;
  // Приоритет UTILITY ниже, чем у отрисовки (LOW): слушатель срабатывает, когда кадр уже нарисован
  app.ticker.add(
    () => {
      frameTime += performance.now() - frameStart;
      if (++frames < AVERAGE_FRAMES) return;
      const calls = app.renderer.type === RendererType.WEBGL ? `вызовов ${Math.round(drawCalls / frames)}` : app.renderer.name;
      const lines = [calls, `кадр ${(frameTime / frames).toFixed(2)} мс`, `отрисовка ${(renderTime / frames).toFixed(2)} мс`];
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
