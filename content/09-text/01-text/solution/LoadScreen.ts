import { Container, Graphics, Sprite, Texture, Ticker, type DestroyOptions } from 'pixi.js';

/**
 * Экран загрузки из практикума главы 5, вынесенный в отдельный класс.
 * Перед созданием должен быть загружен бандл preload.
 */
export class LoadScreen extends Container {
  private readonly bar = new Graphics();
  private readonly dot: Sprite;
  private time = 0;

  constructor(private readonly ticker: Ticker) {
    super();

    const logo = new Sprite(Texture.from('logo-pixi'));
    logo.anchor.set(0.5);
    logo.y = -80;
    this.addChild(logo);

    this.dot = new Sprite(Texture.from('circle'));
    this.dot.anchor.set(0.5);
    this.dot.setSize(24);
    this.dot.tint = 0xffd27f;
    this.dot.y = 10;
    this.addChild(this.dot);

    this.bar.y = 70;
    this.addChild(this.bar);
    this.setProgress(0);

    this.ticker.add(this.pulse, this);
  }

  /** Перерисовывает полоску загрузки. progress — от 0 до 1 */
  setProgress(progress: number) {
    this.bar
      .clear()
      .roundRect(-100, -6, 200, 12, 6)
      .fill({ color: 0xffffff, alpha: 0.15 })
      .roundRect(-100, -6, 200 * progress, 12, 6)
      .fill(0xffd27f);
  }

  private pulse(ticker: Ticker) {
    this.time += ticker.deltaMS / 1000;
    this.dot.alpha = 0.3 + 0.7 * ((Math.sin(this.time * 6) + 1) / 2);
  }

  /** Уничтожая экран, не забываем отписаться от тикера */
  override destroy(options?: DestroyOptions) {
    this.ticker.remove(this.pulse, this);
    super.destroy(options);
  }
}
