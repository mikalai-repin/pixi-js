import { Container, Sprite, Texture } from 'pixi.js';
import { advanceShot, type BubbleGrid, type Shot } from './bubbles';

/** Расстояние между точками прицела */
const DOT_SPACING = 22;
/** Дальше этого прицел не рисуем: иначе игра станет слишком лёгкой */
const MAX_LENGTH = 700;

/**
 * Прицел: пунктир из точек по пути, которым полетит пузырь, с отскоками от стен.
 * Путь считает та же функция, что двигает настоящий выстрел. Как AimSystem в Bubbo Bubbo
 */
export class Aim extends Container {
  /** Точки не создаются заново каждый кадр: берём из запаса и прячем лишние */
  private readonly dots: Sprite[] = [];

  /** Рисует путь выстрела from — копия выстрела, его не меняем */
  update(grid: BubbleGrid, from: Shot) {
    const shot = { ...from };
    let count = 0;
    // Делаем шаги по DOT_SPACING и ставим точку после каждого, пока не врежемся или не уйдём далеко
    for (let length = DOT_SPACING; length < MAX_LENGTH; length += DOT_SPACING) {
      const hit = advanceShot(grid, shot, DOT_SPACING);
      const dot = this.getDot(count++);
      dot.position.set(shot.x, shot.y);
      // Ближе к концу точки бледнеют
      dot.alpha = 1 - length / MAX_LENGTH;
      if (hit) break;
    }
    for (let i = count; i < this.dots.length; i++) this.dots[i].visible = false;
  }

  /** Точка с номером index: из запаса или новая */
  private getDot(index: number) {
    let dot = this.dots[index];
    if (!dot) {
      dot = new Sprite({ texture: Texture.from('shot-visualiser'), anchor: 0.5 });
      dot.scale.set(0.4);
      this.dots.push(dot);
      this.addChild(dot);
    }
    dot.visible = true;
    return dot;
  }
}
