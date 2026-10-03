import gsap from 'gsap';
import { Application, Assets, Container, HTMLText, NineSliceSprite, Texture } from 'pixi.js';
import { Background } from './Background';
import { Board, BOARD_HEIGHT, BOARD_WIDTH } from './Board';
import { Button } from './Button';
import { playCountdown } from './countdown';
import { SettingsPanel } from './SettingsPanel';
import { gridToString, type Position } from './grid';
import { Hud, HUD_HEIGHT } from './Hud';
import { Label } from './Label';
import { LoadScreen } from './LoadScreen';
import { ASSETS_BASE_PATH, FONT_FAMILY, FONT_URL, MANIFEST_URL } from './manifest';

const app = new Application();
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

// Фон под всеми остальными объектами: добавляем его на сцену первым
const background = new Background(app.ticker);
background.resize(app.screen.width, app.screen.height);
app.stage.addChild(background);
// Рендерер сообщает о смене размера экрана событием resize
app.renderer.on('resize', (width, height) => background.resize(width, height));

const loadScreen = new LoadScreen(app.ticker);
loadScreen.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(loadScreen);

// Бандл common с кнопками и иконками нужен сразу: грузим его вместе с game
await Assets.loadBundle(['game', 'common'], (progress) => loadScreen.setProgress(progress));
loadScreen.destroy({ children: true });
Assets.backgroundLoadBundle(['home', 'result']);

// --- Поле ---
const board = new Board(app.ticker);
app.stage.addChild(board);
console.log('Сетка при запуске:\n' + gridToString(board.grid));

// --- Интерфейс над полем: таймер, счёт и кнопки ---
const hud = new Hud();
hud.label = 'hud';
app.stage.addChild(hud);

let score = 0;

/** Очков за одну фишку в совпадении */
const POINTS_PER_PIECE = 10;

board.onMatch = (matches, round) => {
  for (const match of matches) {
    // Каждый следующий раунд каскада умножает очки: ×2, ×3…
    const points = match.length * POINTS_PER_PIECE * round;
    score += points;
    showPoints(match, points);
  }
  if (round > 1) showCombo(round);
  hud.setScore(score);
};

/** «+30» взлетает из центра совпадения и тает */
async function showPoints(match: Position[], points: number) {
  const label = new Label(`+${points}`, { fontSize: 24, fill: 0xffd27f });
  // Центр совпадения — среднее положение его клеток, в координатах поля
  const views = match.map((position) => board.getViewPosition(position));
  label.x = views.reduce((sum, view) => sum + view.x, 0) / views.length;
  label.y = views.reduce((sum, view) => sum + view.y, 0) / views.length;
  board.addChild(label);
  gsap.to(label, { alpha: 0, duration: 0.4, delay: 0.5 });
  await gsap.to(label, { y: label.y - 50, duration: 0.9, ease: 'quad.out' });
  label.destroy();
}

/** «Комбо ×2» выпрыгивает в центре поля */
async function showCombo(round: number) {
  const label = new Label(`Комбо ×${round}`, { fontSize: 44, fill: 0xffd27f });
  board.addChild(label);
  gsap.fromTo(label.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out' });
  await gsap.to(label, { alpha: 0, duration: 0.3, delay: 0.8 });
  gsap.killTweensOf(label.scale);
  label.destroy();
}

// --- Время игры ---
/** Длительность игры в миллисекундах */
const GAME_TIME = 60_000;

let remaining = GAME_TIME;
hud.setTime(remaining);
app.ticker.add((ticker) => {
  // Время идёт, только пока поле доступно: на старте, отсчёте и паузе таймер стоит
  if (board.locked || remaining === 0) return;
  remaining = Math.max(0, remaining - ticker.deltaMS);
  hud.setTime(remaining);
});

// --- Подсказка под полем ---
// HTMLText понимает разметку: жирный шрифт и цвет отдельных слов
const hintText = new HTMLText({
  text: 'Меняйте местами <b>соседние</b> зелья. <span style="color: #c2185b">Три одинаковых в ряд</span> исчезают и приносят очки.',
  style: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    // Подсказка лежит на светлом фоне, поэтому тёмная
    fill: 0x3b1d70,
    align: 'center',
    // Переносим строки, чтобы подсказка не была шире поля
    wordWrap: true,
    wordWrapWidth: BOARD_WIDTH,
    lineHeight: 20,
  },
});
hintText.anchor.set(0.5);
app.stage.addChild(hintText);

