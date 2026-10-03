import gsap from 'gsap';
import { AnimatedSprite, Container, Texture } from 'pixi.js';

/**
 * Обратный отсчёт из главы 8: цифры 5, 4, 3, 2, 1 в точке (x, y), по секунде на каждую.
 * Промис выполняется в конце отсчёта. Нужен загруженный бандл game
 */
export function playCountdown(parent: Container, x: number, y: number) {
  const textures = [5, 4, 3, 2, 1].map((digit) => Texture.from(`num-stroke-${digit}`));
  const countdown = new AnimatedSprite({
    textures,
    anchor: 0.5,
    tint: 0xffd27f,
    // Кадров анимации за один кадр тикера: 1/60 — одна цифра в секунду при 60 FPS
    animationSpeed: 1 / 60,
    loop: false,
  });
  countdown.position.set(x, y);
  parent.addChild(countdown);

  // Каждая новая цифра выпрыгивает из большого размера
  const jump = () => gsap.fromTo(countdown.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out' });
  countdown.onFrameChange = jump;
  jump();

  return new Promise<void>((resolve) => {
    countdown.onComplete = () => {
      gsap.killTweensOf(countdown.scale);
      countdown.destroy();
      resolve();
    };
    countdown.play();
  });
}
