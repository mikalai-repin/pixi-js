import gsap from 'gsap';
import { Container, Graphics, Sprite, Texture, type PointData } from 'pixi.js';
import { TILE_SIZE } from './Board';
import type { GameScreen } from './GameScreen';
import type { Piece } from './Piece';

/** Радиус кольца, которое расходится на месте исчезнувшей фишки */
const RING_RADIUS = 30;
/** Сила тряски за каждый раунд комбо и её предел, в пикселях */
const SHAKE_PER_ROUND = 4;
const MAX_SHAKE = 16;
/** Сколько секунд полёта добавляет каждый пиксель пути */
const FLY_TIME_PER_PIXEL = 0.0015;

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
    this.playFlyToScore(piece.textureName, position);
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

  /**
   * Копия зелья летит в счёт: подпрыгивает, подрастает и ныряет в цифры.
   * Сама фишка тем временем исчезает с поля, как раньше. В оригинале зелья летят в котёл
   */
  private async playFlyToScore(textureName: string, from: PointData) {
    const copy = new Sprite(Texture.from(textureName));
    copy.anchor.set(0.5);
    copy.setSize(TILE_SIZE);
    copy.position.copyFrom(from);
    this.addChild(copy);

    // Счёт лежит в интерфейсе: его глобальную позицию переводим в координаты слоя эффектов
    const to = this.toLocal(this.game.hud.getScorePosition());
    // Дальние зелья летят дольше, а случайная добавка не даёт им лететь строем
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = distance * FLY_TIME_PER_PIXEL + randomRange(0.2, 0.4);
    // По y копия сразу взмывает вверх, а по x разгоняется не спеша: у осей разная плавность, и путь выгибается дугой
    gsap.to(copy, { x: to.x + randomRange(-20, 20), duration, ease: 'sine.in' });
    gsap.to(copy, { y: to.y, duration, ease: 'sine.out' });
    // back.in сначала уводит значение в обратную сторону: копия подрастает и только потом уменьшается
    const scale = copy.scale.x * 0.4;
    await gsap.to(copy.scale, { x: scale, y: scale, duration, ease: 'back.in(3)' });
    copy.destroy();
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
