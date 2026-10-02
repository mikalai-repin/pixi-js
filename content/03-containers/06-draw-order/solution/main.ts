import { Application, Assets, Container, Sprite, Texture } from 'pixi.js';

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

const PIECES = ['dragon', 'frog', 'newt', 'snake', 'spider', 'yeti'];
const pieceUrl = (name: string) => `/assets/game/piece-${name}.png`;
const textures = await Assets.load<Texture>(PIECES.map(pieceUrl));

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

const pieces: Sprite[] = [];

for (let row = 0; row < ROWS; row++) {
  for (let column = 0; column < COLUMNS; column++) {
    const name = PIECES[Math.floor(Math.random() * PIECES.length)];
    const piece = new Sprite(textures[pieceUrl(name)]);
    piece.label = `${name} [${row}, ${column}]`;
    piece.anchor.set(0.5);
    piece.setSize(TILE_SIZE - 4);
    piece.position.copyFrom(getViewPosition(row, column));
    board.addChild(piece);
    pieces.push(piece);
  }
}

console.log('Фишек на поле:', board.children.length);

// Выбранная фишка в центре поля: увеличиваем и выносим поверх соседей
const selected = pieces[4 * COLUMNS + 3];
selected.scale.set(selected.scale.x * 1.6);
board.addChild(selected);
