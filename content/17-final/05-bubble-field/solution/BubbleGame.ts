import { Container, Graphics, Ticker } from 'pixi.js';
import { Bubble } from './Bubble';
import { BUBBLE_NAMES, cellToPoint, createBubbleGrid, FIELD_WIDTH, ROW_HEIGHT, type BubbleGrid, type Cell } from './bubbles';

/** Высота полосы над полем: там появится счёт */
const FIELD_TOP = 60;
/** Пузырь, вставший в этот ряд (считая от исходного потолка), означает проигрыш */
const LOSE_ROW = 11;
/** Линия проигрыша: верх ряда LOSE_ROW */
const LOSE_Y = FIELD_TOP + LOSE_ROW * ROW_HEIGHT;
/** Где будет стоять пушка */
const CANNON_Y = LOSE_Y + 80;
/** Высота всей игры: под неё main.ts подбирает масштаб */
export const GAME_HEIGHT = CANNON_Y + 60;
/** Ширина игры: поле между стенами */
export const GAME_WIDTH = FIELD_WIDTH;
/** Рядов пузырей в начале игры */
const START_ROWS = 5;

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
    this.start();
  }

  /** Новая игра: свежая сетка */
  private start() {
    this.grid = createBubbleGrid(START_ROWS, BUBBLE_NAMES.map((_, index) => index + 1));
    this.views = this.grid.map((cells, row) => cells.map((type, column) => (type ? this.createBubble({ row, column }, type) : null)));
    this.field.y = FIELD_TOP;
  }

  /** Пузырь цвета type в клетке cell: модель уже знает о нём, создаём вид */
  private createBubble(cell: Cell, type: number) {
    const bubble = new Bubble(type);
    bubble.position.copyFrom(cellToPoint(cell));
    this.field.addChild(bubble);
    return bubble;
  }

  /** Каждый кадр. Пока на поле ничего не движется: пушка и выстрел появятся в следующих шагах */
  update(_ticker: Ticker) {}
}
