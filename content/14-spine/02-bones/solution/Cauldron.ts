import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Container, DEG_TO_RAD } from 'pixi.js';

/** Кость, которая покачивает котёл: за ней следует содержимое */
const BODY_BONE = 'bone2';

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
    // Скелет обновляется сам на каждом кадре. Когда кости уже встали на новые места, двигаем содержимое
    this.spine.afterUpdateWorldTransforms = () => this.followBone();
  }

  /** Кладёт объект в котёл: он будет качаться вместе с котлом */
  addContent(item: Container) {
    this.content.addChild(item);
  }

  /** Содержимое — в точке кости и с её поворотом. Spine хранит углы в градусах */
  private followBone() {
    const bone = this.spine.skeleton.findBone(BODY_BONE)!;
    this.content.position.set(bone.worldX, bone.worldY);
    this.content.rotation = bone.getWorldRotationX() * DEG_TO_RAD;
  }
}
