import { Application, Assets, Sprite, Texture } from 'pixi.js';

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

const PIECES = ['dragon', 'frog', 'newt', 'snake', 'spider', 'yeti'];
const SIZE = 60;
const GAP = 16;

const urls = PIECES.map((name) => `/assets/game/piece-${name}.png`);
const textures = await Assets.load<Texture>(urls);

// TODO: выведите шесть зелий в ряд по центру экрана (см. задание)
console.log('Загружено текстур:', Object.keys(textures).length);
