import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Container } from 'pixi.js';

/** Масштаб скелета: дракон нарисован крупно, без масштаба он ростом около 900 пикселей */
const DRAGON_SCALE = 0.3;

/**
 * Дракон со скелетной анимацией: живёт в меню. Как Dragon в Puzzling Potions.
 * Нужен загруженный бандл common
 */
export class Dragon extends Container {
  /** Сам скелет с анимациями */
  readonly spine: Spine;

  constructor() {
    super();
    // Скелет и атлас — по псевдонимам из манифеста: их загрузил Assets вместе с бандлом common
    this.spine = Spine.from({ skeleton: 'common/dragon-skeleton.json', atlas: 'common/dragon-skeleton.atlas' });
    // Начало координат скелета — между лап дракона: он стоит в точке (0, 0) этого контейнера
    this.spine.scale.set(DRAGON_SCALE);
    this.addChild(this.spine);
    // Смена анимации длится 0,2 с: позы плавно перетекают одна в другую, а не перескакивают
    this.spine.state.data.defaultMix = 0.2;
    this.playIdle();
  }

  /** Дракон сидит и покачивается — по кругу */
  playIdle() {
    this.spine.state.setAnimation(0, 'dragon-idle', true);
  }

  /** Дракон удивлённо открывает рот — один раз, а потом снова сидит и покачивается */
  playBubbles() {
    this.spine.state.setAnimation(0, 'dragon-bubbles', false);
    // В очередь той же дорожки: начнётся, когда закончится предыдущая анимация
    this.spine.state.addAnimation(0, 'dragon-idle', true, 0);
  }
}
