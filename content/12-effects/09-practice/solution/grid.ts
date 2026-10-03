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

/** Спецфишки: полоса сжигает свой ряд, бомба — всё вокруг себя. Их типы идут после шести зелий */
export const SPECIAL_ROW = 7;
export const SPECIAL_BLAST = 8;

/** Спецфишка ли это */
export function isSpecial(type: PieceType | undefined) {
  return type === SPECIAL_ROW || type === SPECIAL_BLAST;
}

/** Спецфишка, которая должна появиться в клетке */
export interface SpecialSpawn {
  position: Position;
  type: PieceType;
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

/** Копия сетки: её можно менять, не трогая оригинал */
export function cloneGrid(grid: Grid): Grid {
  return grid.map((cells) => cells.slice());
}

/** Сетка в виде текста для отладки: по строке на ряд, типы через вертикальную черту */
export function gridToString(grid: Grid) {
  return grid.map((cells) => '|' + cells.join('|') + '|').join('\n');
}

/** Одна и та же ли это клетка */
export function samePosition(a: Position, b: Position) {
  return a.row === b.row && a.column === b.column;
}

/**
 * Все совпадения в сетке: группы из matchSize и более одинаковых фишек подряд
 * по горизонтали или вертикали. Пустые клетки (0) и спецфишки совпадений не образуют.
 * Если передан filter, возвращаются только совпадения, в которые входит хотя бы одна из этих клеток.
 */
export function getMatches(grid: Grid, filter?: Position[], matchSize = 3): Position[][] {
  const all = [...getLineMatches(grid, matchSize, 'horizontal'), ...getLineMatches(grid, matchSize, 'vertical')];
  if (!filter) return all;
  return all.filter((match) => match.some((position) => filter.some((f) => samePosition(position, f))));
}

/** Совпадения только в строках или только в столбцах */
function getLineMatches(grid: Grid, matchSize: number, orientation: 'horizontal' | 'vertical') {
  const matches: Position[][] = [];
  const rows = grid.length;
  const columns = grid[0].length;
  // Внешний цикл идёт по линиям (строкам или столбцам), внутренний — вдоль линии
  const lines = orientation === 'horizontal' ? rows : columns;
  const length = orientation === 'horizontal' ? columns : rows;

  for (let line = 0; line < lines; line++) {
    let current: Position[] = [];
    let currentType: PieceType | undefined;

    for (let step = 0; step < length; step++) {
      const position = orientation === 'horizontal' ? { row: line, column: step } : { row: step, column: line };
      const type = getType(grid, position);

      if (type && !isSpecial(type) && type === currentType) {
        // Тот же тип — серия продолжается
        current.push(position);
      } else {
        // Другой тип — серия закончилась. Если она достаточно длинная, это совпадение
        if (current.length >= matchSize) matches.push(current);
        current = [position];
        currentType = type;
      }
    }
    // Серия, дошедшая до конца линии
    if (current.length >= matchSize) matches.push(current);
  }

  return matches;
}

/**
 * Опускает фишки на пустые клетки под ними.
 * Возвращает список перемещений [откуда, куда], чтобы вид мог передвинуть фишки так же
 */
export function applyGravity(grid: Grid): [Position, Position][] {
  const moves: [Position, Position][] = [];
  const rows = grid.length;
  const columns = grid[0].length;

  for (let column = 0; column < columns; column++) {
    // Идём снизу вверх и запоминаем самую нижнюю свободную клетку столбца
    let emptyRow = rows - 1;
    for (let row = rows - 1; row >= 0; row--) {
      const type = grid[row][column];
      if (type === 0) continue;
      if (row !== emptyRow) {
        grid[emptyRow][column] = type;
        grid[row][column] = 0;
        moves.push([{ row, column }, { row: emptyRow, column }]);
      }
      emptyRow--;
    }
  }

  return moves;
}

/**
 * Заполняет пустые клетки новыми случайными типами.
 * Возвращает новые клетки снизу вверх: так их удобнее «ронять» в главе 8
 */
export function fillUp(grid: Grid, types: PieceType[]): Position[] {
  // Берём типы из свежей сетки без совпадений, чтобы досыпанные фишки не давали тройки сами по себе
  const source = createGrid(grid.length, grid[0].length, types);
  const filled: Position[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let column = 0; column < grid[0].length; column++) {
      if (grid[row][column] === 0) {
        grid[row][column] = source[row][column];
        filled.push({ row, column });
      }
    }
  }
  return filled.reverse();
}

/**
 * Где появятся спецфишки после этих совпадений:
 * на пересечении двух совпадений — бомба, в середине совпадения из четырёх и больше — полоса
 */
export function getSpecialSpawns(matches: Position[][]): SpecialSpawn[] {
  const spawns: SpecialSpawn[] = [];
  // Клетка, общая для двух совпадений, — пересечение: крест, уголок или буква Т
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      const cross = matches[i].find((a) => matches[j].some((b) => samePosition(a, b)));
      if (cross) spawns.push({ position: cross, type: SPECIAL_BLAST });
    }
  }
  for (const match of matches) {
    if (match.length < 4) continue;
    // Совпадение, которое уже дало бомбу, вторую спецфишку не даёт
    if (spawns.some((spawn) => match.some((position) => samePosition(position, spawn.position)))) continue;
    spawns.push({ position: match[Math.floor(match.length / 2)], type: SPECIAL_ROW });
  }
  return spawns;
}

/** Клетки, которые сжигает спецфишка type, стоящая в клетке position. Сама клетка спецфишки тоже входит */
export function getSpecialArea(grid: Grid, position: Position, type: PieceType): Position[] {
  if (type === SPECIAL_ROW) {
    return grid[position.row].map((_, column) => ({ row: position.row, column }));
  }
  // Бомба: ромб радиусом 2 клетки, как Match3SpecialBlast в Puzzling Potions
  const area: Position[] = [];
  for (let row = position.row - 2; row <= position.row + 2; row++) {
    for (let column = position.column - 2; column <= position.column + 2; column++) {
      const cell = { row, column };
      const distance = Math.abs(row - position.row) + Math.abs(column - position.column);
      if (distance <= 2 && isInside(grid, cell)) area.push(cell);
    }
  }
  return area;
}
