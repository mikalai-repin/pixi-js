import gsap from 'gsap';
import { Container, FillGradient, Graphics, GraphicsContext, Ticker } from 'pixi.js';
import { applyGravity, cloneGrid, createGrid, fillUp, getMatches, isInside, setType, swapTypes, type Grid, type PieceType, type Position } from './grid';
import { Piece, type SwipeDirection } from './Piece';

/** Имена текстур зелий. Тип фишки в сетке — индекс в этом массиве плюс один: 0 означает пустую клетку */
export const PIECE_NAMES = ['piece-dragon', 'piece-frog', 'piece-newt', 'piece-snake', 'piece-spider', 'piece-yeti'];
const TYPES = PIECE_NAMES.map((_, index) => index + 1);

const ROWS = 9;
const COLUMNS = 7;
/** Размер клетки поля */
export const TILE_SIZE = 50;
/** Размеры поля без рамки: пригодятся, чтобы расставлять интерфейс вокруг него */
export const BOARD_WIDTH = COLUMNS * TILE_SIZE;
export const BOARD_HEIGHT = ROWS * TILE_SIZE;
const PADDING = 10;
const SELECTION_SIZE = TILE_SIZE * 1.3 + 6;

/** Смещение клетки для каждого направления свайпа */
const DIRECTIONS: Record<SwipeDirection, Position> = {
  left: { row: 0, column: -1 },
  right: { row: 0, column: 1 },
  up: { row: -1, column: 0 },
  down: { row: 1, column: 0 },
};

/**
 * Игровое поле: модель (grid), её вид (фишки) и реакция на действия игрока.
 * Упрощённая версия Match3Board и Match3Actions из Puzzling Potions.
 */
export class Board extends Container {
  /** Модель: grid[row][column] — тип фишки, 0 — пусто */
  readonly grid: Grid;
  /** Вид: фишки построчно, null — в клетке нет фишки */
  private readonly pieces: (Piece | null)[] = [];
  private readonly piecesContainer = new Container();
  private readonly selection = new Graphics();
  private selected: Piece | null = null;
  private time = 0;
  /** Идёт анимация хода: новые ходы и выбор фишек не принимаются */
  private processing = false;
  /** Вызывается в каждом раунде каскада, когда найдены совпадения. round — номер раунда, с 1 */
  onMatch?: (matches: Position[][], round: number) => void;
  /** Вызывается для каждой фишки, которая исчезает с поля. Нужен эффектам, правилам игры он не важен */
  onPop?: (piece: Piece) => void;

