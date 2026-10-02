import { Application, Assets, Sprite, Texture } from 'pixi.js';

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

const texture = await Assets.load<Texture>('/assets/game/piece-dragon.png');
console.log('Текстура:', texture.width, '×', texture.height);

const dragon = new Sprite(texture);
dragon.anchor.set(0.5);
dragon.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(dragon);
