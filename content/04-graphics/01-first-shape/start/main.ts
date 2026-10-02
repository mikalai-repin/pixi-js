import { Application, Assets, Container, Sprite, Texture } from 'pixi.js';
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

// Вид: фишки, построенные по модели
const pieces: Piece[] = [];
for (let row = 0; row < ROWS; row++) {
  for (let column = 0; column < COLUMNS; column++) {
    const name = PIECES[grid[row][column]];
    const piece = new Piece(textures[pieceUrl(name)], TILE_SIZE);
    piece.label = `${name} [${row}, ${column}]`;
    piece.position.copyFrom(getViewPosition(row, column));
    board.addChild(piece);
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
board.addChild(selected);

// Подложка под полем: белая текстура, тонированная в чёрный и полупрозрачная
const PADDING = 10;
const background = new Sprite(Texture.WHITE);
background.label = 'background';
background.tint = 0x000000;
background.alpha = 0.3;
background.position.set(-BOARD_WIDTH / 2 - PADDING, -BOARD_HEIGHT / 2 - PADDING);
background.setSize(BOARD_WIDTH + PADDING * 2, BOARD_HEIGHT + PADDING * 2);
board.addChildAt(background, 0);
