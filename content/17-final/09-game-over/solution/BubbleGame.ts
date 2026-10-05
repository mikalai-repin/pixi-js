import { sound } from '@pixi/sound';
import gsap from 'gsap';
import { Container, FederatedPointerEvent, Graphics, Rectangle, Ticker } from 'pixi.js';
import { Aim } from './Aim';
import { Bubble } from './Bubble';
import {
  advanceShot,
  BUBBLE_NAMES,
  cellToPoint,
  createBubbleGrid,
  FIELD_WIDTH,
  findCluster,
  findFloating,
  findSnapCell,
  RADIUS,
  ROW_HEIGHT,
  typesOnBoard,
  type BubbleGrid,
  type Cell,
  type Shot,
} from './bubbles';
import { Cannon } from './Cannon';
import { Label } from './Label';

/** Высота полосы над полем: в ней счёт */
const FIELD_TOP = 60;
/** Пузырь, вставший в этот ряд (считая от исходного потолка), означает проигрыш */
const LOSE_ROW = 11;
/** Линия проигрыша: верх ряда LOSE_ROW */
const LOSE_Y = FIELD_TOP + LOSE_ROW * ROW_HEIGHT;
/** Где стоит пушка */
const CANNON_Y = LOSE_Y + 80;
/** Высота всей игры: под неё main.ts подбирает масштаб */
export const GAME_HEIGHT = CANNON_Y + 60;
/** Ширина игры: поле между стенами */
export const GAME_WIDTH = FIELD_WIDTH;
/** Рядов пузырей в начале игры */
const START_ROWS = 5;
/** Скорость выстрела, пикселей в секунду */
const SHOT_SPEED = 900;
/** Насколько можно отклонить ствол от вертикали: почти до горизонта, но не до конца */
const MAX_AIM = 1.35;
/** Сколько одинаковых пузырей в группе лопаются */
const MIN_CLUSTER = 3;
/** Через сколько выстрелов потолок опускается на ряд */
const SHOTS_PER_DROP = 6;
/** Очки за лопнувший и за упавший пузырь */
const POP_POINTS = 10;
const DROP_POINTS = 20;
/** Ускорение падения оторвавшихся пузырей, пикселей в секунду за секунду */
const GRAVITY = 1800;

/**
 * Вся игра в одном контейнере: поле пузырей, пушка, прицел, счёт. Модель — в bubbles.ts,
 * здесь — её вид и правила хода. Упрощённая Bubbo Bubbo: без систем, усилений и экранов
 */
export class BubbleGame extends Container {
  /** Модель: цвета пузырей в клетках */
  private grid: BubbleGrid = [];
  /** Вид: пузыри по клеткам, null — пусто */
  private views: (Bubble | null)[][] = [];
  /** Пузыри сетки. Его двигает потолок, координаты внутри — координаты сетки */
  private readonly field = new Container();
  /** Пузыри, которые оторвались и падают: они уже не в сетке и потолок их не двигает */
  private readonly falling = new Container();
  /** Плита потолка над сеткой: растёт, когда потолок опускается */
  private readonly ceiling = new Graphics();
  private readonly aim = new Aim();
  private readonly cannon = new Cannon();
  /** Следующий пузырь — рядом с пушкой */
  private nextBubble?: Bubble;
  private readonly scoreText: Label;
  private readonly dropText: Label;
  /** Итог игры: надпись на тёмной подложке */
  private readonly messagePanel = new Container();
  private readonly message: Label;
  /** Летящий пузырь и его выстрел */
  private flying?: { bubble: Bubble; shot: Shot };
  private state: 'aiming' | 'flying' | 'over' = 'aiming';
  private score = 0;
  private shots = 0;
  /** На сколько рядов опустился потолок */
  private drops = 0;

  constructor() {
    super();
    // Подложка поля и линия проигрыша
    const back = new Graphics()
      .roundRect(-6, FIELD_TOP - 6, FIELD_WIDTH + 12, GAME_HEIGHT - FIELD_TOP + 6, 16)
      .fill({ color: 0x000000, alpha: 0.35 })
      .moveTo(0, LOSE_Y)
      .lineTo(FIELD_WIDTH, LOSE_Y)
      .stroke({ width: 2, color: 0xff5f5f, alpha: 0.6 });
    this.addChild(back, this.ceiling, this.field, this.falling);
    this.field.addChild(this.aim);

    this.cannon.position.set(FIELD_WIDTH / 2, CANNON_Y);
    this.addChild(this.cannon);

    this.scoreText = new Label('0', { fontSize: 32 });
    this.scoreText.position.set(FIELD_WIDTH / 2, FIELD_TOP / 2);
    this.dropText = new Label('', { fontSize: 16 });
    this.dropText.position.set(FIELD_WIDTH - 70, CANNON_Y + 30);
    const panel = new Graphics().roundRect(-195, -85, 390, 170, 20).fill({ color: 0x1b1530, alpha: 0.9 });
    this.message = new Label('', { fontSize: 24, fill: 0xffca42, lineHeight: 40 });
    this.messagePanel.addChild(panel, this.message);
    this.messagePanel.position.set(FIELD_WIDTH / 2, (FIELD_TOP + LOSE_Y) / 2);
    this.addChild(this.scoreText, this.dropText, this.messagePanel);

    // Целимся и стреляем в любом месте игры: зона событий — вся игра, а не только пузыри
    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, FIELD_WIDTH, GAME_HEIGHT);
    this.on('pointermove', this.onPointerMove, this);
    this.on('pointertap', this.onPointerTap, this);