// --- Пауза и настройки: кнопки в интерфейсе, а решения принимаем здесь ---
hud.onPause = () => {
  board.locked = !board.locked;
  board.alpha = board.locked ? 0.5 : 1;
};

const settingsPanel = new SettingsPanel();
settingsPanel.label = 'settingsPanel';
settingsPanel.visible = false;
app.stage.addChild(settingsPanel);

settingsPanel.onSpeedChange = (speed) => {
  // Замедляем и тикер приложения, и GSAP — как отладочная клавиша 3 в главе 8
  app.ticker.speed = speed;
  gsap.globalTimeline.timeScale(speed);
};
settingsPanel.onHintChange = (visible) => (hintText.visible = visible);

hud.onSettings = () => {
  settingsPanel.visible = true;
  board.locked = true;
  board.alpha = 0.5;
};
settingsPanel.onClose = () => {
  settingsPanel.visible = false;
  board.locked = false;
  board.alpha = 1;
};

// --- Раскладка: интерфейс у краёв экрана, поле — в свободном месте между ними ---
/** Отступ подсказки от краёв экрана */
const MARGIN = 16;
/** Высота полосы под полем */
const BOTTOM_BAR = 80;
/** Поле с рамкой и небольшим запасом */
const BOARD_AREA_WIDTH = BOARD_WIDTH + 40;
const BOARD_AREA_HEIGHT = BOARD_HEIGHT + 40;
/** Больше этого поле не увеличиваем: на огромном мониторе фишки стали бы гигантскими */
const MAX_BOARD_SCALE = 1.5;

function layout(width: number, height: number) {
  // Верхняя полоса — интерфейс, он сам расставляет свои элементы
  hud.resize(width);
  settingsPanel.position.set(width / 2, height / 2);

  // Нижняя полоса: подсказка по центру, переносы по ширине экрана
  hintText.style.wordWrapWidth = Math.min(width - MARGIN * 2, 420);
  hintText.position.set(width / 2, height - BOTTOM_BAR / 2);

  // Поле — по центру свободного места, с масштабом «вписать»
  const freeHeight = height - HUD_HEIGHT - BOTTOM_BAR;
  const scale = Math.min(width / BOARD_AREA_WIDTH, freeHeight / BOARD_AREA_HEIGHT, MAX_BOARD_SCALE);
  board.scale.set(scale);
  board.position.set(width / 2, HUD_HEIGHT + freeHeight / 2);
}
app.renderer.on('resize', layout);
layout(app.screen.width, app.screen.height);

// --- Кнопка «Играть»: спрайт с тремя состояниями ---
// До начала игры поле заблокировано и полупрозрачно
board.locked = true;
board.alpha = 0.5;

// --- Стартовая панель: растягиваемая картинка со скруглёнными углами ---
const startPanel = new Container();
startPanel.label = 'startPanel';
app.stage.addChild(startPanel);
// Панель живёт недолго, поэтому у неё свой слушатель resize, от которого она отпишется
const placeStartPanel = () => startPanel.position.copyFrom(board.position);
app.renderer.on('resize', placeStartPanel);
placeStartPanel();

/** Углы картинки rounded-rectangle: эти 34 пикселя с каждого края не растягиваются */
const PANEL_SLICES = { leftWidth: 34, topHeight: 34, rightWidth: 34, bottomHeight: 34 };
const panelTexture = Texture.from('rounded-rectangle');
const panelShadow = new NineSliceSprite({ texture: panelTexture, ...PANEL_SLICES, width: 330, height: 300, anchor: 0.5, tint: 0x0a0025 });
panelShadow.y = 14;
const panelBox = new NineSliceSprite({ texture: panelTexture, ...PANEL_SLICES, width: 330, height: 300, anchor: 0.5, tint: 0x2c136c });
const title = new Label('Puzzling Potions', { fontSize: 36, fill: 0xffd27f });
title.y = -95;
const subtitle = new Label('Собери три зелья в ряд!', { fontSize: 20 });
subtitle.y = -45;
startPanel.addChild(panelShadow, panelBox, title, subtitle);

const playButton = new Button({ text: 'Играть' });
playButton.label = 'playButton';
playButton.y = 60;
startPanel.addChild(playButton);

// Ждём нажатия: промис выполнится, когда кнопка вызовет onPress
await new Promise<void>((resolve) => (playButton.onPress = resolve));
app.renderer.off('resize', placeStartPanel);
startPanel.destroy({ children: true });

// --- Обратный отсчёт: пока он идёт, поле заблокировано ---
await playCountdown(app.stage, board.x, board.y);
board.locked = false;
board.alpha = 1;
hud.buttonsVisible = true;