  constructor(private readonly ticker: Ticker) {
    super();
    this.label = 'board';
    this.addChild(createBackground(), createCells(this));

    this.piecesContainer.label = 'pieces';
    this.addChild(this.piecesContainer);

    this.selection.label = 'selection';
    this.selection.visible = false;
    this.addChild(this.selection);
    this.selection.onRender = () => this.pulseSelection();

    // Маска: всё, что слой фишек нарисует за пределами поля, будет обрезано
    const mask = new Graphics().rect(-BOARD_WIDTH / 2, -BOARD_HEIGHT / 2, BOARD_WIDTH, BOARD_HEIGHT).fill(0xffffff);
    mask.label = 'piecesMask';
    this.addChild(mask);
    this.piecesContainer.mask = mask;

    this.grid = createGrid(ROWS, COLUMNS, TYPES);
    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        this.createPiece({ row, column }, this.grid[row][column]);
      }
    }
  }

  /** Идёт ли сейчас ход: обмен или каскад с анимациями */
  get isProcessing() {
    return this.processing;
  }

  /** Заблокировано ли поле для игрока, например на паузе */
  get locked() {
    return !this.piecesContainer.interactiveChildren;
  }

  set locked(value: boolean) {
    this.piecesContainer.interactiveChildren = !value;
  }

  /** Клетка сетки → позиция внутри поля. Центр поля — в точке (0, 0) */
  getViewPosition(position: Position) {
    return {
      x: position.column * TILE_SIZE - ((COLUMNS - 1) * TILE_SIZE) / 2,
      y: position.row * TILE_SIZE - ((ROWS - 1) * TILE_SIZE) / 2,
    };
  }

  /** Фишка в клетке или null, если клетка пуста */
  getPiece(position: Position) {
    return this.pieces[position.row * COLUMNS + position.column] ?? null;
  }

  /** Выбирает фишку: подсветка, увеличение, рамка. null снимает выбор */
  select(piece: Piece | null) {
    if (this.selected) {
      this.selected.setHighlight(false);
      // Анимация увеличения могла ещё не закончиться: останавливаем её, иначе она перезапишет scale
      gsap.killTweensOf(this.selected.scale);
      this.selected.scale.set(1);
    }
    this.selected = piece;
    this.selection.visible = piece !== null;
    if (!piece) return;
    piece.setHighlight(true);
    gsap.to(piece.scale, { x: 1.3, y: 1.3, duration: 0.2, ease: 'back.out' });
    this.piecesContainer.addChild(piece);
  }

  /** Записывает фишку в клетку: в массив pieces и в её row и column. На экране фишку не двигает */
  private setPiece(position: Position, piece: Piece | null) {
    this.pieces[position.row * COLUMNS + position.column] = piece;
    if (!piece) return;
    piece.row = position.row;
    piece.column = position.column;
  }

  private createPiece(position: Position, type: PieceType) {
    const name = PIECE_NAMES[type - 1];
    const piece = new Piece(name, TILE_SIZE, this.ticker);
    piece.label = name;
    piece.onTap = (tapped) => {
      if (!this.processing) this.select(tapped);
    };
    piece.onSwipe = (swiped, direction) => this.onSwipe(swiped, direction);
    piece.on('pointerover', () => {
      if (piece !== this.selected) piece.scale.set(1.1);
    });
    piece.on('pointerout', () => {
      if (piece !== this.selected) piece.scale.set(1);
    });
    this.piecesContainer.addChild(piece);
    this.setPiece(position, piece);
    piece.position.copyFrom(this.getViewPosition(position));
    return piece;
  }

  private async onSwipe(piece: Piece, direction: SwipeDirection) {
    // Пока идёт анимация хода, новые ходы не принимаем
    if (this.processing) return;
    const from = { row: piece.row, column: piece.column };
    const to = { row: from.row + DIRECTIONS[direction].row, column: from.column + DIRECTIONS[direction].column };
    // Свайп за край поля — некуда меняться
    if (!isInside(this.grid, to)) return;

    const valid = this.isValidMove(from, to);
    this.processing = true;
    // Выбранная фишка рисуется поверх остальных — пусть она и едет сверху
    this.select(piece);
    await this.swap(from, to);
    if (valid) {
      await this.process();
    } else {
      // Ход без совпадений: фишки съезжаются и возвращаются на свои места
      console.log('Ход не создаёт совпадений');
      await this.swap(from, to);
    }
    this.processing = false;
  }

  /** Меняет местами две фишки: в модели сразу, на экране — плавно */
  private async swap(a: Position, b: Position) {
    const pieceA = this.getPiece(a);
    const pieceB = this.getPiece(b);
    if (!pieceA || !pieceB) return;
    swapTypes(this.grid, a, b);
    this.setPiece(a, pieceB);
    this.setPiece(b, pieceA);
    // Модель уже изменилась, а фишки на экране её догоняют
    const viewA = this.getViewPosition(a);
    const viewB = this.getViewPosition(b);
    await Promise.all([pieceA.animateMove(viewB.x, viewB.y), pieceB.animateMove(viewA.x, viewA.y)]);
  }

  /** Ход разрешён, только если после обмена появится совпадение с участием одной из двух клеток */
  private isValidMove(from: Position, to: Position) {
    const preview = cloneGrid(this.grid);
    swapTypes(preview, from, to);
    return getMatches(preview, [from, to]).length > 0;
  }

  /** Убирает с поля фишки из совпадений: в модели сразу остаётся 0, фишки исчезают и уничтожаются */
  private async popMatches(matches: Position[][]) {
    const popped: Piece[] = [];
    for (const match of matches) {
      for (const position of match) {
        const piece = this.getPiece(position);
        // Клетка может входить сразу в два совпадения (уголком), и фишку уже убрали
        if (!piece) continue;
        if (piece === this.selected) this.select(null);
        setType(this.grid, position, 0);
        this.setPiece(position, null);
        popped.push(piece);
        this.onPop?.(piece);
      }
    }
    // Все фишки исчезают одновременно, а уничтожаем их, когда анимация закончилась
    await Promise.all(popped.map((piece) => piece.animatePop()));
    for (const piece of popped) piece.destroy({ children: true });
  }

  /** Роняет фишки на пустые клетки: модель меняется сразу, фишки падают плавно */
  private async dropPieces() {
    const moves = applyGravity(this.grid);
    const animations: Promise<void>[] = [];
    for (const [from, to] of moves) {
      const piece = this.getPiece(from);
      if (!piece) continue;
      this.setPiece(from, null);
      this.setPiece(to, piece);
      const view = this.getViewPosition(to);
      animations.push(piece.animateFall(view.x, view.y));
    }
    await Promise.all(animations);
  }

  /** Создаёт новые фишки над полем и роняет их в пустые клетки */
  private async refillPieces() {
    const filled = fillUp(this.grid, TYPES);
    const animations: Promise<void>[] = [];
    // Сколько новых фишек уже появилось в каждом столбце: они встают друг над другом
    const perColumn = new Array<number>(COLUMNS).fill(0);
    for (const position of filled) {
      const piece = this.createPiece(position, this.grid[position.row][position.column]);
      perColumn[position.column]++;
      const view = this.getViewPosition(position);
      // Начинаем выше поля: маска слоя фишек их пока скрывает
      piece.y = -BOARD_HEIGHT / 2 - perColumn[position.column] * TILE_SIZE;
      animations.push(piece.animateFall(view.x, view.y));
    }
    await Promise.all(animations);
  }

  /**
   * Каскад: убираем совпадения, роняем фишки, досыпаем новые — и повторяем,
   * пока новые фишки образуют новые совпадения. Каждый этап ждёт своей анимации. Упрощённый Match3Process
   */
  private async process() {
    let round = 0;
    let matches = getMatches(this.grid);
    while (matches.length > 0) {
      round++;
      this.onMatch?.(matches, round);
      await this.popMatches(matches);
      // Старые фишки падают одновременно с новыми. dropPieces успевает изменить модель
      // до своего первого await, поэтому refillPieces уже видит пустые клетки наверху
      await Promise.all([this.dropPieces(), this.refillPieces()]);
      matches = getMatches(this.grid);
    }
    console.log(round > 1 ? `Комбо! Раундов каскада: ${round}` : 'Совпадение убрано');
  }

  private pulseSelection() {
    if (!this.selected) return;
    this.time += this.ticker.deltaMS / 1000;
    const pulse = (Math.sin(this.time * 5) + 1) / 2; // от 0 до 1
    this.selection.position.copyFrom(this.selected.position);
    this.selection
      .clear()
      .roundRect(-SELECTION_SIZE / 2, -SELECTION_SIZE / 2, SELECTION_SIZE, SELECTION_SIZE, 12)
      .stroke({ width: 2 + pulse * 3, color: 0xffffff, alpha: 0.4 + pulse * 0.6 });
  }
}

/** Подложка поля с градиентом и золотой рамкой */
function createBackground() {
  const gradient = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: '#4a2a7a' },
      { offset: 1, color: '#160a2e' },
    ],
  });
  const background = new Graphics()
    .roundRect(-BOARD_WIDTH / 2 - PADDING, -BOARD_HEIGHT / 2 - PADDING, BOARD_WIDTH + PADDING * 2, BOARD_HEIGHT + PADDING * 2, 16)
    .fill(gradient)
    .stroke({ width: 3, color: 0xffd27f, alignment: 1 });
  background.label = 'background';
  return background;
}

/** Подложки клеток: одна геометрия на все клетки */
function createCells(board: Board) {
  const size = TILE_SIZE - 4;
  const context = new GraphicsContext().roundRect(-size / 2, -size / 2, size, size, 8).fill({ color: 0xffffff, alpha: 0.07 });
  const cells = new Container();
  cells.label = 'cells';
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const cell = new Graphics(context);
      cell.position.copyFrom(board.getViewPosition({ row, column }));
      cells.addChild(cell);
    }
  }
  return cells;
}
