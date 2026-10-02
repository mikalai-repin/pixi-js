import { Application } from 'pixi.js';

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

// TODO: загрузите текстуру зелья-дракона и выведите её размер в консоль
