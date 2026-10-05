import { sound } from '@pixi/sound';
import { Assets } from 'pixi.js';
import { app } from './app';
import { bgm, sfx } from './audio';
import { Background } from './Background';
import { GameScreen } from './GameScreen';
import { HomeScreen } from './HomeScreen';
import { LoadScreen } from './LoadScreen';
import { navigation } from './navigation';
import { ResultScreen } from './ResultScreen';
import { ASSETS_BASE_PATH, FONT_FAMILY, FONT_URL, MANIFEST_URL } from './manifest';
import { showStats } from './debug';
import { userSettings } from './userSettings';

await app.init({
  background: '#1e1035',
  antialias: true,
  // Рисуем с плотностью экрана, но не меньше 2: на обычных мониторах так чётче масштабированная сцена
  resolution: Math.max(window.devicePixelRatio, 2),
  // Какой рендерер попробовать первым. Если он недоступен, PixiJS возьмёт следующий по списку
  preference: 'webgl',
});
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;
console.log(`Рендерер: ${app.renderer.name}`);
// Панель статистики из главы 16. Включайте, когда проверяете производительность
// showStats(app);

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

// Громкость из сохранённых настроек — до того, как прозвучит первый звук
bgm.setVolume(userSettings.music);
sfx.setVolume(userSettings.sfx);

// Фон под всеми экранами: добавляем его на сцену первым
const background = new Background(app.ticker);
background.resize(app.screen.width, app.screen.height);
app.stage.addChild(background);
app.renderer.on('resize', (width, height) => background.resize(width, height));

// --- Экраны: дальше всем управляет навигация ---
// Экраны регистрируются здесь, в одном месте: сами экраны друг друга не импортируют
navigation.register('home', HomeScreen);
navigation.register('game', GameScreen);
navigation.register('result', ResultScreen);
app.renderer.on('resize', (width, height) => navigation.resize(width, height));
navigation.resize(app.screen.width, app.screen.height);
// Пока грузятся бандлы следующего экрана, навигация покажет экран загрузки
navigation.loadScreen = LoadScreen;
await navigation.showScreen('home');
// Пока игрок в меню, заранее грузим остальное: тогда экран загрузки больше не понадобится
navigation.preload(['game', 'result']);

// --- Вкладка в фоне: звук замолкает, а экран игры ставит паузу ---
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sound.pauseAll();
    navigation.blur();
  } else {
    sound.resumeAll();
    navigation.focus();
  }
});
