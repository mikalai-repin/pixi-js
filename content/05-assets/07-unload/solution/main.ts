import { Application, Assets, Container, FillGradient, Graphics, GraphicsContext, Sprite, Texture } from 'pixi.js';
import { ASSETS_BASE_PATH, MANIFEST_URL } from './manifest';
import { Piece } from './Piece';

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

const PIECES = ['dragon', 'frog', 'newt', 'snake', 'spider', 'yeti'];

await Assets.init({
  manifest: MANIFEST_URL,
  basePath: ASSETS_BASE_PATH,
  texturePreference: {
    resolution: Math.min(window.devicePixelRatio, 2),
    format: ['webp', 'png'],
  },
});

// Полоска загрузки: дорожка и заполненная часть
const loadingBar = new Graphics();
loadingBar.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(loadingBar);

function drawProgress(progress: number) {
  console.log(`Загружено: ${Math.round(progress * 100)}%`);
  loadingBar
    .clear()
    .roundRect(-100, -6, 200, 12, 6)
    .fill({ color: 0xffffff, alpha: 0.15 })
    .roundRect(-100, -6, 200 * progress, 12, 6)
    .fill(0xffd27f);
}
drawProgress(0);

await Assets.loadBundle('game', drawProgress);
loadingBar.destroy();

// Какой файл атласа выбрал Assets
const dragonTexture = Texture.from('piece-dragon');
console.log('Атлас:', dragonTexture.source.label);
console.log('Разрешение атласа:', dragonTexture.source.resolution);
console.log('Кадр в атласе:', dragonTexture.frame.width, '×', dragonTexture.frame.height);
console.log('Исходный размер:', dragonTexture.orig.width, '×', dragonTexture.orig.height);

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
    const piece = new Piece(`piece-${name}`, TILE_SIZE);
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

// Пока игрок смотрит на поле, тихо догружаем остальные бандлы
Assets.backgroundLoadBundle(['common', 'home', 'result']);

// Позже понадобилась кнопка паузы из бандла common: он уже загружен или догружается в фоне
const startTime = performance.now();
await Assets.loadBundle('common');
console.log(`Бандл common готов через ${Math.round(performance.now() - startTime)} мс`);

const pauseButton = new Sprite(Texture.from('icon-pause'));
pauseButton.label = 'pauseButton';
pauseButton.anchor.set(1, 0);
pauseButton.position.set(app.screen.width - 16, 16);
app.stage.addChild(pauseButton);

// Экран результатов показали и закрыли — его ресурсы больше не нужны
await Assets.loadBundle('result');
console.log('result-base в кэше:', Assets.cache.has('result-base'));
await Assets.unload('result-atlas');
console.log('result-base после выгрузки:', Assets.cache.has('result-base'));
