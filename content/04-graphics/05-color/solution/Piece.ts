import { Container, Sprite, Texture } from 'pixi.js';

/** Путь к текстуре подсветки. Она должна быть загружена до создания первой фишки */
export const HIGHLIGHT_URL = '/assets/game/highlight.png';

/**
 * Фишка на поле: картинка зелья и подсветка под ней.
 * Упрощённая версия Match3Piece из Puzzling Potions.
 */
export class Piece extends Container {
  private readonly highlight: Sprite;
  private readonly image: Sprite;

  constructor(texture: Texture, size: number) {
    super();

    this.highlight = new Sprite(Texture.from(HIGHLIGHT_URL));
    this.highlight.anchor.set(0.5);
    this.highlight.setSize(size);
    this.highlight.alpha = 0.5;
    this.highlight.visible = false;
    this.addChild(this.highlight);

    this.image = new Sprite(texture);
    this.image.anchor.set(0.5);
    this.image.setSize(size - 4);
    this.addChild(this.image);
  }

  /** Включает или выключает подсветку */
  setHighlight(enabled: boolean) {
    this.highlight.visible = enabled;
  }
}
