import gsap from 'gsap';
import {
  Container,
  Graphics,
  GraphicsContext,
  Particle,
  ParticleContainer,
  Sprite,
  Texture,
  Ticker,
  type Filter,
  type PointData,
} from 'pixi.js';
import { TILE_SIZE } from './Board';
import type { GameScreen } from './GameScreen';
import type { Piece } from './Piece';
import { Pool } from './pool';

/** Радиус кольца, которое расходится на месте исчезнувшей фишки */
const RING_RADIUS = 30;
/** Сила тряски за каждый раунд комбо и её предел, в пикселях */
const SHAKE_PER_ROUND = 4;
const MAX_SHAKE = 16;
/** Сколько секунд полёта добавляет каждый пиксель пути */
const FLY_TIME_PER_PIXEL = 0.0015;
/** Геометрия кольца одна на все кольца, как подложки клеток в главе 4 */
const RING_CONTEXT = new GraphicsContext().circle(0, 0, RING_RADIUS).stroke({ width: 4, color: 0xffffff });

/** Искр в одном взрыве */
const SPARKS_PER_POP = 12;
/** Сколько живёт искра, секунд */
const SPARK_LIFE = 0.7;
/** Начальная скорость искры, пикселей в секунду */
const SPARK_SPEED = 260;
/** Ускорение падения искр, пикселей в секунду за секунду */
const GRAVITY = 600;
/** Масштаб новой искры: текстура circle — 117 × 117 пикселей */
const SPARK_SCALE = 0.25;
/** Цвет искр для каждого зелья */
const SPARK_COLORS: Record<string, number> = {
  'piece-dragon': 0xff7a2a,
  'piece-frog': 0x4fa3ff,
  'piece-newt': 0x8cf05a,
  'piece-snake': 0xb25cff,
  'piece-spider': 0xffd84a,
  'piece-yeti': 0xff9fdc,
};

/** Искра: частица со скоростью и возрастом. Particle — простой класс, его можно наследовать */
class Spark extends Particle {
  vx = 0;
  vy = 0;
  /** Сколько секунд искра уже живёт */
  age = 0;
}

/**
 * Слой эффектов поверх экрана игры. Эффекты не влияют на правила:
 * их можно менять и отключать, не трогая поле. Как GameEffects в Puzzling Potions
 */
export class GameEffects extends Container {
  /** Кольца и летящие копии зелий не создаются каждый раз заново, а берутся из пулов */
  private readonly rings = new Pool(() => new Graphics(RING_CONTEXT));
  private readonly copies = new Pool(() => new Sprite({ anchor: 0.5 }));
  /** Все искры в одном контейнере частиц, у всех одна текстура */
  private readonly sparks = new ParticleContainer<Spark>({
    texture: Texture.from('circle'),
    // Каждый кадр у искр меняются позиция, размер (vertex) и прозрачность (color)
    dynamicProperties: { position: true, vertex: true, color: true },
  });
  private readonly sparkPool = new Pool(
    () => new Spark({ texture: Texture.from('circle'), anchorX: 0.5, anchorY: 0.5 }),
  );

  constructor(private readonly game: GameScreen) {
    super();
    this.label = 'effects';
    // Искры складываются со всем, что под ними: светятся, а где их много — горят почти белым
    this.sparks.blendMode = 'add';
    this.addChild(this.sparks);
  }

  /** Фишка исчезла с поля */
  onPop(piece: Piece) {
    // Фишка лежит внутри поля, а слой эффектов — нет: переводим её позицию в свои координаты
    const position = this.toLocal(piece.getGlobalPosition());
    this.playRing(position);
    this.playSparks(position, SPARK_COLORS[piece.textureName] ?? 0xffffff);
    this.playFlyToScore(piece.textureName, position);
  }

  /** Каждый кадр: двигаем искры и убираем догоревшие. Вызывает экран игры, на паузе — не вызывает */
  update(ticker: Ticker) {
    const dt = ticker.deltaMS / 1000;
    const sparks = this.sparks.particleChildren;
    // Идём с конца: удаление искры не сдвигает те, что ещё не обработаны
    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      spark.age += dt;
      if (spark.age >= SPARK_LIFE) {
        this.sparks.removeParticleAt(i);
        this.sparkPool.giveBack(spark);
        continue;
      }
      spark.vy += GRAVITY * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      // К концу жизни искра гаснет и уменьшается вдвое
      const life = 1 - spark.age / SPARK_LIFE;
      spark.alpha = life;
      spark.scaleX = spark.scaleY = SPARK_SCALE * (0.5 + life / 2);
    }
  }

  /** Найдены совпадения. На комбо поле трясёт: чем длиннее цепочка, тем сильнее */
  onMatch(round: number) {
    if (round < 2) return;
    earthquake(this.game.board.pivot, Math.min(round * SHAKE_PER_ROUND, MAX_SHAKE));
  }

  /** Взрыв: искры разлетаются во все стороны, падают и гаснут. Двигает их update */
  private playSparks(position: PointData, color: number) {
    for (let i = 0; i < SPARKS_PER_POP; i++) {
      const spark = this.sparkPool.get();
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(0.4, 1) * SPARK_SPEED;
      spark.x = position.x;
      spark.y = position.y;
      spark.vx = Math.cos(angle) * speed;
      spark.vy = Math.sin(angle) * speed;
      spark.age = 0;
      spark.alpha = 1;
      spark.scaleX = spark.scaleY = SPARK_SCALE;
      spark.tint = color;
      this.sparks.addParticle(spark);
    }
  }

  /** Кольцо расходится и тает */
  private async playRing(position: PointData) {
    const ring = this.rings.get();
    // Объект из пула помнит прошлую жизнь: задаём всё, что меняет анимация
    ring.position.copyFrom(position);
    ring.scale.set(0.3);
    ring.alpha = 1;
    this.addChild(ring);
    gsap.to(ring, { alpha: 0, duration: 0.4, ease: 'quad.in' });
    await gsap.to(ring.scale, { x: 1, y: 1, duration: 0.4, ease: 'quad.out' });
    // Вместо destroy — обратно на склад
    this.removeChild(ring);
    this.rings.giveBack(ring);
  }

  /**
   * Копия зелья летит в счёт: подпрыгивает, подрастает и ныряет в цифры.
   * Сама фишка тем временем исчезает с поля, как раньше. В оригинале зелья летят в котёл
   */
  private async playFlyToScore(textureName: string, from: PointData) {
    const copy = this.copies.get();
    copy.texture = Texture.from(textureName);
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
    // Твины x и y кончаются в тот же момент, но могли и не успеть: копия не должна уйти на склад с живыми твинами
    gsap.killTweensOf(copy);
    this.removeChild(copy);
    this.copies.giveBack(copy);
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

/** Добавляет объекту фильтр. Массив filters заморожен: push в него не сработает, нужен новый массив */
export function addFilter(target: Container, filter: Filter) {
  target.filters = [...(target.filters ?? []), filter];
}

/** Убирает у объекта фильтр, остальные фильтры остаются */
export function removeFilter(target: Container, filter: Filter) {
  target.filters = (target.filters ?? []).filter((item) => item !== filter);
}
