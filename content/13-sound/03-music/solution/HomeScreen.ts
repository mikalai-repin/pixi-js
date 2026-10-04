import gsap from 'gsap';
import { Container, Sprite, Texture } from 'pixi.js';
import { bgm } from './audio';
import { Button } from './Button';
import { Label } from './Label';
import { navigation, type AppScreen } from './navigation';
import { getBestScore } from './stats';

/** Главное меню: логотип и кнопка «Играть». Как HomeScreen в Puzzling Potions */
export class HomeScreen extends Container implements AppScreen {
  /** Ресурсы экрана: логотип лежит в бандле home, кнопки — в common */
  static assetBundles = ['home', 'common'];

  private readonly logo: Sprite;
  private readonly subtitle: Label;
  private readonly playButton: Button;
  private readonly bestText: Label;

  constructor() {
    super();
    this.logo = new Sprite(Texture.from('logo-game'));
    this.logo.anchor.set(0.5);
    this.logo.scale.set(0.75);
    this.subtitle = new Label('Собери три зелья в ряд!', { fontSize: 22 });
    this.playButton = new Button({ text: 'Играть' });
    this.playButton.label = 'playButton';
    this.playButton.onPress = () => navigation.showScreen('game');
    this.addChild(this.logo, this.subtitle, this.playButton);

    const best = getBestScore();
    this.bestText = new Label(best > 0 ? `Рекорд: ${best}` : '', { fontSize: 22, fill: 0xffd27f });
    this.addChild(this.bestText);
  }

  resize(width: number, height: number) {
    this.logo.position.set(width / 2, height * 0.3);
    this.subtitle.position.set(width / 2, height * 0.3 + 110);
    this.playButton.position.set(width / 2, height * 0.65);
    this.bestText.position.set(width / 2, height * 0.65 + 85);
  }

  /** Логотип опускается сверху, кнопка выпрыгивает */
  async show() {
    bgm.play('common/bgm-main.mp3', { volume: 0.7 });
    gsap.from(this.logo, { y: -200, duration: 0.6, ease: 'back.out' });
    gsap.from(this.subtitle, { alpha: 0, duration: 0.4, delay: 0.3 });
    await gsap.from(this.playButton.scale, { x: 0, y: 0, duration: 0.4, delay: 0.4, ease: 'back.out' });
  }

  /** Экран гаснет целиком */
  async hide() {
    await gsap.to(this, { alpha: 0, duration: 0.25 });
  }
}
