// Скачивает эталон pixijs/open-games в reference/open-games на зафиксированном коммите.
// Папка не хранится в git: это чужой код, который всегда можно получить заново.
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = '83b46762a5572430a94c01091353d0fa3d9909a4'; // 2025-11-11
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'reference/open-games');

if (existsSync(target)) {
  console.log('[reference] reference/open-games уже есть, пропускаем. Удалите папку, чтобы скачать заново.');
  process.exit(0);
}

const run = (command) => execSync(command, { stdio: 'inherit', cwd: root });
run(`git clone --filter=blob:none --no-checkout https://github.com/pixijs/open-games "${target}"`);
run(`git -C "${target}" checkout --quiet ${COMMIT}`);
// Без .git, чтобы редактор не показывал вложенный репозиторий
rmSync(resolve(target, '.git'), { recursive: true, force: true });
console.log(`[reference] готово: reference/open-games @ ${COMMIT.slice(0, 7)}`);
