import { applyGravity, getMatches, type Grid } from './grid';

let passed = 0;
let failed = 0;

/** Запускает один тест: функция должна выполниться без исключений */
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${name}: ${(error as Error).message}`);
  }
}

/** Сравнивает значения через JSON: подходит для чисел, массивов и простых объектов */
function expectEqual(actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`ожидали ${b}, получили ${a}`);
}

export function runTests() {
  test('нет совпадений — пустой список', () => {
    const grid: Grid = [
      [1, 2, 1],
      [2, 1, 2],
    ];
    expectEqual(getMatches(grid), []);
  });

  test('три в ряд по горизонтали', () => {
    const grid: Grid = [
      [1, 1, 1, 2],
      [2, 3, 2, 3],
    ];
    expectEqual(getMatches(grid), [
      [
        { row: 0, column: 0 },
        { row: 0, column: 1 },
        { row: 0, column: 2 },
      ],
    ]);
  });

  test('три в ряд по вертикали', () => {
    const grid: Grid = [
      [4, 1],
      [4, 2],
      [4, 3],
    ];
    expectEqual(getMatches(grid).length, 1);
    expectEqual(getMatches(grid)[0].length, 3);
  });

  test('четыре в ряд — одно совпадение из четырёх клеток', () => {
    const grid: Grid = [[2, 2, 2, 2, 1]];
    expectEqual(getMatches(grid).length, 1);
    expectEqual(getMatches(grid)[0].length, 4);
  });

  test('уголок — два совпадения с общей клеткой', () => {
    const grid: Grid = [
      [5, 5, 5],
      [5, 1, 2],
      [5, 2, 1],
    ];
    expectEqual(getMatches(grid).length, 2);
  });

  test('пустые клетки не образуют совпадений', () => {
    const grid: Grid = [[0, 0, 0, 1]];
    expectEqual(getMatches(grid), []);
  });

  test('гравитация: фишка падает на дно столбца', () => {
    const grid: Grid = [[3], [0], [0]];
    const moves = applyGravity(grid);
    expectEqual(grid, [[0], [0], [3]]);
    expectEqual(moves, [[{ row: 0, column: 0 }, { row: 2, column: 0 }]]);
  });

  test('гравитация: несколько дыр в одном столбце', () => {
    const grid: Grid = [[1], [0], [2], [0], [3]];
    applyGravity(grid);
    expectEqual(grid, [[0], [0], [1], [2], [3]]);
  });

  test('гравитация: полный столбец не меняется', () => {
    const grid: Grid = [[1], [2], [3]];
    expectEqual(applyGravity(grid), []);
  });

  console.log(`Тестов пройдено: ${passed}, упало: ${failed}`);
}
