import { Application, Assets, Sprite, Texture } from 'pixi.js';

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

const texture = await Assets.load<Texture>('/assets/game/piece-dragon.png');
console.log('Текстура:', texture.width, '×', texture.height);

const dragon = new Sprite(texture);
dragon.anchor.set(0.5);
dragon.setSize(100);
dragon.position.set(app.screen.width / 2, app.screen.height / 2);
dragon.alpha = 0.9;
dragon.tint = '#ffd9a0';
app.stage.addChild(dragon);

console.log('Масштаб:', dragon.scale.x, dragon.scale.y);

// Лягушка вращается вокруг дракона
const frogTexture = await Assets.load<Texture>('/assets/game/piece-frog.png');
const frog = new Sprite(frogTexture);
frog.anchor.set(0.5);
frog.setSize(60);
frog.position.copyFrom(dragon.position);
// pivot задаётся в локальных координатах лягушки, до масштабирования
frog.pivot.set(0, 300);
app.stage.addChild(frog);

// Вращение: 0.02 радиана за кадр (при 60 FPS)
app.ticker.add((ticker) => {
  dragon.rotation += 0.02 * ticker.deltaTime;
  frog.rotation -= 0.01 * ticker.deltaTime;
});
