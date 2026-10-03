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
    // Текстура белая, с чуть более серыми зельями: тонированием красим её в сиреневый
    super({ texture: Texture.from('background'), tint: 0xa58fd0 });
    // Поворачиваем не сам спрайт, а узор внутри него
    this.tileTransform.rotation = DIRECTION;
    this.onRender = () => this.update();
  }

  /** Растягивает фон на весь экран */
  resize(width: number, height: number) {
    // У TilingSprite ширина и высота — размер области, а не масштаб картинки
    this.width = width;
    this.height = height;
  }

  /** Каждый кадр сдвигает узор */
  private update() {
    const distance = SPEED * this.ticker.deltaTime;
    // Вектор «вверх», повёрнутый на DIRECTION: узор плывёт вдоль своих столбиков
    this.tilePosition.x += Math.sin(DIRECTION) * distance;
    this.tilePosition.y -= Math.cos(DIRECTION) * distance;
  }
}
