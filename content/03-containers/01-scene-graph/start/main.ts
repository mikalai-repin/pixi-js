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

// TODO: создайте контейнер board и положите в него дракона и лягушку
