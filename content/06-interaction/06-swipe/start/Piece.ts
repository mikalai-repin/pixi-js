import { Container, Rectangle, Sprite, Texture } from 'pixi.js';

/**
 * Фишка на поле: картинка зелья и подсветка под ней.
 * Упрощённая версия Match3Piece из Puzzling Potions.
 * Текстуры берутся из кэша Assets по псевдонимам, поэтому их нужно загрузить заранее.
 */
export class Piece extends Container {
  private readonly highlight: Sprite;
  private readonly image: Sprite;

  constructor(textureName: string, size: number) {
    super();

    this.highlight = new Sprite(Texture.from('highlight'));
    this.highlight.anchor.set(0.5);
    this.highlight.setSize(size);
    this.highlight.alpha = 0.5;
    this.highlight.visible = false;
    this.addChild(this.highlight);

    this.image = new Sprite(Texture.from(textureName));
    this.image.anchor.set(0.5);
    this.image.setSize(size - 4);
    this.addChild(this.image);

    // Фишка принимает события указателя
    this.eventMode = 'static';
    this.cursor = 'pointer';
    // Зона нажатия — вся клетка, а не только картинка зелья
    this.hitArea = new Rectangle(-size / 2, -size / 2, size, size);
  }

  /** Включает или выключает подсветку */
  setHighlight(enabled: boolean) {
    this.highlight.visible = enabled;
  }
}
