import { Application, Assets, Sprite, Texture } from 'pixi.js';
import { showStats } from './debug';

const app = new Application();
await app.init({
  background: '#1e1035',
  antialias: true,
  // Canvas занимает всё окно и сам следит за его размером
  resizeTo: window,
  resolution: Math.max(window.devicePixelRatio, 2),
  autoDensity: true,
  // Панель статистики из главы 16 умеет считать вызовы отрисовки только в WebGL
  preference: 'webgl',
});
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;
// Панель статистики: вызовы отрисовки, время кадра, текстуры
showStats(app);

// Ресурсы Puzzling Potions без звуков и Spine: для них нужны @pixi/sound и плагин Spine (главы 13 и 14).
// Ресурсы Bubbo Bubbo — в /assets/bubbo/manifest.json, шрифт Nunito — /assets/fonts/nunito-extrabold.woff2
await Assets.init({ manifest: '/assets/packed/manifest-basic.json', basePath: '/assets/packed' });
await Assets.loadBundle(['preload', 'game']);

// Ваша игра начинается здесь. Зелье в центре — просто чтобы было видно, что всё работает
const potion = new Sprite({ texture: Texture.from('piece-dragon'), anchor: 0.5 });
app.stage.addChild(potion);

app.ticker.add((ticker) => {
  potion.position.set(app.screen.width / 2, app.screen.height / 2);
  potion.rotation += 0.02 * ticker.deltaTime;
});
