import type { FancyButton } from '@pixi/ui';
import gsap from 'gsap';
import { BitmapFont, BitmapText, Container, type DestroyOptions } from 'pixi.js';
import { Button } from './Button';
import { Label } from './Label';
import { FONT_FAMILY } from './manifest';
import { createIconButton } from './SettingsPanel';

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

  // TODO: поля для таймера, счёта и двух кнопок

  constructor() {
    super();
    // TODO: создать таймер (BitmapText), счёт (Label) и кнопки, подписаться на их нажатия
  }

  /** Показывать ли кнопки: они нужны только во время игры */
  set buttonsVisible(value: boolean) {
    // TODO
  }

  /** Показывает оставшееся время, в последние секунды таймер мигает */
  setTime(ms: number) {
    // TODO
  }

  /** Показывает новый счёт: число набегает, надпись подпрыгивает */
  setScore(score: number) {
    // TODO
  }

  /** Расставляет элементы по ширине экрана */
  resize(width: number) {
    // TODO
  }
}

/** 59999 → «1:00», 9000 → «0:09». Округляем вверх, как настоящие таймеры */
export function formatTime(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
