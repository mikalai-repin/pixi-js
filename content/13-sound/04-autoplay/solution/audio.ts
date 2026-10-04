import { sound, type PlayOptions, type Sound } from '@pixi/sound';
import gsap from 'gsap';

/** Сколько секунд длится переход от одной музыки к другой */
const FADE_TIME = 1;

/**
 * Фоновая музыка: одна дорожка играет по кругу. Новая дорожка плавно сменяет старую.
 * Как BGM в Puzzling Potions
 */
class BGM {
  /** Псевдоним дорожки, которая играет сейчас */
  currentAlias?: string;
  /** Сама дорожка */
  current?: Sound;
  /** Громкость музыки: от 0 до 1 */
  private volume = 1;

  /** Включает музыку. Если играет другая, она плавно затихает, а новая плавно нарастает */
  play(alias: string, options?: PlayOptions) {
    // Эта музыка уже играет: не начинаем её сначала
    if (this.currentAlias === alias) return;

    if (this.current) {
      const previous = this.current;
      gsap.killTweensOf(previous);
      gsap.to(previous, { volume: 0, duration: FADE_TIME, ease: 'linear' }).then(() => previous.stop());
    }

    this.currentAlias = alias;
    this.current = sound.find(alias);
    // Громкость Sound действует на все его копии: начинаем с тишины и плавно её поднимаем
    this.current.volume = 0;
    this.current.play({ loop: true, ...options });
    gsap.killTweensOf(this.current);
    gsap.to(this.current, { volume: this.volume, duration: FADE_TIME, ease: 'linear' });
  }
}

/**
 * Звуковые эффекты: короткие одноразовые звуки. Своя громкость позволит
 * настраивать эффекты отдельно от музыки. Как SFX в Puzzling Potions
 */
class SFX {
  /** Громкость эффектов: от 0 до 1 */
  private volume = 1;

  /** Играет звук один раз. Громкость из options умножается на громкость эффектов */
  play(alias: string, options?: PlayOptions) {
    const volume = this.volume * (options?.volume ?? 1);
    sound.play(alias, { ...options, volume });
  }
}

/** Фоновая музыка — одна на всю игру */
export const bgm = new BGM();

/** Звуковые эффекты — одни на всю игру */
export const sfx = new SFX();

/**
 * Браузер ещё не разрешил звук: контекст WebAudio ждёт первого нажатия на страницу.
 * Пауза из-за того, что окно ушло в фон, — не в счёт: тогда sound.context.paused равно true
 */
export function isAudioLocked() {
  return sound.context.audioContext.state === 'suspended' && !sound.context.paused;
}
