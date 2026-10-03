import gsap from 'gsap';
import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import type { AppScreen } from './navigation';

/**
 * Экран загрузки: логотип, пульсирующая точка и полоска прогресса.
 * Его показывает навигация, пока грузятся бандлы следующего экрана. Нужен загруженный бандл preload
 */
export class LoadScreen extends Container implements AppScreen {
  private readonly content = new Container();
  private readonly bar = new Graphics();
  private readonly dot: Sprite;
  private time = 0;

  constructor() {
    super();
    this.addChild(this.content);

    const logo = new Sprite(Texture.from('logo-pixi'));
    logo.anchor.set(0.5);
    logo.y = -80;
    this.content.addChild(logo);

    this.dot = new Sprite(Texture.from('circle'));
    this.dot.anchor.set(0.5);
    this.dot.setSize(24);
    this.dot.tint = 0xffd27f;
    this.dot.y = 10;
    this.content.addChild(this.dot);

    this.bar.y = 70;
    this.content.addChild(this.bar);
    this.setProgress(0);
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

  /** Навигация вызывает каждый кадр, пока экран на сцене */
  update(ticker: Ticker) {
    this.time += ticker.deltaMS / 1000;
    this.dot.alpha = 0.3 + 0.7 * ((Math.sin(this.time * 6) + 1) / 2);
  }

  resize(width: number, height: number) {
    this.content.position.set(width / 2, height / 2);
  }

  /** Загрузка закончилась: экран плавно гаснет */
  async hide() {
    await gsap.to(this.content, { alpha: 0, duration: 0.3 });
  }
}
