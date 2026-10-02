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

// Ширина всего ряда: шесть зелий и пять промежутков между ними
const rowWidth = PIECES.length * SIZE + (PIECES.length - 1) * GAP;
const startX = (app.screen.width - rowWidth) / 2 + SIZE / 2;

const potions = urls.map((url, index) => {
  const potion = new Sprite(textures[url]);
  potion.anchor.set(0.5);
  potion.setSize(SIZE);
  potion.position.set(startX + index * (SIZE + GAP), app.screen.height / 2);
  app.stage.addChild(potion);
  return potion;
});

const [dragon, frog, newt, snake, spider, yeti] = potions;

dragon.angle = 15; // 1. повёрнут на 15°
frog.alpha = 0.4; // 2. полупрозрачный
newt.tint = 0x66ccff; // 3. тонирован в голубой
snake.scale.x *= -1; // 4. отражён по горизонтали
spider.scale.set(spider.scale.x * 1.3); // 5. на 30% больше остальных

// 6. вращается
app.ticker.add((ticker) => {
  yeti.rotation += 0.03 * ticker.deltaTime;
});
