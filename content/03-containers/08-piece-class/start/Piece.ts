import { Container, Sprite, Texture } from 'pixi.js';

/** Путь к текстуре подсветки. Она должна быть загружена до создания первой фишки */
export const HIGHLIGHT_URL = '/assets/game/highlight.png';

/** Фишка на поле: картинка зелья и подсветка под ней */
export class Piece extends Container {
  // TODO: поля highlight и image, конструктор(texture, size) и метод setHighlight(enabled)
}
