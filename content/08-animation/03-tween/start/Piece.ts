import { Container, FederatedPointerEvent, Rectangle, Sprite, Texture, Ticker, type DestroyOptions } from 'pixi.js';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/** На сколько пикселей нужно сдвинуть указатель, чтобы это считалось свайпом */
const SWIPE_THRESHOLD = 10;
/** Скорость вращения подсветки: радиан за кадр при 60 FPS */
const HIGHLIGHT_SPEED = 0.03;

/**
 * Фишка на поле: картинка зелья и подсветка под ней.
 * Упрощённая версия Match3Piece из Puzzling Potions.
 * Текстуры берутся из кэша Assets по псевдонимам, поэтому их нужно загрузить заранее.
 */
export class Piece extends Container {
  private readonly highlight: Sprite;
  private readonly image: Sprite;

  /** Клетка, в которой стоит фишка */
  row = 0;
  column = 0;
  /** Вызывается при простом нажатии без свайпа */
  onTap?: (piece: Piece) => void;
  /** Вызывается, когда игрок провёл по фишке пальцем или мышью */
  onSwipe?: (piece: Piece, direction: SwipeDirection) => void;

  private pressing = false;
  private swiped = false;
  private pressX = 0;
  private pressY = 0;

  constructor(textureName: string, size: number, private readonly ticker: Ticker) {
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

    this.on('pointerdown', this.onPointerDown, this);
    // globalpointermove приходит, даже когда указатель уже ушёл с фишки
    this.on('globalpointermove', this.onPointerMove, this);
    this.on('pointerup', this.onPointerUp, this);
    // Отпустили за пределами фишки или система прервала жест — нажатие тоже закончилось
    this.on('pointerupoutside', this.onPointerUp, this);
    this.on('pointercancel', this.onPointerUp, this);

    this.ticker.add(this.update, this);
  }

  /** Включает или выключает подсветку */
  setHighlight(enabled: boolean) {
    this.highlight.visible = enabled;
    // Без подсветки зелье стоит ровно
    if (!enabled) this.image.rotation = 0;
  }

  /** Каждый кадр: у выбранной фишки вращается подсветка и покачивается зелье */
  private update(ticker: Ticker) {
    if (!this.highlight.visible) return;
    this.highlight.rotation += HIGHLIGHT_SPEED * ticker.deltaTime;
    this.image.rotation = Math.sin(ticker.lastTime * 0.01) * 0.1;
  }

  private onPointerDown(event: FederatedPointerEvent) {
    this.pressing = true;
    this.swiped = false;
    this.pressX = event.global.x;
    this.pressY = event.global.y;
  }

  private onPointerMove(event: FederatedPointerEvent) {
    if (!this.pressing || this.swiped) return;
    const dx = event.global.x - this.pressX;
    const dy = event.global.y - this.pressY;
    // Пока указатель сдвинулся меньше порога, это ещё не свайп, а дрожание пальца
    if (Math.hypot(dx, dy) < SWIPE_THRESHOLD) return;

    this.swiped = true;
    const direction: SwipeDirection =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.onSwipe?.(this, direction);
  }

  private onPointerUp() {
    if (this.pressing && !this.swiped) this.onTap?.(this);
    this.pressing = false;
  }

  /** Уничтоженная фишка не должна оставаться в тикере */
  override destroy(options?: DestroyOptions) {
    this.ticker.remove(this.update, this);
    super.destroy(options);
  }
}
