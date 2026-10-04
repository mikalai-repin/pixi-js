import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Container } from 'pixi.js';

/**
 * Котёл со скелетной анимацией: булькает и покачивается. Внутри можно держать содержимое,
 * которое качается вместе с ним. Упрощённая версия Cauldron из Puzzling Potions. Нужен бандл preload
 */
export class Cauldron extends Container {
  readonly spine: Spine;
  /** Содержимое котла: следует за костью, которая качает котёл */
  private readonly content = new Container();

  constructor() {
    super();
    this.spine = Spine.from({ skeleton: 'preload/cauldron-skeleton.json', atlas: 'preload/cauldron-skeleton.atlas' });
    this.spine.state.setAnimation(0, 'animation', true);
    this.addChild(this.spine, this.content);
    // TODO: после каждого обновления скелета переносить content на место кости bone2
  }

  /** Кладёт объект в котёл: он будет качаться вместе с котлом */
  addContent(item: Container) {
    this.content.addChild(item);
  }
}
