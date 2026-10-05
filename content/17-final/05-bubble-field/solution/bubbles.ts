/**
 * Модель игры: сетка пузырей и полёт выстрела. Здесь нет PixiJS — только числа,
 * поэтому правила можно проверять без экрана. Как grid.ts в Puzzling Potions
 */

/** Цвет пузыря: 1–4, 0 — пустая клетка */
export type BubbleType = number;
/** grid[row][column] — цвет пузыря в клетке */
export type BubbleGrid = BubbleType[][];

export interface Cell {
  row: number;
  column: number;
}

/** Имена текстур пузырей. Цвет в сетке — индекс в этом массиве плюс один */
export const BUBBLE_NAMES = ['bubble-red', 'bubble-green', 'bubble-blue', 'bubble-yellow'];
/** Цвета для тонирования тени и пушки, как bubbleTypeToColor в Bubbo Bubbo */
export const BUBBLE_COLORS = [0xff5f5f, 0x58ff2e, 0x6473ff, 0xffca42];

/** Диаметр пузыря и его радиус */
export const BUBBLE_SIZE = 40;
export const RADIUS = BUBBLE_SIZE / 2;
/** Пузырей в чётном ряду. Нечётные ряды сдвинуты на радиус вправо, и в них на один пузырь меньше */
export const COLUMNS = 10;
/** Рядов в сетке. Проигрыш наступает раньше, на линии из BubbleGame: нижние ряды — запас */
export const ROWS = 14;
/** Расстояние между рядами: в шестиугольной укладке ряды ближе, чем диаметр, — на √3 / 2 */
export const ROW_HEIGHT = (BUBBLE_SIZE * Math.sqrt(3)) / 2;
/** Ширина поля между стенами */
export const FIELD_WIDTH = COLUMNS * BUBBLE_SIZE;

/** Сколько клеток в ряду */
export function columnsIn(row: number) {
  return row % 2 === 0 ? COLUMNS : COLUMNS - 1;
}

/** Есть ли такая клетка в сетке */
export function isInside(cell: Cell) {
  return cell.row >= 0 && cell.row < ROWS && cell.column >= 0 && cell.column < columnsIn(cell.row);
}

/** Цвет в клетке, 0 — пусто или клетки нет */
export function getType(grid: BubbleGrid, cell: Cell): BubbleType {
  return isInside(cell) ? grid[cell.row][cell.column] : 0;
}

/** Сетка из ROWS рядов: верхние filledRows заполнены случайными цветами из types, остальные пусты */
export function createBubbleGrid(filledRows: number, types: BubbleType[]): BubbleGrid {
  const grid: BubbleGrid = [];
  for (let row = 0; row < ROWS; row++) {
    const cells: BubbleType[] = [];
    for (let column = 0; column < columnsIn(row); column++) {
      cells.push(row < filledRows ? types[Math.floor(Math.random() * types.length)] : 0);
    }
    grid.push(cells);
  }
  return grid;
}

/** Центр клетки в координатах сетки: левый верхний угол сетки — (0, 0) */
export function cellToPoint(cell: Cell) {
  const shift = cell.row % 2 === 0 ? 0 : RADIUS;
  return { x: RADIUS + shift + cell.column * BUBBLE_SIZE, y: RADIUS + cell.row * ROW_HEIGHT };
}
