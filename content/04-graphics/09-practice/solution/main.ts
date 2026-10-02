import { Application, Assets, Container, FillGradient, Graphics, GraphicsContext, Texture } from 'pixi.js';
import { HIGHLIGHT_URL, Piece } from './Piece';

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

const PIECES = ['dragon', 'frog', 'newt', 'snake', 'spider', 'yeti'];
const pieceUrl = (name: string) => `/assets/game/piece-${name}.png`;
const textures = await Assets.load<Texture>([...PIECES.map(pieceUrl), HIGHLIGHT_URL]);

const ROWS = 9;
const COLUMNS = 7;
const TILE_SIZE = 50;
const BOARD_WIDTH = COLUMNS * TILE_SIZE;
const BOARD_HEIGHT = ROWS * TILE_SIZE;

/** Клетка сетки (строка, столбец) → позиция внутри board. Центр поля — в точке (0, 0) */
function getViewPosition(row: number, column: number) {
  const offsetX = ((COLUMNS - 1) * TILE_SIZE) / 2;
  const offsetY = ((ROWS - 1) * TILE_SIZE) / 2;
  return {
    x: column * TILE_SIZE - offsetX,
    y: row * TILE_SIZE - offsetY,
  };
}

// Модель: сетка номеров типов. grid[row][column] — индекс зелья в массиве PIECES
const grid: number[][] = [];
for (let row = 0; row < ROWS; row++) {
  const cells: number[] = [];
  for (let column = 0; column < COLUMNS; column++) {
    cells.push(Math.floor(Math.random() * PIECES.length));
  }
  grid.push(cells);
}

const board = new Container();
board.label = 'board';
board.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(board);

// Подложка под полем
const PADDING = 10;
const backgroundGradient = new FillGradient({
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
  .fill(backgroundGradient)
  .stroke({ width: 3, color: 0xffd27f, alignment: 1 });
background.label = 'background';
board.addChildAt(background, 0);

// Подложки клеток: одна геометрия на все 63 клетки
const CELL_SIZE = TILE_SIZE - 4;
const cellContext = new GraphicsContext()
  .roundRect(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE, 8)
  .fill({ color: 0xffffff, alpha: 0.07 });

const cells = new Container();
cells.label = 'cells';
for (let row = 0; row < ROWS; row++) {
  for (let column = 0; column < COLUMNS; column++) {
    const cell = new Graphics(cellContext);
    cell.position.copyFrom(getViewPosition(row, column));
    cells.addChild(cell);
  }
}
board.addChildAt(cells, 1);

// Слой фишек: отдельный контейнер, чтобы обрезать его маской
const piecesContainer = new Container();
piecesContainer.label = 'pieces';
board.addChild(piecesContainer);

// Вид: фишки, построенные по модели
const pieces: Piece[] = [];
for (let row = 0; row < ROWS; row++) {
  for (let column = 0; column < COLUMNS; column++) {
    const name = PIECES[grid[row][column]];
    const piece = new Piece(textures[pieceUrl(name)], TILE_SIZE);
    piece.label = `${name} [${row}, ${column}]`;
    piece.position.copyFrom(getViewPosition(row, column));
    piecesContainer.addChild(piece);
    pieces.push(piece);
  }
}

/** Фишка в клетке (row, column). Фишки лежат в массиве построчно */
function getPiece(row: number, column: number) {
  return pieces[row * COLUMNS + column];
}

// Выбранная фишка в центре поля: подсвечиваем, увеличиваем и выносим поверх соседей
const selected = getPiece(4, 3);
selected.setHighlight(true);
selected.scale.set(1.3);
piecesContainer.addChild(selected);

// Рамка выбора: перерисовывается каждый кадр с пульсирующей толщиной
const selection = new Graphics();
selection.label = 'selection';
selection.position.copyFrom(selected.position);
board.addChild(selection);

const SELECTION_SIZE = TILE_SIZE * 1.3 + 6;
let time = 0;
app.ticker.add((ticker) => {
  time += ticker.deltaMS / 1000;
  const pulse = (Math.sin(time * 5) + 1) / 2; // от 0 до 1
  selection
    .clear()
    .roundRect(-SELECTION_SIZE / 2, -SELECTION_SIZE / 2, SELECTION_SIZE, SELECTION_SIZE, 12)
    .stroke({ width: 2 + pulse * 3, color: 0xffffff, alpha: 0.4 + pulse * 0.6 });
});

// Маска: всё, что слой фишек нарисует за пределами поля, будет обрезано
const piecesMask = new Graphics().rect(-BOARD_WIDTH / 2, -BOARD_HEIGHT / 2, BOARD_WIDTH, BOARD_HEIGHT).fill(0xffffff);
piecesMask.label = 'piecesMask';
board.addChild(piecesMask);
piecesContainer.mask = piecesMask;

// --- HUD: кнопка паузы и кольцо таймера ---
const HUD_MARGIN = 16;
const BUTTON_RADIUS = 22;

// Кнопка паузы: круг и две скруглённые полоски. Рисуем вокруг (0, 0), а ставим через position
const pauseButton = new Graphics()
  .circle(0, 0, BUTTON_RADIUS)
  .fill({ color: 0xffffff, alpha: 0.15 })
  .stroke({ width: 2, color: 0xffffff, alpha: 0.6 })
  .roundRect(-8, -9, 6, 18, 2)
  .roundRect(2, -9, 6, 18, 2)
  .fill(0xffffff);
pauseButton.label = 'pauseButton';
pauseButton.position.set(app.screen.width - HUD_MARGIN - BUTTON_RADIUS, HUD_MARGIN + BUTTON_RADIUS);
app.stage.addChild(pauseButton);

// Кольцо таймера: серая окружность и дуга прогресса поверх неё
const TIMER_RADIUS = 18;
const progress = 0.75; // осталось 75% времени
const START_ANGLE = -Math.PI / 2; // 12 часов

const timerRing = new Graphics()
  .circle(0, 0, TIMER_RADIUS)
  .stroke({ width: 6, color: 0xffffff, alpha: 0.15 })
  // arc() соединяется с текущей точкой пера, поэтому сначала переносим перо в начало дуги
  .moveTo(Math.cos(START_ANGLE) * TIMER_RADIUS, Math.sin(START_ANGLE) * TIMER_RADIUS)
  .arc(0, 0, TIMER_RADIUS, START_ANGLE, START_ANGLE + progress * Math.PI * 2)
  .stroke({ width: 6, color: 0xffd27f, cap: 'round' });
timerRing.label = 'timerRing';
timerRing.position.set(HUD_MARGIN + BUTTON_RADIUS, HUD_MARGIN + BUTTON_RADIUS);
app.stage.addChild(timerRing);
