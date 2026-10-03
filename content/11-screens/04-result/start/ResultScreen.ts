import gsap from 'gsap';
import { Container, Sprite, Texture } from 'pixi.js';
import { Button } from './Button';
import { Label } from './Label';
import { navigation, type AppScreen } from './navigation';
import { getGrade, getLastScore } from './stats';

/** Расстановка звёзд: две маленькие по краям, большая в центре, как в оригинале */
const STARS = [
  { x: -80, y: 10, scale: 0.7 },
  { x: 80, y: 10, scale: 0.7 },
  { x: 0, y: -5, scale: 1 },
];

/** Результат игры: счёт, звёзды и две кнопки. Упрощённая версия ResultScreen из Puzzling Potions */
export class ResultScreen extends Container implements AppScreen {
  static assetBundles = ['result', 'common'];

  private readonly panel = new Container();
  private readonly scoreText: Label;
  private readonly stars: Sprite[] = [];
  private readonly buttons = new Container();

  constructor() {
    super();
    const base = new Sprite(Texture.from('result-base'));
    base.anchor.set(0.5);
    const title = new Label('Результат', { fontSize: 36 });
    title.y = -140;
    this.panel.addChild(base, title);

    // Под каждой звездой — бледная «пустая» звезда-слот
    for (const { x, y, scale } of STARS) {
      const slot = new Sprite(Texture.from('star'));
      slot.anchor.set(0.5);
      slot.position.set(x, y - 50);
      slot.scale.set(scale);
      slot.alpha = 0.15;
      const star = new Sprite(Texture.from('star'));
      star.anchor.set(0.5);
      star.position.copyFrom(slot.position);
      star.scale.set(scale);
      star.visible = false;
      this.panel.addChild(slot, star);
      this.stars.push(star);
    }

    this.scoreText = new Label('0', { fontSize: 48, fill: 0xffd27f });
    this.scoreText.y = 60;
    this.panel.addChild(this.scoreText);

    const again = new Button({ text: 'Ещё раз', width: 220, height: 90 });
    again.label = 'againButton';
    again.onPress = () => navigation.showScreen('game');
    const menu = new Button({ text: 'Меню', width: 160, height: 90 });
    menu.label = 'menuButton';
    menu.onPress = () => navigation.showScreen('home');
    again.x = -100;
    menu.x = 110;
    this.buttons.addChild(again, menu);
    this.addChild(this.panel, this.buttons);
  }

  resize(width: number, height: number) {
    this.panel.position.set(width / 2, height * 0.42);
    this.buttons.position.set(width / 2, height - 110);
  }

  // TODO: show() — звёзды по числу getGrade, набегающий счёт, затем кнопки
}
