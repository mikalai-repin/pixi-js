import gsap from 'gsap';
import { Application, Assets, BitmapFont, BitmapText, Container, HTMLText, NineSliceSprite, Texture } from 'pixi.js';
import { Background } from './Background';
import { Board, BOARD_HEIGHT, BOARD_WIDTH } from './Board';
import { Button } from './Button';
import { playCountdown } from './countdown';
import { gridToString, type Position } from './grid';
import { Label } from './Label';
import { LoadScreen } from './LoadScreen';
import { ASSETS_BASE_PATH, FONT_FAMILY, FONT_URL, MANIFEST_URL } from './manifest';

const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window, antialias: true });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app;

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
board.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(board);
console.log('Сетка при запуске:\n' + gridToString(board.grid));

// --- Отладка времени: щёлкните по превью и нажимайте 1, 2, 3 ---
window.addEventListener('keydown', (event) => {
  if (event.key === '1') {
    // Обычный режим
    app.ticker.maxFPS = 0;
    app.ticker.speed = 1;
    gsap.globalTimeline.timeScale(1);
  } else if (event.key === '2') {
    // Не больше 20 кадров в секунду: как на слабом телефоне
    app.ticker.maxFPS = 20;
  } else if (event.key === '3') {
    // Замедление в 4 раза. У GSAP свой тикер, и замедлять его нужно отдельно
    app.ticker.speed = 0.25;
    gsap.globalTimeline.timeScale(0.25);
  } else {
    return;
  }
  console.log(`maxFPS: ${app.ticker.maxFPS}, speed: ${app.ticker.speed}`);
});

// --- Счёт над полем ---
let score = 0;
const scoreText = new Label('Очки: 0', {
  // Тёмная тень отделяет счёт от любого фона
  dropShadow: { color: 0x000000, alpha: 0.4, blur: 2, distance: 3, angle: Math.PI / 2 },
});
// Текстура текста вдвое подробнее экрана: счёт будет увеличиваться и не должен размываться
scoreText.resolution = 2;
scoreText.position.set(board.x, board.y - BOARD_HEIGHT / 2 - 38);
app.stage.addChild(scoreText);

// Число на экране «догоняет» настоящий счёт, как в оригинале
const shownScore = { value: 0 };

function showScore() {
  gsap.killTweensOf(shownScore);
  gsap.to(shownScore, {
    value: score,
    duration: 0.6,
    ease: 'none',
    // Текст меняется каждый кадр, но только когда меняется целое число
    onUpdate: () => {
      scoreText.text = `Очки: ${Math.round(shownScore.value)}`;
    },
  });
  // Счёт «подпрыгивает», когда растёт
  gsap.fromTo(scoreText.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out' });
}

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
  showScore();
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

// --- Таймер слева над полем: BitmapText ---
/** Длительность игры в миллисекундах */
const GAME_TIME = 60_000;
/** За сколько миллисекунд до конца таймер начинает мигать */
const WARNING_TIME = 10_000;

// Растровый шрифт: все цифры и двоеточие рисуются один раз в общую текстуру
BitmapFont.install({
  name: 'TimerFont',
  style: { fontFamily: FONT_FAMILY, fontSize: 32, fill: 0xffffff, stroke: { color: 0x2c136c, width: 5 } },
  chars: [['0', '9'], ':'],
  resolution: 2,
});

const timerText = new BitmapText({ text: formatTime(GAME_TIME), style: { fontFamily: 'TimerFont', fontSize: 28 } });
timerText.anchor.set(0, 0.5);
timerText.position.set(board.x - BOARD_WIDTH / 2, scoreText.y);
app.stage.addChild(timerText);

let remaining = GAME_TIME;
app.ticker.add((ticker) => {
  // Время идёт, только пока поле доступно: на отсчёте и на паузе таймер стоит
  if (board.locked || remaining === 0) return;
  remaining = Math.max(0, remaining - ticker.deltaMS);
  timerText.text = formatTime(remaining);
  // В последние секунды мигаем красным: тонирование умножает цвета глифов, белый становится красным
  const blink = remaining > 0 && remaining < WARNING_TIME && Math.floor(remaining / 250) % 2 === 0;
  timerText.tint = blink ? 0xff5a5a : 0xffffff;
});

/** 59999 → «1:00», 9000 → «0:09». Округляем вверх, как настоящие таймеры */
function formatTime(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

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
hintText.position.set(board.x, board.y + BOARD_HEIGHT / 2 + 40);
app.stage.addChild(hintText);

// --- Кнопка «Играть»: спрайт с тремя состояниями ---
// До начала игры поле заблокировано и полупрозрачно
board.locked = true;
board.alpha = 0.5;

// --- Стартовая панель: растягиваемая картинка со скруглёнными углами ---
const startPanel = new Container();
startPanel.label = 'startPanel';
startPanel.position.copyFrom(board.position);
app.stage.addChild(startPanel);

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
startPanel.destroy({ children: true });

// --- Обратный отсчёт: пока он идёт, поле заблокировано ---
await playCountdown(app.stage, board.x, board.y);
board.locked = false;
board.alpha = 1;

// --- Пауза: кнопка из бандла common блокирует поле ---
const pauseButton = new Button({ size: 'small', icon: 'icon-pause' });
pauseButton.label = 'pauseButton';
// Якорь фона в центре, поэтому отступаем от угла на половину кнопки
pauseButton.position.set(app.screen.width - 16 - 67 / 2, 16 + 53 / 2);
app.stage.addChild(pauseButton);

pauseButton.onPress = () => {
  board.locked = !board.locked;
  board.alpha = board.locked ? 0.5 : 1;
};
