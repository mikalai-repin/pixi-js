import gsap from 'gsap';
import { Container, Sprite, Texture } from 'pixi.js';
import { Button } from './Button';
import { Label } from './Label';
import { getStars, isUnlocked, LEVELS, selectLevel } from './levels';
import { navigation, type AppScreen } from './navigation';

/** Уровней в ряду */
const COLUMNS = 3;
/** Размер кнопки уровня */
const BUTTON_SIZE = 96;
/** Расстояние между центрами соседних кнопок */
const CELL_WIDTH = 112;
const CELL_HEIGHT = 140;
/** Масштаб звезды под кнопкой: текстура star — около 100 пикселей */
const STAR_SCALE = 0.22;

/**
 * Карта уровней: кнопка на каждый уровень, под ней звёзды за лучшее прохождение.
 * Следующий уровень открывается, когда пройден предыдущий
 */
export class LevelsScreen extends Container implements AppScreen {
  /** Кнопки и звёзды лежат в атласе common */
  static assetBundles = ['common'];

  private readonly title: Label;
  /** Кнопки уровней со звёздами, сеткой по COLUMNS в ряд */
  private readonly grid = new Container();
  private readonly cells: Container[] = [];
  private readonly backButton: Button;

  constructor() {
    super();
    this.title = new Label('Уровни', { fontSize: 48 });
    this.addChild(this.title, this.grid);

    LEVELS.forEach((_, index) => {
      const cell = this.createCell(index);
      // Сетка по центру: середина ряда — в x = 0
      const column = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      cell.position.set((column - (COLUMNS - 1) / 2) * CELL_WIDTH, row * CELL_HEIGHT);
      this.grid.addChild(cell);
      this.cells.push(cell);
    });

    this.backButton = new Button({ text: 'Меню', width: 160, height: 90 });
    this.backButton.label = 'backButton';
    this.backButton.onPress = () => navigation.showScreen('home');
    this.addChild(this.backButton);
  }

  /** Кнопка уровня и три звезды под ней. Закрытый уровень полупрозрачен и не нажимается */
  private createCell(index: number) {
    const cell = new Container();
    const button = new Button({ text: String(index + 1), width: BUTTON_SIZE, height: BUTTON_SIZE });
    button.label = `level${index + 1}`;
    cell.addChild(button);

    if (isUnlocked(index)) {
      button.onPress = () => {
        selectLevel(index);
        navigation.showScreen('game');
      };
    } else {
      // Без событий кнопка не подсвечивается и не звучит под указателем
      button.eventMode = 'none';
      button.alpha = 0.4;
    }

    const stars = getStars(index);
    for (let i = 0; i < 3; i++) {
      const star = new Sprite({ texture: Texture.from('star'), anchor: 0.5 });
      star.scale.set(STAR_SCALE);
      star.position.set((i - 1) * 30, BUTTON_SIZE / 2 + 18);
      // Незаработанная звезда — бледная, как слоты на экране результата
      star.alpha = i < stars ? 1 : 0.2;
      cell.addChild(star);
    }
    return cell;
  }

  resize(width: number, height: number) {
    this.title.position.set(width / 2, height * 0.12);
    const rows = Math.ceil(LEVELS.length / COLUMNS);
    // Сетка — посередине между заголовком и кнопкой «Меню»
    this.grid.position.set(width / 2, height * 0.45 - ((rows - 1) * CELL_HEIGHT) / 2);
    this.backButton.position.set(width / 2, height - 90);
  }

  /** Кнопки уровней выпрыгивают по очереди */
  async show() {
    gsap.from(this.title, { alpha: 0, duration: 0.3 });
    const scales = this.cells.map((cell) => cell.scale);
    await gsap.from(scales, { x: 0, y: 0, duration: 0.35, ease: 'back.out', stagger: 0.05 });
  }

  async hide() {
    await gsap.to(this, { alpha: 0, duration: 0.25 });
  }
}
