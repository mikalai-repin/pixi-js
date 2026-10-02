// Это демо: просто посмотрите, что получится. Разбирать код не нужно —
// к концу второй главы вы будете понимать каждую строку.
import { Application, Assets, Sprite, Texture } from 'pixi.js';

const COUNT = 60;
const PIECES = ['dragon', 'frog', 'newt', 'snake', 'spider', 'yeti'];

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);

const urls = PIECES.map((name) => `/assets/game/piece-${name}.png`);
const textures: Record<string, Texture> = await Assets.load(urls);

interface Potion {
  sprite: Sprite;
  speedX: number;
  speedY: number;
  spin: number;
}

const potions: Potion[] = [];

for (let i = 0; i < COUNT; i++) {
  const sprite = new Sprite(textures[urls[i % urls.length]]);
  sprite.anchor.set(0.5);
  sprite.scale.set(0.3 + Math.random() * 0.4);
  sprite.position.set(Math.random() * app.screen.width, Math.random() * app.screen.height);
  app.stage.addChild(sprite);

  potions.push({
    sprite,
    speedX: (Math.random() - 0.5) * 6,
    speedY: (Math.random() - 0.5) * 6,
    spin: (Math.random() - 0.5) * 0.1,
  });
}

app.ticker.add((ticker) => {
  for (const potion of potions) {
    const { sprite } = potion;
    sprite.x += potion.speedX * ticker.deltaTime;
    sprite.y += potion.speedY * ticker.deltaTime;
    sprite.rotation += potion.spin * ticker.deltaTime;

    // Отскок от краёв экрана
    if (sprite.x < 0 || sprite.x > app.screen.width) potion.speedX *= -1;
    if (sprite.y < 0 || sprite.y > app.screen.height) potion.speedY *= -1;
  }
});
