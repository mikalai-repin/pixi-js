/**
 * Логика сетки match-3 без PixiJS: только данные и правила.
 * Упрощённая версия Match3Utility из Puzzling Potions.
 */

/** Тип фишки: 1, 2, 3… — зелья, 0 — пустая клетка */
export type PieceType = number;

/** Сетка: grid[row][column] — тип фишки в клетке */
export type Grid = PieceType[][];

/** Клетка сетки */
export interface Position {
  row: number;
  column: number;
}

/** Создаёт сетку rows × columns из случайных типов */
export function createGrid(rows: number, columns: number, types: PieceType[]): Grid {
  const grid: Grid = [];
  for (let row = 0; row < rows; row++) {
    grid[row] = [];
    for (let column = 0; column < columns; column++) {
      grid[row][column] = getRandomType(types);
    }
  }
  return grid;
}

/** Случайный тип из списка */
export function getRandomType(types: PieceType[]) {
  return types[Math.floor(Math.random() * types.length)];
}

/** Тип фишки в клетке или undefined, если клетка за пределами сетки */
export function getType(grid: Grid, position: Position): PieceType | undefined {
  return grid[position.row]?.[position.column];
}

/** Записывает тип в клетку */
export function setType(grid: Grid, position: Position, type: PieceType) {
  grid[position.row][position.column] = type;
}

/** Меняет местами типы двух клеток */
export function swapTypes(grid: Grid, a: Position, b: Position) {
  const typeA = getType(grid, a);
  const typeB = getType(grid, b);
  if (typeA === undefined || typeB === undefined) return;
  setType(grid, a, typeB);
  setType(grid, b, typeA);
}

/** Лежит ли клетка внутри сетки */
export function isInside(grid: Grid, position: Position) {
  return position.row >= 0 && position.row < grid.length && position.column >= 0 && position.column < grid[0].length;
}

/** Сетка в виде текста для отладки: по строке на ряд, типы через вертикальную черту */
export function gridToString(grid: Grid) {
  return grid.map((cells) => '|' + cells.join('|') + '|').join('\n');
}
