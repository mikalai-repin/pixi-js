import { Container, FederatedPointerEvent, Graphics, Rectangle, Ticker } from 'pixi.js';
import { Aim } from './Aim';
import { Bubble } from './Bubble';
import {
  BUBBLE_NAMES,
  cellToPoint,
  createBubbleGrid,
  FIELD_WIDTH,
  ROW_HEIGHT,
  typesOnBoard,
  type BubbleGrid,
  type Cell,
  type Shot,
} from './bubbles';
import { Cannon } from './Cannon';

/** Высота полосы над полем: там появится счёт */
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
/** Насколько можно отклонить ствол от вертикали: почти до горизонта, но не до конца */
const MAX_AIM = 1.35;

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
  private readonly aim = new Aim();
  private readonly cannon = new Cannon();

  constructor() {
    super();
    // Подложка поля и линия проигрыша
    const back = new Graphics()
      .roundRect(-6, FIELD_TOP - 6, FIELD_WIDTH + 12, GAME_HEIGHT - FIELD_TOP + 6, 16)
      .fill({ color: 0x000000, alpha: 0.35 })
      .moveTo(0, LOSE_Y)
      .lineTo(FIELD_WIDTH, LOSE_Y)
      .stroke({ width: 2, color: 0xff5f5f, alpha: 0.6 });
    this.addChild(back, this.field);
    this.field.addChild(this.aim);

    this.cannon.position.set(FIELD_WIDTH / 2, CANNON_Y);
    this.addChild(this.cannon);

    // Целимся в любом месте игры: зона событий — вся игра, а не только пузыри
    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, FIELD_WIDTH, GAME_HEIGHT);
    this.on('pointermove', this.onPointerMove, this);

    this.start();
  }

  /** Новая игра: свежая сетка и заряженная пушка */
  private start() {
    this.grid = createBubbleGrid(START_ROWS, BUBBLE_NAMES.map((_, index) => index + 1));
    this.views = this.grid.map((cells, row) => cells.map((type, column) => (type ? this.createBubble({ row, column }, type) : null)));
    this.field.y = FIELD_TOP;
    this.loadCannon();
  }

  /** Пузырь цвета type в клетке cell: модель уже знает о нём, создаём вид */
  private createBubble(cell: Cell, type: number) {
    const bubble = new Bubble(type);
    bubble.position.copyFrom(cellToPoint(cell));
    this.field.addChild(bubble);
    return bubble;
  }

  /** Заряжает пушку пузырём случайного цвета. Цвета — только те, что есть на поле */
  private loadCannon() {
    const types = typesOnBoard(this.grid);
    this.cannon.load(types[Math.floor(Math.random() * types.length)]);
  }

  private onPointerMove(event: FederatedPointerEvent) {
    const point = this.toLocal(event.global);
    // Угол от вертикали: atan2(dx, −dy), потому что ось y смотрит вниз
    const angle = Math.atan2(point.x - this.cannon.x, this.cannon.y - point.y);
    this.cannon.aim = Math.max(-MAX_AIM, Math.min(MAX_AIM, angle));
  }

  /** Выстрел из центра пушки по направлению ствола, в координатах сетки */
  private cannonShot(): Shot {
    const angle = this.cannon.aim;
    return { x: this.cannon.x, y: this.cannon.y - this.field.y, dx: Math.sin(angle), dy: -Math.cos(angle) };
  }

  /** Каждый кадр: прицел следует за стволом */
  update(_ticker: Ticker) {
    this.aim.update(this.grid, this.cannonShot());
  }
}
