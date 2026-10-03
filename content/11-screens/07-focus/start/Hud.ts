import type { FancyButton } from '@pixi/ui';
import gsap from 'gsap';
import { BitmapFont, BitmapText, Container, type DestroyOptions } from 'pixi.js';
import { Button } from './Button';
import { Label } from './Label';
import { FONT_FAMILY } from './manifest';
import { createIconButton } from './SettingsPopup';

/** Высота полосы интерфейса над полем */
export const HUD_HEIGHT = 80;
/** Отступ от краёв экрана */
const MARGIN = 16;
/** Ширина маленькой кнопки */
const SMALL_BUTTON_WIDTH = 67;
/** За сколько миллисекунд до конца таймер начинает мигать */
const WARNING_TIME = 10_000;
/** Ширина счёта с запасом на четыре цифры: «Очки: 9999» */
const SCORE_MAX_WIDTH = 160;

/**
 * Интерфейс над полем: таймер слева, счёт по центру, кнопки настроек и паузы справа.
 * Сам ничего не решает: показывает переданные значения и сообщает о нажатиях колбэками.
 * Упрощённая версия GameScore, GameTimer и кнопок GameScreen из Puzzling Potions
 */
export class Hud extends Container {
  /** Нажата кнопка паузы */
  onPause?: () => void;
  /** Нажата кнопка настроек */
  onSettings?: () => void;

  private readonly timerText: BitmapText;
  private readonly scoreText: Label;
  private readonly pauseButton: Button;
  private readonly settingsButton: FancyButton;
  /** Число на экране «догоняет» настоящий счёт */
  private readonly shownScore = { value: 0 };

  constructor() {
    super();

    // Растровый шрифт: все цифры и двоеточие рисуются один раз в общую текстуру
    BitmapFont.install({
      name: 'TimerFont',
      style: { fontFamily: FONT_FAMILY, fontSize: 32, fill: 0xffffff, stroke: { color: 0x2c136c, width: 5 } },
      chars: [['0', '9'], ':'],
      resolution: 2,
    });
    this.timerText = new BitmapText({ text: '0:00', style: { fontFamily: 'TimerFont', fontSize: 28 } });
    this.timerText.anchor.set(0, 0.5);

    this.scoreText = new Label('Очки: 0', {
      // Тёмная тень отделяет счёт от любого фона
      dropShadow: { color: 0x000000, alpha: 0.4, blur: 2, distance: 3, angle: Math.PI / 2 },
    });
    // Текстура текста вдвое подробнее экрана: счёт будет увеличиваться и не должен размываться
    this.scoreText.resolution = 2;

    this.pauseButton = new Button({ size: 'small', icon: 'icon-pause' });
    this.pauseButton.label = 'pauseButton';
    this.pauseButton.onPress = () => this.onPause?.();

    this.settingsButton = createIconButton('icon-settings');
    this.settingsButton.label = 'settingsButton';
    this.settingsButton.onPress.connect(() => this.onSettings?.());

    this.addChild(this.timerText, this.scoreText, this.pauseButton, this.settingsButton);
    this.buttonsVisible = false;
  }

  /** Показывать ли кнопки: они нужны только во время игры */
  set buttonsVisible(value: boolean) {
    this.pauseButton.visible = value;
    this.settingsButton.visible = value;
  }

  /** Показывает оставшееся время, в последние секунды таймер мигает */
  setTime(ms: number) {
    this.timerText.text = formatTime(ms);
    // Тонирование умножает цвета глифов: белый становится красным
    const blink = ms > 0 && ms < WARNING_TIME && Math.floor(ms / 250) % 2 === 0;
    this.timerText.tint = blink ? 0xff5a5a : 0xffffff;
  }

  /** Показывает новый счёт: число набегает, надпись подпрыгивает */
  setScore(score: number) {
    gsap.killTweensOf(this.shownScore);
    gsap.to(this.shownScore, {
      value: score,
      duration: 0.6,
      ease: 'none',
      // Текст меняется каждый кадр, но только когда меняется целое число
      onUpdate: () => {
        this.scoreText.text = `Очки: ${Math.round(this.shownScore.value)}`;
      },
    });
    gsap.fromTo(this.scoreText.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out' });
  }

  /** Расставляет элементы по ширине экрана */
  resize(width: number) {
    const y = HUD_HEIGHT / 2;
    this.timerText.position.set(MARGIN, y);
    this.pauseButton.position.set(width - MARGIN - SMALL_BUTTON_WIDTH / 2, y);
    this.settingsButton.position.set(this.pauseButton.x - SMALL_BUTTON_WIDTH - 8, y);
    // Счёт по центру, но на узком экране сдвигаем его левее, чтобы не наехал на кнопки
    const buttonsLeft = this.settingsButton.x - SMALL_BUTTON_WIDTH / 2;
    this.scoreText.position.set(Math.min(width / 2, buttonsLeft - 8 - SCORE_MAX_WIDTH / 2), y);
  }

  /** Твины счёта не должны пережить сам интерфейс, а растровый шрифт создаётся заново в следующей игре */
  override destroy(options?: DestroyOptions) {
    gsap.killTweensOf(this.shownScore);
    gsap.killTweensOf(this.scoreText.scale);
    super.destroy(options);
    BitmapFont.uninstall('TimerFont');
  }
}

/** 59999 → «1:00», 9000 → «0:09». Округляем вверх, как настоящие таймеры */
export function formatTime(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
