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

/** Создаёт сетку rows × columns из случайных типов так, чтобы в ней не было готовых совпадений */
export function createGrid(rows: number, columns: number, types: PieceType[]): Grid {
  const grid: Grid = [];
  for (let row = 0; row < rows; row++) {
    grid[row] = [];
    for (let column = 0; column < columns; column++) {
      // Типы, которые уже пробовали для этой клетки и которые дают тройку
      const excluded: PieceType[] = [];
      let type = getRandomType(types);
      while (completesMatch(grid, { row, column }, type)) {
        excluded.push(type);
        type = getRandomType(types, excluded);
      }
      grid[row][column] = type;
    }
  }
  return grid;
}

/**
 * Даст ли тип тройку с двумя уже заполненными клетками слева или сверху.
 * Сетка заполняется слева направо и сверху вниз, поэтому справа и снизу ещё пусто
 */
function completesMatch(grid: Grid, position: Position, type: PieceType) {
  const { row, column } = position;
  const horizontal = type === grid[row]?.[column - 1] && type === grid[row]?.[column - 2];
  const vertical = type === grid[row - 1]?.[column] && type === grid[row - 2]?.[column];
  return horizontal || vertical;
}

/** Случайный тип из списка, кроме исключённых */
export function getRandomType(types: PieceType[], excluded: PieceType[] = []) {
  const allowed = types.filter((type) => !excluded.includes(type));
  return allowed[Math.floor(Math.random() * allowed.length)];
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
