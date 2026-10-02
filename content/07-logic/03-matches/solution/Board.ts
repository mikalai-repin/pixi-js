import { Container, FillGradient, Graphics, GraphicsContext, Ticker, type DestroyOptions } from 'pixi.js';
import { createGrid, getMatches, isInside, swapTypes, type Grid, type PieceType, type Position } from './grid';
import { Piece, type SwipeDirection } from './Piece';

/** Имена текстур зелий. Тип фишки в сетке — индекс в этом массиве плюс один: 0 означает пустую клетку */
export const PIECE_NAMES = ['piece-dragon', 'piece-frog', 'piece-newt', 'piece-snake', 'piece-spider', 'piece-yeti'];
const TYPES = PIECE_NAMES.map((_, index) => index + 1);

const ROWS = 9;
const COLUMNS = 7;
const TILE_SIZE = 50;
const BOARD_WIDTH = COLUMNS * TILE_SIZE;
const BOARD_HEIGHT = ROWS * TILE_SIZE;
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

  constructor(private readonly ticker: Ticker) {
    super();
    this.label = 'board';
    this.addChild(createBackground(), createCells(this));

    this.piecesContainer.label = 'pieces';
    this.addChild(this.piecesContainer);

    this.selection.label = 'selection';
    this.selection.visible = false;
    this.addChild(this.selection);
    this.ticker.add(this.pulseSelection, this);

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
      this.selected.scale.set(1);
    }
    this.selected = piece;
    this.selection.visible = piece !== null;
    if (!piece) return;
    piece.setHighlight(true);
    piece.scale.set(1.3);
    this.piecesContainer.addChild(piece);
  }

  /** Кладёт фишку в клетку: в массив pieces и на нужное место на экране */
  private setPiece(position: Position, piece: Piece | null) {
    this.pieces[position.row * COLUMNS + position.column] = piece;
    if (!piece) return;
    piece.row = position.row;
    piece.column = position.column;
    piece.position.copyFrom(this.getViewPosition(position));
  }

  private createPiece(position: Position, type: PieceType) {
    const name = PIECE_NAMES[type - 1];
    const piece = new Piece(name, TILE_SIZE);
    piece.label = name;
    piece.onTap = (tapped) => this.select(tapped);
    piece.onSwipe = (swiped, direction) => this.onSwipe(swiped, direction);
    piece.on('pointerover', () => {
      if (piece !== this.selected) piece.scale.set(1.1);
    });
    piece.on('pointerout', () => {
      if (piece !== this.selected) piece.scale.set(1);
    });
    this.piecesContainer.addChild(piece);
    this.setPiece(position, piece);
    return piece;
  }

  private onSwipe(piece: Piece, direction: SwipeDirection) {
    const from = { row: piece.row, column: piece.column };
    const to = { row: from.row + DIRECTIONS[direction].row, column: from.column + DIRECTIONS[direction].column };
    // Свайп за край поля — некуда меняться
    if (!isInside(this.grid, to)) return;

    this.swap(from, to);
    this.select(piece);
    this.highlightMatches();
  }

  /** Меняет местами две фишки: в модели и на экране */
  private swap(a: Position, b: Position) {
    swapTypes(this.grid, a, b);
    const pieceA = this.getPiece(a);
    const pieceB = this.getPiece(b);
    this.setPiece(a, pieceB);
    this.setPiece(b, pieceA);
  }

  /** Подсвечивает все фишки, которые сейчас входят в совпадения */
  private highlightMatches() {
    const matches = getMatches(this.grid);
    for (const piece of this.pieces) piece?.setHighlight(piece === this.selected);
    for (const match of matches) {
      for (const position of match) this.getPiece(position)?.setHighlight(true);
    }
    console.log(`Совпадений на поле: ${matches.length}`);
  }

  private pulseSelection(ticker: Ticker) {
    if (!this.selected) return;
    this.time += ticker.deltaMS / 1000;
    const pulse = (Math.sin(this.time * 5) + 1) / 2; // от 0 до 1
    this.selection.position.copyFrom(this.selected.position);
    this.selection
      .clear()
      .roundRect(-SELECTION_SIZE / 2, -SELECTION_SIZE / 2, SELECTION_SIZE, SELECTION_SIZE, 12)
      .stroke({ width: 2 + pulse * 3, color: 0xffffff, alpha: 0.4 + pulse * 0.6 });
  }

  override destroy(options?: DestroyOptions) {
    this.ticker.remove(this.pulseSelection, this);
    super.destroy(options);
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
