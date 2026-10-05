import { Application, Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { showStats } from './debug';
import { ASSETS_BASE_PATH, MANIFEST_URL } from './manifest';

/*
 * Лаборатория: большой мир из зелий, над которым летает камера.
 * В нашей игре слишком мало объектов, чтобы увидеть разницу в скорости, поэтому на четыре шага
 * игра откладывается: её файлы на месте, но main.ts запускает лабораторию. Вернёмся к игре в шаге 16.7
 */
// TODO: подключить плагин отсечения CullerPlugin (до app.init)
const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;
showStats(app, () => `видно кусков ${chunks.filter((chunk) => !chunk.culled).length} из ${chunks.length}`);

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
/** Мир разбит на куски 500 × 500: 8 × 8 = 64 куска по ~300 зелий */
const CHUNK_SIZE = 500;
const CHUNKS_PER_SIDE = WORLD_SIZE / CHUNK_SIZE;
/** Зелья у края куска выступают за его границу на полкартинки: 113 × 0,3 / 2 ≈ 17 пикселей */
const CHUNK_MARGIN = 20;
/** Скорость вращения зелий, радиан в секунду */
const SPIN_SPEED = 1;

const world = new Container({ isRenderGroup: true });
app.stage.addChild(world);

const chunks: Container[] = [];
for (let row = 0; row < CHUNKS_PER_SIDE; row++) {
  for (let column = 0; column < CHUNKS_PER_SIDE; column++) {
    const chunk = new Container();
    chunk.position.set(column * CHUNK_SIZE, row * CHUNK_SIZE);
  // TODO: разрешить отсекать кусок целиком по прямоугольнику cullArea, не заглядывая внутрь
    world.addChild(chunk);
    chunks.push(chunk);
  }
}

for (let i = 0; i < POTION_COUNT; i++) {
  const potion = new Sprite(Texture.from(POTIONS[i % POTIONS.length]));
  potion.anchor.set(0.5);
  potion.scale.set(POTION_SCALE);
  potion.rotation = Math.random() * Math.PI * 2;
  // Зелье попадает в кусок, в который упала его точка, и хранит позицию относительно куска
  const { x, y } = randomPosition();
  const chunk = chunks[Math.floor(y / CHUNK_SIZE) * CHUNKS_PER_SIDE + Math.floor(x / CHUNK_SIZE)];
  potion.position.set(x - chunk.x, y - chunk.y);
  chunk.addChild(potion);
}

// Камера облетает мир по кругу. Двигается только контейнер мира, зелья внутри него стоят на месте
let time = 0;
app.ticker.add((ticker) => {
  time += ticker.deltaMS / 1000;
  // Зелья вращаются: теперь каждый кадр меняется каждое из 20 000 зелий
  for (const chunk of chunks) {
    for (const potion of chunk.children) potion.rotation += SPIN_SPEED * ticker.deltaMS / 1000;
  }
  world.x = app.screen.width / 2 - WORLD_SIZE / 2 - Math.cos(time * 0.3) * CAMERA_RADIUS;
  world.y = app.screen.height / 2 - WORLD_SIZE / 2 - Math.sin(time * 0.3) * CAMERA_RADIUS;
});
