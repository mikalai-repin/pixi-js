import gsap from 'gsap';
import { Container, Graphics, type PointData } from 'pixi.js';
import type { Piece } from './Piece';

/** Радиус кольца, которое расходится на месте исчезнувшей фишки */
const RING_RADIUS = 30;

/**
 * Слой эффектов поверх экрана игры. Эффекты не влияют на правила:
 * их можно менять и отключать, не трогая поле. Как GameEffects в Puzzling Potions
 */
export class GameEffects extends Container {
  constructor() {
    super();
    this.label = 'effects';
  }

  /** Фишка исчезла с поля */
  onPop(piece: Piece) {
    // Фишка лежит внутри поля, а слой эффектов — нет: переводим её позицию в свои координаты
    const position = this.toLocal(piece.getGlobalPosition());
    this.playRing(position);
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
