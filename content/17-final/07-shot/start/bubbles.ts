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

/** Все клетки сетки по порядку */
export function allCells() {
  const cells: Cell[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < columnsIn(row); column++) cells.push({ row, column });
  }
  return cells;
}

/**
 * Шесть соседей клетки. Не забудьте, что нечётные ряды сдвинуты вправо
 */
export function getNeighbors(cell: Cell): Cell[] {
  // TODO
  return [];
}

/**
 * Свободная клетка, ближайшая к точке (x, y), куда может встать пузырь: в верхнем ряду
 * (держится за потолок) или рядом с другим пузырём
 */
export function findSnapCell(grid: BubbleGrid, x: number, y: number): Cell | null {
  // TODO
  return null;
}

/** Цвета, которые ещё есть на поле: пушка заряжается только ими, иначе бывают безнадёжные выстрелы */
export function typesOnBoard(grid: BubbleGrid): BubbleType[] {
  return [...new Set(grid.flat().filter((type) => type !== 0))];
}

/** Летящий пузырь: позиция в координатах сетки и направление полёта (вектор длины 1) */
export interface Shot {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** Шаг движения выстрела: столько пикселей за раз, чтобы не проскочить пузырь насквозь */
const STEP = 4;
/** Выстрел останавливается, чуть зайдя на пузырь: так легче протиснуться в щель. В Bubbo Bubbo — 0,9 */
const HIT_DISTANCE = BUBBLE_SIZE * 0.85;

/**
 * Двигает выстрел на distance пикселей: отражается от стен, останавливается у потолка или у пузыря.
 * Возвращает true, если выстрел во что-то врезался. Этим же кодом рисуется прицел: он не врёт
 */
export function advanceShot(grid: BubbleGrid, shot: Shot, distance: number) {
  for (let travelled = 0; travelled < distance; travelled += STEP) {
    shot.x += shot.dx * Math.min(STEP, distance - travelled);
    shot.y += shot.dy * Math.min(STEP, distance - travelled);
    // Стена: пузырь отражается, как свет от зеркала, — меняется знак горизонтальной скорости
    if (shot.x < RADIUS) {
      shot.x = 2 * RADIUS - shot.x;
      shot.dx = Math.abs(shot.dx);
    } else if (shot.x > FIELD_WIDTH - RADIUS) {
      shot.x = 2 * (FIELD_WIDTH - RADIUS) - shot.x;
      shot.dx = -Math.abs(shot.dx);
    }
    if (shot.y <= RADIUS) return true;
    if (hitsBubble(grid, shot)) return true;
  }
  return false;
}

/** Касается ли выстрел какого-нибудь пузыря. Проверяем только ряды рядом с ним */
function hitsBubble(grid: BubbleGrid, shot: Shot) {
  const row = Math.round((shot.y - RADIUS) / ROW_HEIGHT);
  for (let r = row - 1; r <= row + 1; r++) {
    for (let column = 0; column < columnsIn(r); column++) {
      const cell = { row: r, column };
      if (getType(grid, cell) === 0) continue;
      const point = cellToPoint(cell);
      if (Math.hypot(point.x - shot.x, point.y - shot.y) < HIT_DISTANCE) return true;
    }
  }
  return false;
}
