import { sound } from '@pixi/sound';
import gsap from 'gsap';
import { Container, Sprite, Texture, type DestroyOptions } from 'pixi.js';
import { bgm, isAudioLocked } from './audio';
import { Button } from './Button';
import { Dragon } from './Dragon';
import { Label } from './Label';
import { selectLevel } from './levels';
import { navigation, type AppScreen } from './navigation';
import { getBestScore } from './stats';

/** Ширина каждой из двух кнопок меню: вместе они помещаются в самый узкий экран, 375 пикселей */
const MENU_BUTTON_WIDTH = 170;

/** Главное меню: логотип, кнопки «Играть» и «Уровни». Как HomeScreen в Puzzling Potions */
export class HomeScreen extends Container implements AppScreen {
  /** Ресурсы экрана: логотип лежит в бандле home, кнопки — в common */
  static assetBundles = ['home', 'common'];

  private readonly logo: Sprite;
  private readonly dragon: Dragon;
  private readonly subtitle: Label;
  private readonly playButton: Button;
  private readonly levelsButton: Button;
  private readonly bestText: Label;
  /** Подсказка о звуке: видна, пока браузер не разрешил звук */
  private readonly soundHint: Label;

  constructor() {
    super();
    // Дракон — первым: логотип ляжет поверх его ушей
    this.dragon = new Dragon();
    this.addChild(this.dragon);
    this.logo = new Sprite(Texture.from('logo-game'));
    this.logo.anchor.set(0.5);
    this.logo.scale.set(0.75);
    this.subtitle = new Label('Собери три зелья в ряд!', { fontSize: 22 });
    this.playButton = new Button({ text: 'Играть', width: MENU_BUTTON_WIDTH });
    this.playButton.label = 'playButton';
    this.playButton.onPress = () => {
      // Обычная игра на время
      selectLevel(null);
      navigation.showScreen('game');
    };
    this.levelsButton = new Button({ text: 'Уровни', width: MENU_BUTTON_WIDTH });
    this.levelsButton.label = 'levelsButton';
    this.levelsButton.onPress = () => {
      // Пока уровень один и тот же — первый. Выбор уровня появится в шаге 17.4
      selectLevel(0);
      navigation.showScreen('game');
    };
    // Дракон реагирует, когда указатель наводят на любую из кнопок
    this.playButton.on('pointerover', () => this.dragon.playBubbles());
    this.levelsButton.on('pointerover', () => this.dragon.playBubbles());
    this.addChild(this.logo, this.subtitle, this.playButton, this.levelsButton);

    const best = getBestScore();
    this.bestText = new Label(best > 0 ? `Рекорд: ${best}` : '', { fontSize: 22, fill: 0xffd27f });
    this.addChild(this.bestText);

    this.soundHint = new Label('Нажмите на экран, чтобы включить звук', { fontSize: 18 });
    this.addChild(this.soundHint);
    this.updateSoundHint();
    // Контекст WebAudio сообщает, когда его состояние меняется: suspended → running и обратно
    sound.context.audioContext.addEventListener('statechange', this.updateSoundHint);
  }

  /** Стрелочная функция в поле: её можно и подписать на событие, и потом отписать */
  private readonly updateSoundHint = () => {
    this.soundHint.visible = isAudioLocked();
  };

  resize(width: number, height: number) {
    this.logo.position.set(width / 2, height * 0.18);
    this.subtitle.position.set(width / 2, height * 0.18 + 95);
    // Дракон стоит лапами чуть выше кнопки
    this.dragon.position.set(width / 2, height - 170);
    this.playButton.position.set(width / 2 - MENU_BUTTON_WIDTH / 2 - 6, height - 130);
    this.levelsButton.position.set(width / 2 + MENU_BUTTON_WIDTH / 2 + 6, height - 130);
    this.bestText.position.set(width / 2, height - 70);
    this.soundHint.position.set(width / 2, height - 40);
  }

  /** Логотип опускается сверху, кнопки выпрыгивают */
  async show() {
    bgm.play('common/bgm-main.mp3', { volume: 0.7 });
    gsap.from(this.logo, { y: -200, duration: 0.6, ease: 'back.out' });
    gsap.from(this.subtitle, { alpha: 0, duration: 0.4, delay: 0.3 });
    gsap.from(this.playButton.scale, { x: 0, y: 0, duration: 0.4, delay: 0.4, ease: 'back.out' });
    await gsap.from(this.levelsButton.scale, { x: 0, y: 0, duration: 0.4, delay: 0.5, ease: 'back.out' });
  }

  /** Экран гаснет целиком */
  async hide() {
    await gsap.to(this, { alpha: 0, duration: 0.25 });
  }

  /** Контекст WebAudio живёт дольше экрана: отписываемся, иначе слушатель тронет уничтоженный текст */
  override destroy(options?: DestroyOptions) {
    sound.context.audioContext.removeEventListener('statechange', this.updateSoundHint);
    super.destroy(options);
  }
}
