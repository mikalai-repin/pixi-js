import { Application, Assets, Container, Sprite, Texture } from 'pixi.js';
import { showStats } from './debug';
import { ASSETS_BASE_PATH, MANIFEST_URL } from './manifest';

/*
 * Лаборатория: большой мир из зелий, над которым летает камера.
 * В нашей игре слишком мало объектов, чтобы увидеть разницу в скорости, поэтому на четыре шага
 * игра откладывается: её файлы на месте, но main.ts запускает лабораторию. Вернёмся к игре в шаге 16.7
 */
const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;
showStats(app);

await Assets.init({ manifest: MANIFEST_URL, basePath: ASSETS_BASE_PATH });
await Assets.loadBundle('game');

const POTIONS = ['piece-dragon', 'piece-frog', 'piece-newt', 'piece-snake', 'piece-spider', 'piece-yeti'];
/** Сторона мира: он в восемь раз шире превью */
const WORLD_SIZE = 4000;
const POTION_COUNT = 20_000;
/** Радиус круга, по которому летит камера */
const CAMERA_RADIUS = 1500;
/** Зелья собраны в острова: так мир похож на карту, а между островами пусто */
const ISLAND_COUNT = 40;
const ISLAND_RADIUS = 300;
const POTION_SCALE = 0.3;

const islands = Array.from({ length: ISLAND_COUNT }, () => ({ x: Math.random() * WORLD_SIZE, y: Math.random() * WORLD_SIZE }));

/** Случайная точка на случайном острове. Острова у края мира обрезаются его границей */
function randomPosition() {
  const island = islands[Math.floor(Math.random() * ISLAND_COUNT)];
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * ISLAND_RADIUS;
  return {
    x: Math.min(Math.max(island.x + Math.cos(angle) * distance, 0), WORLD_SIZE - 1),
    y: Math.min(Math.max(island.y + Math.sin(angle) * distance, 0), WORLD_SIZE - 1),
  };
}

// Мир — контейнер, который мы двигаем, как камеру
// Рендер-группа: движение мира не пересчитывает ни одно зелье внутри него
const world = new Container({ isRenderGroup: true });
app.stage.addChild(world);

for (let i = 0; i < POTION_COUNT; i++) {
  const potion = new Sprite(Texture.from(POTIONS[i % POTIONS.length]));
  potion.anchor.set(0.5);
  potion.scale.set(POTION_SCALE);
  potion.rotation = Math.random() * Math.PI * 2;
  potion.position.copyFrom(randomPosition());
  world.addChild(potion);
}

// Камера облетает мир по кругу. Двигается только контейнер мира, зелья внутри него стоят на месте
let time = 0;
app.ticker.add((ticker) => {
  time += ticker.deltaMS / 1000;
  world.x = app.screen.width / 2 - WORLD_SIZE / 2 - Math.cos(time * 0.3) * CAMERA_RADIUS;
  world.y = app.screen.height / 2 - WORLD_SIZE / 2 - Math.sin(time * 0.3) * CAMERA_RADIUS;
});
