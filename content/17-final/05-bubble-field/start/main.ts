// Импорт ради побочного эффекта: @pixi/sound регистрирует в Assets загрузчик звуков из манифеста
import '@pixi/sound';
import { Application, Assets, TilingSprite, Texture } from 'pixi.js';
import { BubbleGame, GAME_HEIGHT, GAME_WIDTH } from './BubbleGame';
import { ASSETS_BASE_PATH, FONT_FAMILY, FONT_URL, MANIFEST_URL } from './manifest';

/** Запас по краям экрана вокруг игры */
const MARGIN = 10;

const app = new Application();
await app.init({
  background: '#1b1530',
  antialias: true,
  // Canvas занимает всё окно и сам следит за его размером
  resizeTo: window,
  resolution: Math.max(window.devicePixelRatio, 2),
  autoDensity: true,
});
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

await Assets.init({ manifest: MANIFEST_URL, basePath: ASSETS_BASE_PATH });
await Assets.load({ src: FONT_URL, data: { family: FONT_FAMILY } });
await Assets.loadBundle('bubbo');

// Фон — плитка во весь экран
const background = new TilingSprite({ texture: Texture.from('background-tile'), tileScale: { x: 2, y: 2 } });
background.tint = 0x6a5acd;
const game = new BubbleGame();
app.stage.addChild(background, game);

/** Игра — по центру окна, в масштабе «вписать» */
function layout() {
  const { width, height } = app.screen;
  background.setSize(width, height);
  const scale = Math.min((width - MARGIN * 2) / GAME_WIDTH, (height - MARGIN * 2) / GAME_HEIGHT);
  game.scale.set(scale);
  game.position.set((width - GAME_WIDTH * scale) / 2, (height - GAME_HEIGHT * scale) / 2);
}
app.renderer.on('resize', layout);
layout();

app.ticker.add((ticker) => game.update(ticker));
