import { Container, NineSliceSprite, Sprite, Texture } from 'pixi.js';
import { Label } from './Label';

/** Текстуры трёх состояний и края, которые не растягиваются, для кнопок двух размеров из атласа common */
const BUTTON_STYLES = {
  large: {
    textures: { default: 'button-large', hover: 'button-large-hover', pressed: 'button-large-press' },
    slices: { leftWidth: 36, topHeight: 42, rightWidth: 36, bottomHeight: 52 },
    width: 240,
    height: 100,
    // Насколько содержимое выше центра: внизу у кнопки бортик
    contentY: -10,
    pressedContentY: -4,
  },
  small: {
    textures: { default: 'button-small', hover: 'button-small-hover', pressed: 'button-small-press' },
    slices: { leftWidth: 16, topHeight: 16, rightWidth: 16, bottomHeight: 20 },
    width: 67,
    height: 53,
    contentY: -3,
    pressedContentY: 0,
  },
};

export interface ButtonOptions {
  /** Надпись на кнопке */
  text?: string;
  /** Имя текстуры иконки вместо надписи */
  icon?: string;
  size?: 'large' | 'small';
  width?: number;
  height?: number;
}

/**
 * Кнопка с тремя состояниями: обычное, под указателем, нажатое.
 * Вызывает onPress, когда её нажали и отпустили. Нужен загруженный бандл common
 */
export class Button extends Container {
  /** Вызывается при нажатии на кнопку */
  onPress?: () => void;

  private readonly background: NineSliceSprite;
  private readonly content: Container;
  private readonly style;
  private hovered = false;
  private pressed = false;

  constructor({ text = '', icon, size = 'large', width, height }: ButtonOptions = {}) {
    super();
    this.style = BUTTON_STYLES[size];

    this.background = new NineSliceSprite({
      texture: Texture.from(this.style.textures.default),
      ...this.style.slices,
      width: width ?? this.style.width,
      height: height ?? this.style.height,
      anchor: 0.5,
    });
    this.addChild(this.background);

    if (icon) {
      const sprite = new Sprite(Texture.from(icon));
      sprite.anchor.set(0.5);
      this.content = sprite;
    } else {
      this.content = new Label(text, { fontSize: size === 'large' ? 36 : 22 });
    }
    this.addChild(this.content);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerover', () => this.setState(true, this.pressed));
    this.on('pointerout', () => this.setState(false, this.pressed));
    this.on('pointerdown', () => this.setState(this.hovered, true));
    this.on('pointerup', () => this.setState(this.hovered, false));
    this.on('pointerupoutside', () => this.setState(this.hovered, false));
    this.on('pointertap', () => this.onPress?.());
    this.updateView();
  }

  private setState(hovered: boolean, pressed: boolean) {
    this.hovered = hovered;
    this.pressed = pressed;
    this.updateView();
  }

  /** Показывает текущее состояние: меняет текстуру фона и сдвигает содержимое */
  private updateView() {
    const { textures } = this.style;
    const name = this.pressed ? textures.pressed : this.hovered ? textures.hover : textures.default;
    this.background.texture = Texture.from(name);
    this.content.y = this.pressed ? this.style.pressedContentY : this.style.contentY;
  }
}
