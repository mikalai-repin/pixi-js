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

  // TODO: тесты из задания

  console.log(`Тестов пройдено: ${passed}, упало: ${failed}`);
}
