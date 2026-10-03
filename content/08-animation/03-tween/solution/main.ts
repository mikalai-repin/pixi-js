import { Application, Assets, Sprite, Texture } from 'pixi.js';
import { Board } from './Board';
import { gridToString } from './grid';
import { LoadScreen } from './LoadScreen';
import { ASSETS_BASE_PATH, MANIFEST_URL } from './manifest';

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

// --- Загрузка ---
await Assets.init({ manifest: MANIFEST_URL, basePath: ASSETS_BASE_PATH });
await Assets.loadBundle('preload');

const loadScreen = new LoadScreen(app.ticker);
loadScreen.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(loadScreen);

await Assets.loadBundle('game', (progress) => loadScreen.setProgress(progress));
loadScreen.destroy({ children: true });
Assets.backgroundLoadBundle(['common', 'home', 'result']);

// --- Поле ---
const board = new Board(app.ticker);
board.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(board);
console.log('Сетка при запуске:\n' + gridToString(board.grid));

// --- Отладка времени: щёлкните по превью и нажимайте 1, 2, 3 ---
window.addEventListener('keydown', (event) => {
  if (event.key === '1') {
    // Обычный режим
    app.ticker.maxFPS = 0;
    app.ticker.speed = 1;
  } else if (event.key === '2') {
    // Не больше 20 кадров в секунду: как на слабом телефоне
    app.ticker.maxFPS = 20;
  } else if (event.key === '3') {
    // Замедление в 4 раза
    app.ticker.speed = 0.25;
  } else {
    return;
  }
  console.log(`maxFPS: ${app.ticker.maxFPS}, speed: ${app.ticker.speed}`);
});

// --- Пауза: кнопка из бандла common блокирует поле ---
await Assets.loadBundle('common');

const pauseButton = new Sprite(Texture.from('icon-pause'));
pauseButton.label = 'pauseButton';
pauseButton.anchor.set(1, 0);
pauseButton.position.set(app.screen.width - 16, 16);
pauseButton.eventMode = 'static';
pauseButton.cursor = 'pointer';
app.stage.addChild(pauseButton);

pauseButton.on('pointertap', () => {
  board.locked = !board.locked;
  board.alpha = board.locked ? 0.5 : 1;
});
