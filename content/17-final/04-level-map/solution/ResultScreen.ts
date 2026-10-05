import gsap from 'gsap';
import { Container, Sprite, Texture } from 'pixi.js';
import { bgm, sfx } from './audio';
import { Button } from './Button';
import { Dragon } from './Dragon';
import { Label } from './Label';
import { getLastStars, getLevelIndex, getMovesLeft, isLevelWon, LEVELS, selectLevel } from './levels';
import { MaskTransition } from './MaskTransition';
import { navigation, type AppScreen } from './navigation';
import { getBestScore, getGrade, getLastScore } from './stats';

/** Расстановка звёзд: две маленькие по краям, большая в центре, как в оригинале */
const STARS = [
  { x: -80, y: 10, scale: 0.7 },
  { x: 80, y: 10, scale: 0.7 },
  { x: 0, y: -5, scale: 1 },
];

/** Звёзды звенят всё выше: последняя, самая большая, — выше всех */
const STAR_SOUND_SPEEDS = [0.9, 1, 1.5];
/** Звук набегающих очков — не чаще раза в 100 мс, иначе десятки звуков сольются в шум */
const POINTS_SOUND_INTERVAL = 100;

/** Результат игры: счёт, звёзды и две кнопки. Упрощённая версия ResultScreen из Puzzling Potions */
export class ResultScreen extends Container implements AppScreen {
  static assetBundles = ['result', 'common'];

  private readonly panel = new Container();
  /** Дракон выглядывает из-за панели */
  private readonly dragon = new Dragon();
  private readonly scoreText: Label;
  private readonly stars: Sprite[] = [];
  private readonly buttons = new Container();
  private readonly bestText: Label;
  private readonly transition = new MaskTransition();

  constructor() {
    super();
    const base = new Sprite(Texture.from('result-base'));
    base.anchor.set(0.5);
    // В игре на ходы заголовок говорит, пройден ли уровень
    const level = getLevelIndex();
    const text = level === null ? 'Результат' : isLevelWon() ? `Уровень ${level + 1} пройден!` : 'Уровень не пройден';
    const title = new Label(text, { fontSize: level === null ? 36 : 30 });
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
    this.bestText = new Label('', { fontSize: 20 });
    this.bestText.y = 105;
    this.panel.addChild(this.bestText);

    // После пройденного уровня главная кнопка ведёт дальше, если есть куда
    const next = level !== null && isLevelWon() && level + 1 < LEVELS.length ? level + 1 : null;
    const again = new Button({ text: next === null ? 'Ещё раз' : 'Дальше', width: 220, height: 90 });
    again.label = 'againButton';
    again.onPress = () => {
      if (next !== null) selectLevel(next);
      navigation.showScreen('game');
    };
    // Из уровня возвращаемся к карте уровней, из игры на время — в меню
    const menu = new Button({ text: level === null ? 'Меню' : 'Уровни', width: 160, height: 90 });
    menu.label = 'menuButton';
    menu.onPress = () => navigation.showScreen(level === null ? 'home' : 'levels');
    again.x = -100;
    menu.x = 110;
    this.buttons.addChild(again, menu);
    this.addChild(this.dragon, this.panel, this.buttons);
  }

  resize(width: number, height: number) {
    // Панель ниже, чем раньше: над ней выглядывает дракон
    this.panel.position.set(width / 2, height * 0.52);
    // Дракон стоит за панелью: видны голова и уши
    this.dragon.position.set(width / 2, this.panel.y - 75);
    this.buttons.position.set(width / 2, height - 110);
    this.transition.resize(width, height);
  }

  /** Звёзды выпрыгивают по одной, счёт набегает, кнопки появляются в конце */
  async show() {
    const score = getLastScore();
    // У уровня звёзды — за ходы в запасе, у игры на время — за очки
    const grade = getLevelIndex() === null ? getGrade(score) : getLastStars();
    this.buttons.visible = false;
    bgm.play('common/bgm-main.mp3', { volume: 0.5 });
    // Экран открывается «расширяющимся котлом»
    await this.transition.play(this);
    // Дракон поднимается из-за панели: сдвиг pivot вниз прячет его, твин возвращает
    this.dragon.playTransition();
    gsap.from(this.dragon.pivot, { y: -250, duration: 0.7, ease: 'back.out' });
    for (let i = 0; i < grade; i++) {
      const star = this.stars[i];
      star.visible = true;
      sfx.play('common/sfx-correct.wav', { speed: STAR_SOUND_SPEEDS[i] });
      await gsap.from(star.scale, { x: 0, y: 0, duration: 0.35, ease: 'back.out' });
    }
    const shown = { value: 0 };
    let lastSoundTime = 0;
    await gsap.to(shown, {
      value: score,
      duration: 1,
      ease: 'quad.out',
      onUpdate: () => {
        this.scoreText.text = String(Math.round(shown.value));
        const now = performance.now();
        if (score > 0 && now - lastSoundTime >= POINTS_SOUND_INTERVAL) {
          lastSoundTime = now;
          // Чем ближе к итогу, тем выше звук: от 0.8 до 1.6
          sfx.play('common/sfx-points.wav', { speed: 0.8 + (shown.value / score) * 0.8, volume: 0.3 });
        }
      },
    });
    if (getLevelIndex() === null) {
      const best = getBestScore();
      const record = score > 0 && score >= best;
      this.bestText.text = record ? 'Новый рекорд!' : `Рекорд: ${best}`;
      if (record) sfx.play('common/sfx-special.wav', { volume: 0.5 });
    } else {
      // У уровня рекорда нет: вместо него — сколько ходов осталось в запасе
      this.bestText.text = isLevelWon() ? `Ходов в запасе: ${getMovesLeft()}` : 'Попробуйте ещё раз';
    }
    this.buttons.visible = true;
    await gsap.from(this.buttons, { alpha: 0, duration: 0.3 });
  }

  async hide() {
    await gsap.to(this, { alpha: 0, duration: 0.25 });
  }
}
