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

/** Клетка сетки (строка, столбец) → позиция внутри board. Центр поля — в точке (0, 0) */
function getViewPosition(row: number, column: number) {
  const offsetX = ((COLUMNS - 1) * TILE_SIZE) / 2;
  const offsetY = ((ROWS - 1) * TILE_SIZE) / 2;
  return {
    x: column * TILE_SIZE - offsetX,
    y: row * TILE_SIZE - offsetY,
  };
}

const board = new Container();
board.label = 'board';
board.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(board);

// Модель: сетка номеров типов. grid[row][column] — индекс зелья в массиве PIECES
const grid: number[][] = [];
for (let row = 0; row < ROWS; row++) {
  const cells: number[] = [];
  for (let column = 0; column < COLUMNS; column++) {
    cells.push(Math.floor(Math.random() * PIECES.length));
  }
  grid.push(cells);
}

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

console.log('Фишек на поле:', board.children.length);

// Подсвечиваем всех драконов, считаем фишки каждого типа
const counts = PIECES.map(() => 0);
for (let row = 0; row < ROWS; row++) {
  for (let column = 0; column < COLUMNS; column++) {
    const type = grid[row][column];
    counts[type]++;
    if (PIECES[type] === 'dragon') getPiece(row, column).setHighlight(true);
  }
}
PIECES.forEach((name, type) => console.log(`${name}: ${counts[type]}`));

// Выбранная фишка в центре поля: увеличиваем и выносим поверх соседей
const selected = getPiece(4, 3);
selected.scale.set(1.3);
board.addChild(selected);

// Подложка под полем: белая текстура, тонированная в чёрный и полупрозрачная
const PADDING = 10;
const bounds = board.getLocalBounds();
const background = new Sprite(Texture.WHITE);
background.label = 'background';
background.tint = 0x000000;
background.alpha = 0.3;
background.position.set(bounds.x - PADDING, bounds.y - PADDING);
background.setSize(bounds.width + PADDING * 2, bounds.height + PADDING * 2);
board.addChildAt(background, 0);

console.log('Границы board (локальные):', bounds.x, bounds.y, bounds.width, bounds.height);
const globalBounds = board.getBounds();
console.log('Границы board (глобальные):', globalBounds.x, globalBounds.y, globalBounds.width, globalBounds.height);