    this.start();
  }

  /** Новая игра: свежая сетка, потолок на месте, счёт с нуля */
  private start() {
    this.field.removeChildren().forEach((child) => child !== this.aim && child.destroy());
    this.field.addChild(this.aim);
    this.falling.removeChildren().forEach((child) => child.destroy());
    this.nextBubble?.destroy();
    this.nextBubble = undefined;
    this.cannon.unload()?.destroy();

    this.grid = createBubbleGrid(START_ROWS, BUBBLE_NAMES.map((_, index) => index + 1));
    this.views = this.grid.map((cells, row) => cells.map((type, column) => (type ? this.createBubble({ row, column }, type) : null)));
    this.score = 0;
    this.shots = 0;
    this.drops = 0;
    this.field.y = FIELD_TOP;
    this.drawCeiling();
    this.scoreText.text = '0';
    this.messagePanel.visible = false;
    this.aim.visible = true;
    this.loadCannon();
    this.updateDropText();
    this.state = 'aiming';
  }

  /** Пузырь цвета type в клетке cell: модель уже знает о нём, создаём вид */
  private createBubble(cell: Cell, type: number) {
    const bubble = new Bubble(type);
    bubble.position.copyFrom(cellToPoint(cell));
    this.field.addChild(bubble);
    return bubble;
  }

  /** Заряжает пушку следующим пузырём, а следующим становится новый. Цвета — только те, что есть на поле */
  private loadCannon() {
    const types = typesOnBoard(this.grid);
    if (types.length === 0) return;
    const random = () => types[Math.floor(Math.random() * types.length)];
    // Цвет мог исчезнуть с поля, пока пузырь ждал своей очереди
    const next = this.nextBubble && types.includes(this.nextBubble.type) ? this.nextBubble.type : random();
    this.nextBubble?.destroy();
    this.cannon.load(next);
    this.nextBubble = new Bubble(random());
    this.nextBubble.scale.set(0.7);
    this.nextBubble.position.set(FIELD_WIDTH / 2 - 80, CANNON_Y + 30);
    this.addChild(this.nextBubble);
  }

  private onPointerMove(event: FederatedPointerEvent) {
    if (this.state !== 'aiming') return;
    const point = this.toLocal(event.global);
    // Угол от вертикали: atan2(dx, −dy), потому что ось y смотрит вниз
    const angle = Math.atan2(point.x - this.cannon.x, this.cannon.y - point.y);
    this.cannon.aim = Math.max(-MAX_AIM, Math.min(MAX_AIM, angle));
  }

  private onPointerTap(event: FederatedPointerEvent) {
    if (this.state === 'over') {
      this.start();
      return;
    }
    if (this.state !== 'aiming') return;
    // На телефоне нет наведения: нажатие сразу и целится, и стреляет
    this.onPointerMove(event);
    this.shoot();
  }

  /** Выстрел из ствола: пузырь переезжает из пушки в сетку и летит, пока не врежется */
  private shoot() {
    const bubble = this.cannon.unload();
    if (!bubble) return;
    const shot = this.cannonShot();
    bubble.position.set(shot.x, shot.y);
    this.field.addChild(bubble);
    this.flying = { bubble, shot };
    this.state = 'flying';
    this.aim.visible = false;
    sound.play('bubbo/cannon-move.wav', { volume: 0.5 });
  }

  /** Выстрел из центра пушки по направлению ствола, в координатах сетки */
  private cannonShot(): Shot {
    const angle = this.cannon.aim;
    return { x: this.cannon.x, y: this.cannon.y - this.field.y, dx: Math.sin(angle), dy: -Math.cos(angle) };
  }

  /** Каждый кадр: прицел, полёт выстрела, падение оторвавшихся пузырей */
  update(ticker: Ticker) {
    const dt = ticker.deltaMS / 1000;
    if (this.state === 'aiming') this.aim.update(this.grid, this.cannonShot());
    if (this.flying) {
      const { bubble, shot } = this.flying;
      const hit = advanceShot(this.grid, shot, SHOT_SPEED * dt);
      bubble.position.set(shot.x, shot.y);
      if (hit) this.land();
    }
    this.updateFalling(dt);
  }

  /** Выстрел врезался: пузырь встаёт в ближайшую свободную клетку, дальше — правила */
  private land() {
    const { bubble, shot } = this.flying!;
    this.flying = undefined;
    const cell = findSnapCell(this.grid, shot.x, shot.y);
    if (!cell) {
      // Места нет совсем: сетка заполнена до низа
      bubble.destroy();
      this.gameOver('Поле заполнено');
      return;
    }
    this.grid[cell.row][cell.column] = bubble.type;
    this.views[cell.row][cell.column] = bubble;
    bubble.position.copyFrom(cellToPoint(cell));
    bubble.shimmer();
    sound.play('bubbo/bubble-land-sfx.wav', { speed: 0.8 + Math.random() * 0.3 });

    const cluster = findCluster(this.grid, cell, true);
    if (cluster.length >= MIN_CLUSTER) {
      this.popCluster(cluster);
      this.dropFloating();
    }
    this.shots++;
    this.afterShot();
  }

  /** Группа лопается: из модели сразу, на экране — волной от места попадания */
  private popCluster(cluster: Cell[]) {
    cluster.forEach((cell, index) => {
      const bubble = this.views[cell.row][cell.column]!;
      this.grid[cell.row][cell.column] = 0;
      this.views[cell.row][cell.column] = null;
      // findCluster идёт от попадания вширь: чем дальше пузырь, тем позже он лопается
      bubble.pop(index * 0.03).then(() => bubble.destroy());
    });
    this.addScore(cluster.length * POP_POINTS);
  }

  /** Пузыри, которые больше не держатся за потолок, падают */
  private dropFloating() {
    const floating = findFloating(this.grid);
    if (floating.length === 0) return;
    for (const cell of floating) {
      const bubble = this.views[cell.row][cell.column]!;
      this.grid[cell.row][cell.column] = 0;
      this.views[cell.row][cell.column] = null;
      // Слой падения не двигается вместе с потолком: переводим позицию в координаты игры
      bubble.y += this.field.y;
      this.falling.addChild(bubble);
      bubble.vx = (Math.random() - 0.5) * 200;
      bubble.vy = -Math.random() * 300;
    }
    sound.play('bubbo/bubbles-falling.wav', { volume: 0.6 });
    this.addScore(floating.length * DROP_POINTS);
  }

  private updateFalling(dt: number) {
    // Идём с конца: удаление пузыря не сдвигает те, что ещё не обработаны
    for (let i = this.falling.children.length - 1; i >= 0; i--) {
      const bubble = this.falling.children[i] as Bubble;
      bubble.vy += GRAVITY * dt;
      bubble.x += bubble.vx * dt;
      bubble.y += bubble.vy * dt;
      bubble.rotation += bubble.vx * dt * 0.02;
      if (bubble.y > GAME_HEIGHT + RADIUS) bubble.destroy();
    }
  }

  /** После каждого выстрела: победа, проигрыш, спуск потолка — или следующий выстрел */
  private afterShot() {
    if (typesOnBoard(this.grid).length === 0) {
      this.gameOver('Победа!');
      return;
    }
    if (this.shots % SHOTS_PER_DROP === 0) {
      this.drops++;
      // Потолок съезжает плавно, а проверяем проигрыш, когда он встал
      this.state = 'flying';
      gsap
        .to(this.field, {
          y: FIELD_TOP + this.drops * ROW_HEIGHT,
          duration: 0.3,
          ease: 'back.out',
          // Плита потолка перерисовывается каждый кадр спуска: Graphics можно очистить и нарисовать заново
          onUpdate: () => this.drawCeiling(),
        })
        .then(() => this.nextShot());
      this.updateDropText();
      return;
    }
    this.updateDropText();
    this.nextShot();
  }

  /** Проверяем линию проигрыша и заряжаем пушку */
  private nextShot() {
    if (this.lowestRow() + this.drops >= LOSE_ROW) {
      this.gameOver('Игра окончена');
      return;
    }
    this.loadCannon();
    this.aim.visible = true;
    this.state = 'aiming';
  }

  /** Плита потолка: от верха поля до верхнего ряда сетки */
  private drawCeiling() {
    this.ceiling.clear();
    const height = this.field.y - FIELD_TOP;
    if (height <= 0) return;
    this.ceiling
      .rect(0, FIELD_TOP, FIELD_WIDTH, height)
      .fill(0x3a2f6b)
      .moveTo(0, this.field.y)
      .lineTo(FIELD_WIDTH, this.field.y)
      .stroke({ width: 3, color: 0xffca42 });
  }

  /** Самый нижний ряд, в котором есть пузырь, или −1 */
  private lowestRow() {
    for (let row = this.grid.length - 1; row >= 0; row--) {
      if (this.grid[row].some((type) => type !== 0)) return row;
    }
    return -1;
  }

  private gameOver(text: string) {
    this.state = 'over';
    this.aim.visible = false;
    this.message.text = `${text}\nОчки: ${this.score}\nНажмите, чтобы сыграть ещё`;
    this.messagePanel.visible = true;
    gsap.from(this.messagePanel.scale, { x: 0, y: 0, duration: 0.4, ease: 'back.out' });
  }

  private addScore(points: number) {
    this.score += points;
    this.scoreText.text = String(this.score);
    gsap.fromTo(this.scoreText.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out' });
  }

  private updateDropText() {
    const left = SHOTS_PER_DROP - (this.shots % SHOTS_PER_DROP);
    this.dropText.text = `Потолок\nчерез ${left}`;
  }
}
