import { sound, type PlayOptions } from '@pixi/sound';

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

/** Звуковые эффекты — одни на всю игру */
export const sfx = new SFX();
