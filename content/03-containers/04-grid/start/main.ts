import { Application, Assets, Container, Sprite, Texture } from 'pixi.js';

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

const PIECES = ['dragon', 'frog', 'newt', 'snake', 'spider', 'yeti'];
const pieceUrl = (name: string) => `/assets/game/piece-${name}.png`;
const textures = await Assets.load<Texture>(PIECES.map(pieceUrl));

/** Выводит дерево сцены в консоль, по одной строке на объект */
function printTree(node: Container, depth = 0) {
  console.log(`${'  '.repeat(depth)}${node.label || node.constructor.name}`);
  for (const child of node.children) printTree(child, depth + 1);
}

const board = new Container();
board.label = 'board';
board.position.set(app.screen.width / 2, app.screen.height / 2);
board.scale.set(2);
app.stage.addChild(board);

const dragon = new Sprite(textures[pieceUrl('dragon')]);
dragon.label = 'dragon';
dragon.anchor.set(0.5);
dragon.setSize(50);
board.addChild(dragon);

const frog = new Sprite(textures[pieceUrl('frog')]);
frog.label = 'frog';
frog.anchor.set(0.5);
frog.setSize(50);
frog.x = 60;
board.addChild(frog);

printTree(app.stage);

console.log('Лягушка в локальных координатах:', frog.x, frog.y);
const frogGlobal = frog.getGlobalPosition();
console.log('Лягушка в глобальных координатах:', frogGlobal.x, frogGlobal.y);

const corner = board.toLocal({ x: 0, y: 0 });
console.log('Угол экрана в координатах board:', corner.x, corner.y);
