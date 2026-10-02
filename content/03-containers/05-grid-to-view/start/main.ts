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

const board = new Container();
board.label = 'board';
board.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(board);

for (let row = 0; row < ROWS; row++) {
  for (let column = 0; column < COLUMNS; column++) {
    const name = PIECES[Math.floor(Math.random() * PIECES.length)];
    const piece = new Sprite(textures[pieceUrl(name)]);
    piece.label = `${name} [${row}, ${column}]`;
    piece.anchor.set(0.5);
    piece.setSize(TILE_SIZE - 4);
    piece.position.set(column * TILE_SIZE, row * TILE_SIZE);
    board.addChild(piece);
  }
}

console.log('Фишек на поле:', board.children.length);
