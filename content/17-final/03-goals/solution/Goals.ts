import gsap from 'gsap';
import { Container, Sprite, Texture, type DestroyOptions, type PointData } from 'pixi.js';
import { Label } from './Label';
import type { LevelGoal } from './levels';

/** Размер иконки зелья */
const ICON_SIZE = 44;
/** Расстояние между центрами соседних целей */
const GOAL_SPACING = 110;

/** Одна цель на панели: иконка, число и звезда, которая заменяет число, когда цель выполнена */
interface GoalView {
  icon: Sprite;
  count: Label;
  done: Sprite;
}

/**
 * Панель целей уровня: для каждой цели — иконка зелья и сколько его ещё собрать.
 * Сама ничего не считает: показывает числа, которые ей передаёт экран игры
 */
export class Goals extends Container {
  private readonly views = new Map<string, GoalView>();

  constructor(goals: LevelGoal[]) {
    super();
    this.label = 'goals';
    goals.forEach((goal, index) => {
      const item = new Container();
      // Цели стоят в ряд, ряд — по центру панели
      item.x = (index - (goals.length - 1) / 2) * GOAL_SPACING;
      const icon = new Sprite({ texture: Texture.from(goal.piece), anchor: 0.5 });
      icon.setSize(ICON_SIZE);
      icon.x = -24;
      const count = new Label(goal.count, { fontSize: 26 });
      count.x = 22;
      const done = new Sprite({ texture: Texture.from('star'), anchor: 0.5 });
      done.scale.set(0.3);
      done.x = 22;
      done.visible = false;
      item.addChild(icon, count, done);
      this.addChild(item);
      this.views.set(goal.piece, { icon, count, done });
    });
  }

  /** Показывает, сколько зелий piece ещё нужно собрать. 0 — цель выполнена */
  setCount(piece: string, count: number) {
    const view = this.views.get(piece);
    if (!view) return;
    view.count.text = String(count);
    if (count > 0 || view.done.visible) return;
    // Цель выполнена: вместо числа выпрыгивает звезда
    view.count.visible = false;
    view.done.visible = true;
    gsap.from(view.done.scale, { x: 0, y: 0, duration: 0.4, ease: 'back.out' });
  }

  /** Где иконка зелья, в глобальных координатах, или null, если такой цели нет или она выполнена */
  getIconPosition(piece: string): PointData | null {
    const view = this.views.get(piece);
    if (!view || view.done.visible) return null;
    return view.icon.getGlobalPosition();
  }

  /** Иконка вздрагивает, когда в неё прилетает зелье */
  bump(piece: string) {
    const view = this.views.get(piece);
    if (!view) return;
    // Масштаб иконки задан через setSize: пружиним от него, а не от единицы
    const scale = ICON_SIZE / view.icon.texture.width;
    gsap.killTweensOf(view.icon.scale);
    gsap.fromTo(view.icon.scale, { x: scale * 1.3, y: scale * 1.3 }, { x: scale, y: scale, duration: 0.3, ease: 'back.out' });
  }

  /** Твины иконок и звёзд не должны пережить панель */
  override destroy(options?: DestroyOptions) {
    for (const view of this.views.values()) {
      gsap.killTweensOf(view.icon.scale);
      gsap.killTweensOf(view.done.scale);
    }
    super.destroy(options);
  }
}
