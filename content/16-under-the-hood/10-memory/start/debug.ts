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

/** Расширение WebGL с таймером видеокарты. В типах TypeScript его нет: описываем то, что используем */
interface GpuTimer {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

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
  /** Сколько текстур сейчас в видеопамяти */
  textures = 0;
  /** Время видеокарты на последний измеренный кадр, мс. −1 — таймера нет */
  gpuTime = -1;
  private timer: GpuTimer | null = null;
  /** Замер текущего кадра и замеры прошлых кадров, результат которых ещё не готов */
  private query: WebGLQuery | null = null;
  private readonly queries: WebGLQuery[] = [];
  private counter = 0;
  private start = 0;
  private gl?: WebGL2RenderingContext;

  /** Контекст WebGL готов: при запуске и после восстановления потерянного контекста. Подменяем методы рисования */
  contextChange(gl: WebGL2RenderingContext) {
    // После потери и восстановления контекста PixiJS вызывает contextChange снова, с тем же объектом gl.
    // Подменённые методы уже на месте: подмени мы их второй раз, каждый вызов считался бы дважды
    if (gl === this.gl) return;
    this.gl = gl;
    // Таймер видеокарты — расширение WebGL 2: в Chrome на компьютере обычно есть, но не везде
    this.timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const drawElements = gl.drawElements.bind(gl);
    gl.drawElements = (mode, count, type, offset) => {
      this.counter++;
      drawElements(mode, count, type, offset);
    };
    const drawArrays = gl.drawArrays.bind(gl);
    gl.drawArrays = (mode, first, count) => {
      this.counter++;
      drawArrays(mode, first, count);
    };
    // Текстуры в видеопамяти: сколько создано и ещё не удалено
    const createTexture = gl.createTexture.bind(gl);
    gl.createTexture = () => {
      this.textures++;
      return createTexture();
    };
    const deleteTexture = gl.deleteTexture.bind(gl);
    gl.deleteTexture = (texture) => {
      this.textures--;
      deleteTexture(texture);
    };
  }

  /** Перед каждой отрисовкой — через renderer.render рисует и приложение, и любой наш код */
  prerender() {
    this.counter = 0;
    this.start = performance.now();
    // Видеокарта засекает время всех команд между beginQuery и endQuery
    if (this.gl && this.timer && !this.query) {
      this.query = this.gl.createQuery();
      this.gl.beginQuery(this.timer.TIME_ELAPSED_EXT, this.query);
    }
  }

  /** После отрисовки: итоги кадра */
  postrender() {
    this.drawCalls = this.counter;
    this.renderTime = performance.now() - this.start;
    if (this.gl && this.timer && this.query) {
      this.gl.endQuery(this.timer.TIME_ELAPSED_EXT);
      this.queries.push(this.query);
      this.query = null;
    }
    this.readGpuTime();
  }

  /** Видеокарта выполняет команды позже, чем их отдал процессор: результат замера готов через кадр-другой */
  private readGpuTime() {
    const { gl, timer } = this;
    if (!gl || !timer) return;
    while (this.queries.length > 0 && gl.getQueryParameter(this.queries[0], gl.QUERY_RESULT_AVAILABLE)) {
      const query = this.queries.shift()!;
      // Если видеокарта за это время, например, сменила частоту, замер недостоверен: пропускаем его
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
        this.gpuTime = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6; // наносекунды → миллисекунды
      }
      gl.deleteQuery(query);
    }
  }

  destroy() {}
}

// Регистрируем систему до создания рендерера: при init он соберёт все системы своего типа
extensions.add(StatsSystem);

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
      if (stats.gpuTime >= 0) lines.push(`видеокарта ${stats.gpuTime.toFixed(2)} мс`);
      lines.push(`текстур ${stats.textures}`);
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
