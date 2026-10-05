import { Batch, RendererType, UPDATE_PRIORITY, type Application, type Container, type Instruction, type WebGLRenderer } from 'pixi.js';

/** Панель — обычный элемент HTML поверх canvas: нарисуй мы её средствами PixiJS, она сама добавила бы работы рендереру */
function createPanel() {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position: fixed; left: 4px; bottom: 4px; padding: 2px 6px; font: 12px monospace; color: #fff; background: rgba(0, 0, 0, 0.6); cursor: pointer';
  document.body.appendChild(panel);
  return panel;
}

/** Показывает, сколько вызовов отрисовки уходит на каждый кадр. Щелчок по панели выводит инструкции кадра в консоль */
export function showStats(app: Application) {
  const panel = createPanel();
  panel.addEventListener('click', () => logInstructions(app.stage));
  console.log(`Текстур в одном вызове отрисовки: до ${app.renderer.limits.maxBatchableTextures}`);
  if (app.renderer.type !== RendererType.WEBGL) {
    panel.textContent = 'Вызовы отрисовки считаем только в WebGL';
    return;
  }
  const gl = (app.renderer as WebGLRenderer).gl;
  panel.textContent = 'Вызовы отрисовки ещё не считаются';
  // TODO: подменить gl.drawElements и gl.drawArrays, считать их вызовы и раз в кадр показывать число на панели
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
