import gsap from 'gsap';
import { Container, HTMLText, Ticker } from 'pixi.js';
import { app } from './app';
import { Board, BOARD_HEIGHT, BOARD_WIDTH } from './Board';
import { playCountdown } from './countdown';
import { GameEffects } from './GameEffects';
import { gridToString, type Position } from './grid';
import { Hud, HUD_HEIGHT } from './Hud';
import { Label } from './Label';
import { FONT_FAMILY } from './manifest';
import { navigation, type AppScreen } from './navigation';
import { PausePopup } from './PausePopup';
import { SettingsPopup } from './SettingsPopup';
import { saveScore } from './stats';
import { userSettings } from './userSettings';

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
  /** Ресурсы экрана: фишки в game, кнопки и иконки в common */
  static assetBundles = ['game', 'common'];

  /** Поле и интерфейс открыты для чтения: к ним обращаются эффекты */
  readonly board: Board;
  readonly hud: Hud;
  private readonly hintText: HTMLText;
  /** Слой эффектов (vfx — visual effects), поверх поля и интерфейса */
  private readonly vfx: GameEffects;
  private score = 0;
  private remaining = GAME_TIME;
  /** Время вышло: ждём конца каскада, чтобы перейти к результату */
  private timeUp = false;
  private finished = false;
  /** Игра на паузе: время стоит, анимации заморожены */
  private paused = false;
  /** Твины, которые шли в момент паузы: gsap.exportRoot собирает их в одну временную шкалу */
  private pausedTweens?: gsap.core.Timeline;

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
    this.hud.onPause = () => navigation.presentPopup(PausePopup);
    this.hud.onSettings = () => navigation.presentPopup(SettingsPopup);

    this.board.onMatch = (matches, round) => {
      for (const match of matches) {
        // Каждый следующий раунд каскада умножает очки: ×2, ×3…
        const points = match.length * POINTS_PER_PIECE * round;
        this.score += points;
        this.showPoints(match, points);
      }
      if (round > 1) this.showCombo(round);
      this.vfx.onMatch(round);
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
    this.hintText.visible = userSettings.hint;
    this.addChild(this.hintText);

    // Эффекты — последним слоем, поверх поля и интерфейса
    this.vfx = new GameEffects(this);
    this.addChild(this.vfx);
    this.board.onPop = (piece) => this.vfx.onPop(piece);

    // До начала игры поле заблокировано и полупрозрачно
    this.board.locked = true;
    this.board.alpha = 0.5;
  }

  /** Появление экрана: отсчёт, затем игра */
  async show() {
    await playCountdown(this, this.board.x, this.board.y);
    this.board.locked = false;
    this.board.alpha = 1;
    this.hud.buttonsVisible = true;
  }

  /** Исчезновение: поле уменьшается и гаснет */
  async hide() {
    gsap.to(this.board.scale, { x: 0, y: 0, duration: 0.4, ease: 'back.in' });
    await gsap.to(this, { alpha: 0, duration: 0.4 });
  }

  /** Каждый кадр: время игры, а когда оно вышло — ждём конца каскада */
  update(ticker: Ticker) {
    if (this.timeUp) {
      if (!this.board.isProcessing) this.finish();
      return;
    }
    // Время идёт, только пока поле доступно: на отсчёте и паузе таймер стоит
    if (this.board.locked || this.paused) return;
    this.remaining = Math.max(0, this.remaining - ticker.deltaMS);
    this.hud.setTime(this.remaining);
    if (this.remaining === 0) this.onTimeUp();
  }

  /** Время вышло: ходы больше не принимаются, но начатый каскад доигрывает */
  private onTimeUp() {
    this.timeUp = true;
    this.board.locked = true;
    this.hud.buttonsVisible = false;
    const message = new Label('Время вышло!', { fontSize: 48, fill: 0xffd27f });
    message.position.copyFrom(this.board.position);
    this.addChild(message);
    gsap.from(message.scale, { x: 0, y: 0, duration: 0.4, ease: 'back.out' });
  }

  /** Каскад закончился: сохраняем счёт и через секунду показываем результат */
  private async finish() {
    if (this.finished) return;
    this.finished = true;
    saveScore(this.score);
    await gsap.to({}, { duration: 1 });
    navigation.showScreen('result');
  }

  /** Поверх экрана открылся попап: замораживаем анимации и время */
  pause() {
    this.paused = true;
    // Все твины, что идут сейчас, переезжают в одну шкалу, и её можно остановить разом.
    // Твины, созданные после этого (анимация попапа), идут как обычно
    this.pausedTweens = gsap.exportRoot();
    this.pausedTweens.pause();
  }

  /** Попап закрылся: продолжаем с того же места и применяем настройки */
  resume() {
    this.paused = false;
    this.pausedTweens?.resume();
    this.pausedTweens = undefined;
    this.hintText.visible = userSettings.hint;
  }

  /** Вкладка ушла в фон: если игра идёт и попапа нет, ставим паузу, как оригинал */
  blur() {
    const playing = !this.board.locked && !this.timeUp;
    if (playing && !navigation.currentPopup) navigation.presentPopup(PausePopup);
  }

  resize(width: number, height: number) {
    this.hud.resize(width);
    this.hintText.style.wordWrapWidth = Math.min(width - MARGIN * 2, 420);
    this.hintText.position.set(width / 2, height - BOTTOM_BAR / 2);

    // Поле — по центру свободного места, с масштабом «вписать»
    const freeHeight = height - HUD_HEIGHT - BOTTOM_BAR;
    const scale = Math.min(width / BOARD_AREA_WIDTH, freeHeight / BOARD_AREA_HEIGHT, MAX_BOARD_SCALE);
    this.board.scale.set(scale);
    this.board.position.set(width / 2, HUD_HEIGHT + freeHeight / 2);
    // Слой эффектов — в масштабе поля: эффекты получаются того же размера, что и фишки
    this.vfx.scale.copyFrom(this.board.scale);
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
