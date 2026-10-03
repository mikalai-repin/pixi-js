import { Texture, Ticker, TilingSprite } from 'pixi.js';

/** Направление движения узора: на 27° левее вертикали, как в оригинале */
const DIRECTION = -Math.PI * 0.15;
/** Скорость узора: пикселей за кадр при 60 FPS */
const SPEED = 1;

/**
 * Фон из бесконечно повторяющейся картинки, который медленно плывёт.
 * Упрощённая версия TiledBackground из Puzzling Potions. Нужен загруженный бандл preload
 */
export class Background extends TilingSprite {
  constructor(private readonly ticker: Ticker) {
    // TODO: вызвать конструктор TilingSprite с текстурой 'background', повернуть узор, подписаться на onRender
    super();
  }

  /** Растягивает фон на весь экран */
  resize(width: number, height: number) {
    // TODO: задать размер области, которую заполняет узор
  }

  /** Каждый кадр сдвигает узор */
  private update() {
    // TODO: сдвинуть tilePosition вдоль направления DIRECTION
  }
}
