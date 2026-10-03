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
    // Ресурсы нового экрана. Уже загруженные бандлы Assets второй раз не грузит
    if (ctor.assetBundles) await Assets.loadBundle(ctor.assetBundles);
    if (this.currentScreen) await this.removeScreen(this.currentScreen);
    this.currentScreen = new ctor();
    await this.addScreen(this.currentScreen);
  }

  /** Размер экрана изменился: передаём его текущему экрану */
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.currentScreen?.resize?.(width, height);
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
