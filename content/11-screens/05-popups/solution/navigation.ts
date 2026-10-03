import { Assets, Container, Ticker } from 'pixi.js';
import { app } from './app';

/**
 * Экран игры: меню, игра, результат, попап. Все методы необязательные —
 * у каждого экрана свой набор. Вызывает их навигация. Как AppScreen в Puzzling Potions
 */
export interface AppScreen extends Container {
  /** Экран уже на сцене, но ещё не показан: расставить начальное состояние */
  prepare?(): void;
  /** Анимация появления. Навигация дождётся её конца */
  show?(): Promise<void>;
  /** Анимация исчезновения. После неё экран уничтожат */
  hide?(): Promise<void>;
  /** Каждый кадр, пока экран на сцене */
  update?(ticker: Ticker): void;
  /** Изменился размер экрана */
  resize?(width: number, height: number): void;
  /** Поверх экрана открылся попап: остановить игру */
  pause?(): void;
  /** Попап закрылся: продолжить игру */
  resume?(): void;
}

/** Класс экрана: его можно создать без аргументов, а статическое поле перечисляет нужные бандлы */
export interface AppScreenConstructor {
  new (): AppScreen;
  assetBundles?: string[];
}

/**
 * Навигация: показывает один экран за раз, загружает его ресурсы,
 * передаёт ему кадры тикера и размер экрана. Упрощённая версия Navigation из Puzzling Potions
 */
class Navigation {
  /** Все экраны лежат в этом контейнере */
  readonly container = new Container();
  /** Текущий экран */
  currentScreen?: AppScreen;
  /** Попап поверх текущего экрана: пауза, настройки */
  currentPopup?: AppScreen;
  /** Экран загрузки: показывается, пока грузятся бандлы следующего экрана */
  loadScreen?: new () => AppScreen & { setProgress(progress: number): void };
  /** Бандлы, которые уже загружены */
  private readonly loadedBundles = new Set<string>();
  /** Экраны по именам: так экранам не нужно импортировать друг друга */
  private readonly screens = new Map<string, AppScreenConstructor>();
  private width = 0;
  private height = 0;

  /** Запоминает класс экрана под именем, по которому его потом можно показать */
  register(name: string, ctor: AppScreenConstructor) {
    this.screens.set(name, ctor);
  }

  /** Убирает текущий экран и показывает экран с этим именем */
  async showScreen(name: string) {
    const ctor = this.screens.get(name);
    if (!ctor) throw new Error(`Экран «${name}» не зарегистрирован`);
    // Пока идёт смена, старый экран не должен реагировать на нажатия
    if (this.currentScreen) this.currentScreen.interactiveChildren = false;
    // Ресурсы нового экрана: если их ещё нет, на время загрузки показываем экран загрузки
    const bundles = ctor.assetBundles ?? [];
    const missing = bundles.filter((name) => !this.loadedBundles.has(name));
    if (missing.length > 0) {
      if (this.currentScreen) await this.removeScreen(this.currentScreen);
      this.currentScreen = undefined;
      const loadScreen = this.loadScreen ? new this.loadScreen() : undefined;
      if (loadScreen) await this.addScreen(loadScreen);
      await Assets.loadBundle(missing, (progress) => loadScreen?.setProgress(progress));
      missing.forEach((name) => this.loadedBundles.add(name));
      if (loadScreen) await this.removeScreen(loadScreen);
    }
    if (this.currentScreen) await this.removeScreen(this.currentScreen);
    this.currentScreen = new ctor();
    await this.addScreen(this.currentScreen);
  }

  /** Размер экрана изменился: передаём его текущему экрану */
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.currentScreen?.resize?.(width, height);
    this.currentPopup?.resize?.(width, height);
  }

  /** Тихо загружает бандлы заранее, пока игрок занят текущим экраном */
  async preload(bundles: string[]) {
    await Assets.loadBundle(bundles);
    bundles.forEach((name) => this.loadedBundles.add(name));
  }

  /** Показывает попап поверх текущего экрана, а экран ставит на паузу */
  async presentPopup(ctor: AppScreenConstructor) {
    if (this.currentPopup) return;
    if (this.currentScreen) {
      this.currentScreen.interactiveChildren = false;
      this.currentScreen.pause?.();
    }
    this.currentPopup = new ctor();
    await this.addScreen(this.currentPopup);
  }

  /** Закрывает попап и продолжает текущий экран */
  async dismissPopup() {
    const popup = this.currentPopup;
    if (!popup) return;
    await this.removeScreen(popup);
    this.currentPopup = undefined;
    if (this.currentScreen) {
      this.currentScreen.interactiveChildren = true;
      this.currentScreen.resume?.();
    }
  }

  /** Добавляет экран на сцену и проводит его по жизненному циклу до конца show */
  private async addScreen(screen: AppScreen) {
    if (!this.container.parent) app.stage.addChild(this.container);
    this.container.addChild(screen);
    screen.prepare?.();
    screen.resize?.(this.width, this.height);
    if (screen.update) app.ticker.add(screen.update, screen);
    if (screen.show) {
      // Во время анимации появления нажимать ничего нельзя
      screen.interactiveChildren = false;
      await screen.show();
      screen.interactiveChildren = true;
    }
  }

  /** Прячет экран, отключает его от тикера и уничтожает */
  private async removeScreen(screen: AppScreen) {
    screen.interactiveChildren = false;
    if (screen.hide) await screen.hide();
    if (screen.update) app.ticker.remove(screen.update, screen);
    screen.destroy({ children: true });
  }
}

/** Навигация одна на всю игру */
export const navigation = new Navigation();
