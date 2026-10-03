import { Text, type TextStyleOptions } from 'pixi.js';
import { FONT_FAMILY } from './manifest';

/** Стиль надписей игры по умолчанию */
const defaultLabelStyle: TextStyleOptions = {
  fontFamily: FONT_FAMILY,
  fontSize: 30,
  fill: 0xffffff,
  align: 'center',
  stroke: { color: 0x2c136c, width: 5 },
};

/**
 * Надпись в стиле игры, по умолчанию с якорем в центре.
 * Упрощённая версия Label из Puzzling Potions
 */
export class Label extends Text {
  constructor(text: string | number = '', style: TextStyleOptions = {}) {
    super({ text, style: { ...defaultLabelStyle, ...style } });
    this.anchor.set(0.5);
  }
}
