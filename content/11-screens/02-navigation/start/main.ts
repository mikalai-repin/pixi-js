import { Assets } from 'pixi.js';
import { app } from './app';
import { Background } from './Background';
import { GameScreen } from './GameScreen';
import { LoadScreen } from './LoadScreen';
import { ASSETS_BASE_PATH, FONT_FAMILY, FONT_URL, MANIFEST_URL } from './manifest';

await app.init({
  background: '#1e1035',
  antialias: true,
  // Рисуем с плотностью экрана, но не меньше 2: на обычных мониторах так чётче масштабированная сцена
  resolution: Math.max(window.devicePixelRatio, 2),
});
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

// --- Размер экрана: не меньше 375 × 700 логических пикселей, как в оригинале ---
const MIN_WIDTH = 375;
const MIN_HEIGHT = 700;

function resize() {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  // Если окно меньше минимума, сцена получает больше логических пикселей, а canvas сжимается до окна
  const scale = Math.max(MIN_WIDTH / windowWidth, MIN_HEIGHT / windowHeight, 1);
  app.canvas.style.width = `${windowWidth}px`;
  app.canvas.style.height = `${windowHeight}px`;
  // Рендерер меняет размер canvas и генерирует событие resize
  app.renderer.resize(windowWidth * scale, windowHeight * scale);
}
window.addEventListener('resize', resize);
resize();

// --- Загрузка ---
await Assets.init({ manifest: MANIFEST_URL, basePath: ASSETS_BASE_PATH });
// Шрифт загружаем до того, как создадим первый текст
await Assets.load({ src: FONT_URL, data: { family: FONT_FAMILY } });
await Assets.loadBundle('preload');

// Фон под всеми экранами: добавляем его на сцену первым
const background = new Background(app.ticker);
background.resize(app.screen.width, app.screen.height);
app.stage.addChild(background);
app.renderer.on('resize', (width, height) => background.resize(width, height));

const loadScreen = new LoadScreen();
loadScreen.resize(app.screen.width, app.screen.height);
app.stage.addChild(loadScreen);
app.ticker.add(loadScreen.update, loadScreen);

// Бандл common с кнопками и иконками нужен сразу: грузим его вместе с game
await Assets.loadBundle(['game', 'common'], (progress) => loadScreen.setProgress(progress));
app.ticker.remove(loadScreen.update, loadScreen);
loadScreen.destroy({ children: true });
Assets.backgroundLoadBundle(['home', 'result']);

// --- Экран игры: main.ts только создаёт его и проводит по жизненному циклу ---
const game = new GameScreen();
app.stage.addChild(game);
game.resize(app.screen.width, app.screen.height);
app.renderer.on('resize', (width, height) => game.resize(width, height));
app.ticker.add(game.update, game);
await game.show();
