import { Container, FederatedPointerEvent, Rectangle, Sprite, Texture, Ticker } from 'pixi.js';
import gsap from 'gsap';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/** На сколько пикселей нужно сдвинуть указатель, чтобы это считалось свайпом */
const SWIPE_THRESHOLD = 10;
/** Скорость вращения подсветки: радиан за кадр при 60 FPS */
const HIGHLIGHT_SPEED = 0.03;
/** Когда падающая фишка впервые касается дна: доля времени */
const LAND_TIME = 0.55;
/** Высота отскока: доля всего пути */
const BOUNCE_HEIGHT = 0.15;

/** Функция плавности из главы 8: падение с ускорением и один небольшой отскок */
function singleBounce(t: number) {
  if (t < LAND_TIME) return (t / LAND_TIME) ** 2;
  const u = (t - LAND_TIME) / (1 - LAND_TIME);
  return 1 - BOUNCE_HEIGHT * 4 * u * (1 - u);
}

/**
 * Фишка на поле: картинка зелья и подсветка под ней.
 * Упрощённая версия Match3Piece из Puzzling Potions.
 * Текстуры берутся из кэша Assets по псевдонимам, поэтому их нужно загрузить заранее.
 */
export class Piece extends Container {
  private readonly highlight: Sprite;
  private readonly image: Sprite;

  /** Спецфишка: подсветка у неё горит всегда */
  special = false;
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

  /**
   * @param textureName имя текстуры зелья: пригодится эффектам, чтобы нарисовать копию фишки
   */
  constructor(
    readonly textureName: string,
    size: number,
    private readonly ticker: Ticker,
  ) {
    super();

    this.highlight = new Sprite(Texture.from('highlight'));
    this.highlight.anchor.set(0.5);
    this.highlight.setSize(size);
    this.highlight.alpha = 0.5;
    // Подсветка не закрывает поле, а осветляет его
    this.highlight.blendMode = 'add';
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

    // Вызывается перед каждой отрисовкой, пока фишка находится в дереве сцены
    this.onRender = () => this.update();
  }

  /** Делает фишку спецфишкой */
  makeSpecial() {
    this.special = true;
    this.highlight.visible = true;
  }

  /** Включает или выключает подсветку. У спецфишки она не выключается */
  setHighlight(enabled: boolean) {
    this.highlight.visible = enabled || this.special;
    // Без подсветки зелье стоит ровно
    if (!enabled) this.image.rotation = 0;
  }

  /** Плавно перемещает фишку в точку (x, y) внутри поля */
  async animateMove(x: number, y: number) {
    await gsap.to(this, { x, y, duration: 0.2, ease: 'quad.out' });
  }

  /** Исчезновение: фишка становится прозрачной */
  async animatePop() {
    await gsap.to(this, { alpha: 0, duration: 0.1, ease: 'quad.out' });
  }

  /** Появление: фишка возникает вдвое крупнее и сжимается до обычного размера */
  async animateSpawn() {
    await gsap.fromTo(this.scale, { x: 2, y: 2 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out' });
  }

  /** Падение в точку (x, y) с отскоком */
  async animateFall(x: number, y: number) {
    // GSAP принимает и свою функцию плавности
    await gsap.to(this, { x, y, duration: 0.5, ease: singleBounce });
  }

  /** Каждый кадр: у выбранной фишки вращается подсветка и покачивается зелье */
  private update() {
    if (!this.highlight.visible) return;
    this.highlight.rotation += HIGHLIGHT_SPEED * this.ticker.deltaTime;
    this.image.rotation = Math.sin(this.ticker.lastTime * 0.01) * 0.1;
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
}
