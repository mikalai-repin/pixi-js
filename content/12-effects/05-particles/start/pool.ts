/**
 * Пул: склад объектов для повторного использования. get выдаёт свободный объект
 * или создаёт новый, giveBack возвращает объект на склад.
 * Как Pool в Puzzling Potions, но новые объекты создаёт переданная функция
 */
export class Pool<T> {
  /** Свободные объекты */
  private readonly items: T[] = [];
  /** Сколько объектов пул создал за всё время */
  created = 0;

  constructor(private readonly create: () => T) {}

  /** Свободный объект со склада, а если склад пуст — новый */
  get(): T {
    const item = this.items.pop();
    if (item !== undefined) return item;
    this.created++;
    return this.create();
  }

  /** Возвращает объект на склад */
  giveBack(item: T) {
    // Объект, сданный дважды, выдали бы двум владельцам сразу
    if (!this.items.includes(item)) this.items.push(item);
  }
}
