import gsap from 'gsap';
import { Container, Graphics, type PointData } from 'pixi.js';
import type { GameScreen } from './GameScreen';
import type { Piece } from './Piece';

/** Радиус кольца, которое расходится на месте исчезнувшей фишки */
const RING_RADIUS = 30;
/** Сила тряски за каждый раунд комбо и её предел, в пикселях */
const SHAKE_PER_ROUND = 4;
const MAX_SHAKE = 16;

/**
 * Слой эффектов поверх экрана игры. Эффекты не влияют на правила:
 * их можно менять и отключать, не трогая поле. Как GameEffects в Puzzling Potions
 */
export class GameEffects extends Container {
  constructor(private readonly game: GameScreen) {
    super();
    this.label = 'effects';
  }

  /** Фишка исчезла с поля */
  onPop(piece: Piece) {
    // Фишка лежит внутри поля, а слой эффектов — нет: переводим её позицию в свои координаты
    const position = this.toLocal(piece.getGlobalPosition());
    this.playRing(position);
  }

  /** Найдены совпадения. На комбо поле трясёт: чем длиннее цепочка, тем сильнее */
  onMatch(round: number) {
    if (round < 2) return;
    earthquake(this.game.board.pivot, Math.min(round * SHAKE_PER_ROUND, MAX_SHAKE));
  }

  /** Кольцо расходится и тает */
  private async playRing(position: PointData) {
    const ring = new Graphics().circle(0, 0, RING_RADIUS).stroke({ width: 4, color: 0xffffff });
    ring.position.copyFrom(position);
    ring.scale.set(0.3);
    this.addChild(ring);
    gsap.to(ring, { alpha: 0, duration: 0.4, ease: 'quad.in' });
    await gsap.to(ring.scale, { x: 1, y: 1, duration: 0.4, ease: 'quad.out' });
    ring.destroy();
  }
}

/**
 * Тряска: каждый кадр сдвигает точку на случайное расстояние, а сила тряски плавно падает до нуля.
 * Обычно трясут pivot: позицию объекта задаёт раскладка, а pivot свободен. Как earthquake в Puzzling Potions
 */
export async function earthquake(target: PointData, power = 8, duration = 0.5) {
  const shake = { power };
  await gsap.to(shake, {
    power: 0,
    duration,
    ease: 'linear',
    onUpdate: () => {
      target.x = randomRange(-shake.power, shake.power);
      target.y = randomRange(-shake.power, shake.power);
    },
  });
}

/** Случайное число от min до max */
export function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}
