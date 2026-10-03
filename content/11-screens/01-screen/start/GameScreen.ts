import gsap from 'gsap';
import { Container, HTMLText, NineSliceSprite, Texture, Ticker } from 'pixi.js';
import { app } from './app';
import { Board, BOARD_HEIGHT, BOARD_WIDTH } from './Board';
import { Button } from './Button';
import { playCountdown } from './countdown';
import { gridToString, type Position } from './grid';
import { Hud, HUD_HEIGHT } from './Hud';
import { Label } from './Label';
import { FONT_FAMILY } from './manifest';
import type { AppScreen } from './navigation';
import { SettingsPanel } from './SettingsPanel';

/** Длительность игры в миллисекундах */
const GAME_TIME = 60_000;
/** Очков за одну фишку в совпадении */
const POINTS_PER_PIECE = 10;
/** Отступ подсказки от краёв экрана */
const MARGIN = 16;
/** Высота полосы под полем */
const BOTTOM_BAR = 80;
/** Поле с рамкой и небольшим запасом */
const BOARD_AREA_WIDTH = BOARD_WIDTH + 40;
const BOARD_AREA_HEIGHT = BOARD_HEIGHT + 40;
/** Больше этого поле не увеличиваем: на огромном мониторе фишки стали бы гигантскими */
const MAX_BOARD_SCALE = 1.5;

/**
 * Экран игры: поле, интерфейс, подсказка, очки и время.
 * Раньше всё это жило в main.ts. Упрощённая версия GameScreen из Puzzling Potions
 */
export class GameScreen extends Container implements AppScreen {
  private readonly board: Board;
  private readonly hud: Hud;
  private readonly hintText: HTMLText;
  private readonly settingsPanel: SettingsPanel;
  /** Стартовая панель живёт, пока не нажали «Играть» */
  private startPanel?: Container;
  private score = 0;
  private remaining = GAME_TIME;

  constructor() {
    super();

    this.board = new Board(app.ticker);
    this.addChild(this.board);
    console.log('Сетка при запуске:\n' + gridToString(this.board.grid));

    // Интерфейс над полем: решения о паузе и настройках принимает экран
    this.hud = new Hud();
    this.hud.label = 'hud';
    this.hud.setTime(this.remaining);
    this.addChild(this.hud);
    this.hud.onPause = () => {
      this.board.locked = !this.board.locked;
      this.board.alpha = this.board.locked ? 0.5 : 1;
    };
    this.hud.onSettings = () => {
      this.settingsPanel.visible = true;
      this.board.locked = true;
      this.board.alpha = 0.5;
    };

    this.board.onMatch = (matches, round) => {
      for (const match of matches) {
        // Каждый следующий раунд каскада умножает очки: ×2, ×3…
        const points = match.length * POINTS_PER_PIECE * round;
        this.score += points;
        this.showPoints(match, points);
      }
      if (round > 1) this.showCombo(round);
      this.hud.setScore(this.score);
    };

    // HTMLText понимает разметку: жирный шрифт и цвет отдельных слов
    this.hintText = new HTMLText({
      text: 'Меняйте местами <b>соседние</b> зелья. <span style="color: #c2185b">Три одинаковых в ряд</span> исчезают и приносят очки.',
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 15,
        fill: 0x3b1d70,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: BOARD_WIDTH,
        lineHeight: 20,
      },
    });
    this.hintText.anchor.set(0.5);
    this.addChild(this.hintText);

    this.settingsPanel = new SettingsPanel();
    this.settingsPanel.label = 'settingsPanel';
    this.settingsPanel.visible = false;
    this.addChild(this.settingsPanel);
    this.settingsPanel.onSpeedChange = (speed) => {
      app.ticker.speed = speed;
      gsap.globalTimeline.timeScale(speed);
    };
    this.settingsPanel.onHintChange = (visible) => (this.hintText.visible = visible);
    this.settingsPanel.onClose = () => {
      this.settingsPanel.visible = false;
      this.board.locked = false;
      this.board.alpha = 1;
    };

    // До начала игры поле заблокировано и полупрозрачно
    this.board.locked = true;
    this.board.alpha = 0.5;
  }

  // TODO: show() — стартовая панель, отсчёт и начало игры; update(ticker) — время игры


  resize(width: number, height: number) {
    this.hud.resize(width);
    this.hintText.style.wordWrapWidth = Math.min(width - MARGIN * 2, 420);
    this.hintText.position.set(width / 2, height - BOTTOM_BAR / 2);
    this.settingsPanel.position.set(width / 2, height / 2);

    // Поле — по центру свободного места, с масштабом «вписать»
    const freeHeight = height - HUD_HEIGHT - BOTTOM_BAR;
    const scale = Math.min(width / BOARD_AREA_WIDTH, freeHeight / BOARD_AREA_HEIGHT, MAX_BOARD_SCALE);
    this.board.scale.set(scale);
    this.board.position.set(width / 2, HUD_HEIGHT + freeHeight / 2);
    this.startPanel?.position.copyFrom(this.board.position);
  }

  /** Стартовая панель из главы 10: промис выполняется, когда нажали «Играть» */
  private async waitForPlay() {
    const panel = new Container();
    panel.label = 'startPanel';
    panel.position.copyFrom(this.board.position);
    const slices = { leftWidth: 34, topHeight: 34, rightWidth: 34, bottomHeight: 34 };
    const texture = Texture.from('rounded-rectangle');
    const shadow = new NineSliceSprite({ texture, ...slices, width: 330, height: 300, anchor: 0.5, tint: 0x0a0025 });
    shadow.y = 14;
    const box = new NineSliceSprite({ texture, ...slices, width: 330, height: 300, anchor: 0.5, tint: 0x2c136c });
    const title = new Label('Puzzling Potions', { fontSize: 36, fill: 0xffd27f });
    title.y = -95;
    const subtitle = new Label('Собери три зелья в ряд!', { fontSize: 20 });
    subtitle.y = -45;
    const playButton = new Button({ text: 'Играть' });
    playButton.label = 'playButton';
    playButton.y = 60;
    panel.addChild(shadow, box, title, subtitle, playButton);
    this.addChild(panel);
    this.startPanel = panel;

    await new Promise<void>((resolve) => (playButton.onPress = resolve));
    this.startPanel = undefined;
    panel.destroy({ children: true });
  }

  /** «+30» взлетает из центра совпадения и тает */
  private async showPoints(match: Position[], points: number) {
    const label = new Label(`+${points}`, { fontSize: 24, fill: 0xffd27f });
    // Центр совпадения — среднее положение его клеток, в координатах поля
    const views = match.map((position) => this.board.getViewPosition(position));
    label.x = views.reduce((sum, view) => sum + view.x, 0) / views.length;
    label.y = views.reduce((sum, view) => sum + view.y, 0) / views.length;
    this.board.addChild(label);
    gsap.to(label, { alpha: 0, duration: 0.4, delay: 0.5 });
    await gsap.to(label, { y: label.y - 50, duration: 0.9, ease: 'quad.out' });
    label.destroy();
  }

  /** «Комбо ×2» выпрыгивает в центре поля */
  private async showCombo(round: number) {
    const label = new Label(`Комбо ×${round}`, { fontSize: 44, fill: 0xffd27f });
    this.board.addChild(label);
    gsap.fromTo(label.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out' });
    await gsap.to(label, { alpha: 0, duration: 0.3, delay: 0.8 });
    gsap.killTweensOf(label.scale);
    label.destroy();
  }
}
