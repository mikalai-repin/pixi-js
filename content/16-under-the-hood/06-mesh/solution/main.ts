import { Application, Assets, Mesh, MeshGeometry, type Texture } from 'pixi.js';
import { showStats } from './debug';
import { createWaveShader } from './wave';

/*
 * Лаборатория, часть 2: меш (Mesh) — объект, у которого мы сами задаём треугольники и шейдер.
 * Мир зелий из прошлых шагов больше не нужен: main.ts начинается заново
 */
const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;
showStats(app);

// Отдельный файл, а не кадр атласа: координаты текстуры 0…1 охватят ровно одно зелье
const texture: Texture = await Assets.load('/assets/game/piece-dragon.png');

/** На сколько полос делим картинку по каждой стороне */
const SEGMENTS = 10;

/**
 * Сетка из (segments + 1)² вершин: прямоугольник width × height с центром в (0, 0),
 * разбитый на segments × segments клеток, по два треугольника в каждой
 */
function createGridGeometry(width: number, height: number, segments: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= segments; row++) {
    for (let column = 0; column <= segments; column++) {
      const u = column / segments;
      const v = row / segments;
      // Где вершина стоит (в пикселях) и какую точку картинки она показывает (от 0 до 1)
      positions.push((u - 0.5) * width, (v - 0.5) * height);
      uvs.push(u, v);
    }
  }
  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      // Номера четырёх углов клетки в массиве вершин
      const topLeft = row * (segments + 1) + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + segments + 1;
      const bottomRight = bottomLeft + 1;
      indices.push(topLeft, topRight, bottomLeft, topRight, bottomRight, bottomLeft);
    }
  }
  return new MeshGeometry({
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  });
}

// Меш из сетки вершин с картинкой зелья
const geometry = createGridGeometry(texture.width, texture.height, SEGMENTS);
const shader = createWaveShader(texture);
const potion = new Mesh({ geometry, shader });
potion.position.set(app.screen.width / 2, app.screen.height / 2);
potion.scale.set(2);
app.stage.addChild(potion);

// Время волны — uniform шейдера: меняем его каждый кадр, геометрия при этом не трогается
app.ticker.add((ticker) => {
  shader.resources.waveUniforms.uniforms.uTime += ticker.deltaMS / 1000;
});
