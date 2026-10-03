# Архитектура платформы

Статический сайт без бэкенда. Весь код ученика выполняется в браузере.

## Интерфейс

```
┌─────────────────────┬──────────────────────────┬─────────────────────┐
│  Урок               │  [main.ts] [Piece.ts]    │                     │
│                     │                          │                     │
│  Заголовок   3 / 8 ▾│  редактор кода           │   превью (canvas)   │
│                     │                          │                     │
│  текст, код,        │                          │                     │
│  врезки             │                          ├─────────────────────┤
│                     │                          │  консоль / ошибки   │
│  [Решение] [Далее →]│  [▶ Запустить] [Сброс]   │                     │
└─────────────────────┴──────────────────────────┴─────────────────────┘
```

- Три колонки с перетаскиваемыми границами. На узком экране — вкладки «Урок / Код / Результат».
- Выпадающий список «3 / 8» — навигация по шагам главы; отдельное оглавление — по главам.
- Кнопка **«Решение»** показывает решение шага в редакторе (с подтверждением, что код ученика будет заменён; код ученика сохраняется, его можно вернуть).
- Кнопка **«Сброс»** возвращает стартовый код шага.
- Консоль под превью показывает `console.log` и ошибки кода ученика.

## Стек

| Задача | Решение | Почему |
|---|---|---|
| Сборка платформы | Vite + TypeScript | Быстро, нативные ES-модули |
| UI платформы | React | Состояние урока, панели, роутинг |
| Роутинг | `react-router`, URL вида `/:chapter/:step` | Шаг можно открыть по ссылке |
| Редактор | Monaco Editor | TS language service из коробки: автодополнение и подсказки по типам `pixi.js` — главный плюс для изучения API |
| Компиляция TS → JS | TS-воркер Monaco (`getEmitOutput`) | Без отдельного компилятора |
| Форматирование кода | Prettier 3.9.9 (`prettier/standalone` + плагины `typescript`, `estree`), грузится лениво при первом форматировании | Кнопка «Формат», Ctrl/Cmd + S и Shift + Alt + F; настройки `printWidth 120, singleQuote, trailingComma all` подобраны под стиль кода уроков (меняют 17 строк из 3672) |
| Панель файлов | Своя, в `CodeEditor.tsx` | Кнопка с иконкой папки и числом файлов слева от вкладок; список файлов шага (`main.ts` первым, остальные по алфавиту), выбор синхронизирован с вкладками, активная вкладка прокручивается в видимую область. Открытость хранится в `localStorage` (`pixi-course:file-tree-open`); на экране уже 700 px панель ложится поверх кода и закрывается после выбора |
| Markdown уроков | `markdown-it` + свои контейнеры + `shiki` для подсветки | Подсветка совпадает с редактором |
| Хранение прогресса | `localStorage` | Бэкенд не нужен |
| PixiJS в превью | Локальная копия `pixi.mjs` из `node_modules` в `public/vendor/` | Работает офлайн, версия зафиксирована |

GSAP (с главы 8): **`gsap@3.15.0`** в devDependencies, точная версия. Его ESM-файлы `copy-vendor.mjs` собирает esbuild-ом в один `public/vendor/gsap.mjs`. Типы для Monaco — все `node_modules/gsap/types/**/*.d.ts` через `import.meta.glob` (`file:///node_modules/gsap/types/…`, внутри — `declare module "gsap"`); `tsc` для уроков находит их сам.

`@pixi/ui` (с главы 10): **`@pixi/ui@2.4.1`** в devDependencies, точная версия. `copy-vendor.mjs` собирает `lib/index.mjs` вместе с зависимостью `tweedle.js` в `public/vendor/pixi-ui.mjs` с **`external: ['pixi.js']`**: библиотека использует ту же копию PixiJS из import map. Типы для Monaco — `node_modules/@pixi/ui/lib/**/*.d.ts` (без `stories`), точка входа `file:///node_modules/@pixi/ui/index.d.ts` с `export * from './lib/index'` и типы `tweedle.js`.

pixi-filters (с главы 12): **`pixi-filters@6.1.5`** в devDependencies, точная версия (6.x требует `pixi.js` 8). Готовая ESM-сборка `dist/pixi-filters.mjs` уже импортирует `pixi.js` как внешний модуль, поэтому `copy-vendor.mjs` просто копирует её (и `.map`) в `public/vendor/`. Типы для Monaco — `node_modules/pixi-filters/lib/**/*.d.ts`, точка входа `file:///node_modules/pixi-filters/index.d.ts` с `export * from './lib/index'` и типы `@types/gradient-parser` (их импортирует `CssGradientParser.d.ts`) как `file:///node_modules/gradient-parser/index.d.ts`. В минифицированной сборке имена классов изменены (`GlowFilter` → `zt`): в проверках не опираться на `constructor.name`.

Версия PixiJS: **`pixi.js@8.22.0`**, зафиксирована точно в `package.json` и `content/course.json` (оригинал требует `^8.14.1`, это совместимо). Типы для Monaco берутся из той же версии: собранный файл `node_modules/pixi.js/dist/pixi.js.d.ts` подключается как `file:///node_modules/pixi.js/index.d.ts`.

## Превью: как запускается код ученика

1. Платформа берёт все файлы шага из редактора и компилирует каждый `.ts` в JS через TS-воркер Monaco (`getEmitOutput`, со встроенными source map). Одновременно собираются синтаксические и семантические ошибки TypeScript: они выводятся в консоль превью с меткой `TS`, но **запуск не блокируют**.
2. Пересоздаёт `<iframe src="/preview.html">`. Каждый запуск — новый iframe: полная очистка состояния, WebGL-контекст гарантированно освобождается.
3. Через `postMessage` передаёт в iframe карту `{ "main.js": "<js>", "Piece.js": "<js>" }`.
4. `preview.html`:
   - содержит import map: `"pixi.js" → "/vendor/pixi.mjs"`, `"gsap" → "/vendor/gsap.mjs"`, `"@pixi/ui" → "/vendor/pixi-ui.mjs"`, `"pixi-filters" → "/vendor/pixi-filters.mjs"` (позже — `@pixi/sound`). Подмодули вроде `pixi.js/advanced-blend-modes` в import map нет: в курсе используются только встроенные режимы смешивания;
   - переписывает относительные импорты (`./Piece`) на blob-URL модулей с помощью `es-module-lexer` (с обходом зависимостей);
   - импортирует `main.js` как точку входа;
   - называет каждый модуль именем исходника (`//# sourceURL=Piece.ts`) и по встроенной source map переводит позиции в стеке ошибок обратно в строки `.ts`.
5. Перехватывает `console.*`, `window.onerror`, `unhandledrejection` и отправляет их родителю для консоли. Объекты PixiJS (огромные, с циклическими ссылками) выводятся кратко: `Sprite {…}`, `ObservablePoint { x, y }`.
6. **Циклические импорты между файлами шага не поддерживаются**: каждый модуль превращается в blob-URL, в который вписаны blob-URL его зависимостей, а для цикла такой порядок построить нельзя. `linkModules` выдаёт ошибку «Циклический импорт: A → B → A». В коде уроков экраны открывают друг друга по именам через реестр навигации (глава 11).

Среда превью — это обычные файлы `public/preview.html` и `public/preview-runtime.js` без сборщика. Причина: import map должна стоять в документе раньше любого модуля, а Vite в dev-режиме внедряет свой клиент.

Автозапуск: через 1 секунду после последнего изменения (с переключателем «Автозапуск»), плюс кнопка и `Ctrl/Cmd+Enter`.

Ассеты уроков лежат в `public/assets/` и в коде ученика загружаются по абсолютному пути: `Assets.load('/assets/game/piece-dragon.png')`.

На узком экране превью при открытии вкладки «Результат» перезапускается: скрытый iframe имеет нулевой размер, и код, который читает `app.screen` при старте, расставил бы объекты неверно.

### Соглашение для кода уроков

Стартовый `main.ts` каждого шага создаёт приложение так:

```ts
const app = new Application();
await app.init({ background: '#1e1035', resizeTo: window });
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app; // для PixiJS DevTools и проверок шагов
```

Строка с `__PIXI_APP__` объясняется в шаге 1.6, до этого ученик её просто видит в шаблоне.

## Проверка шагов (опционально)

Шаг может содержать `check.ts`. Это функция, которая получает `app` и проверяет **состояние сцены**, а не текст кода:

```ts
export default function check(app: Application): CheckResult {
  const sprite = app.stage.children.find((c) => c instanceof Sprite);
  if (!sprite) return { pass: false, hint: 'На сцене нет ни одного спрайта' };
  if (sprite.anchor.x !== 0.5) return { pass: false, hint: 'Якорь спрайта ещё не по центру' };
  return { pass: true };
}
```

Проверка выполняется внутри iframe через ~500 мс после запуска (и повторно по кнопке «Проверить»). Результат показывается под уроком. На первом этапе проверки есть не у всех шагов: в основном у практикумов.

## Загрузка контента

Уроки лежат в `content/` (формат — в `lesson-format.md`) и подключаются на этапе сборки через `import.meta.glob('/content/**/*', { query: '?raw', eager: true })`.

`npm run validate` проверяет контент:
- `scripts/validate-content.mjs`: у каждого шага есть `lesson.md` с `title`, `start/main.ts`; `start/` шага N+1 совпадает с `solution/` шага N (если нет `startFrom: custom`);
- `tsc -p tsconfig.content.json`: весь код уроков (start и solution) типизируется по настоящему `pixi.js`. Глобальные объявления для уроков — `content/globals.d.ts`.

## Прогресс ученика

В `localStorage` под ключом `pixi-course:v1` хранятся:
- код ученика по каждому шагу (`{ [stepId]: { [file]: code } }`);
- пройденные шаги;
- последний открытый шаг.

## Структура исходников платформы

```
src/
  main.tsx
  app/            — роутинг, макет из трёх панелей
  lesson/         — рендер markdown, навигация по шагам
  editor/         — Monaco, вкладки файлов, типы pixi.js
  preview/        — управление iframe, консоль, протокол сообщений
  content/        — загрузка и индексация content/
  progress/       — работа с localStorage
public/
  preview.html    — среда выполнения кода ученика
  vendor/         — pixi.mjs и прочие библиотеки для превью
  assets/         — ассеты уроков
scripts/
  copy-vendor.mjs      — копирует pixi.mjs, pixi-filters.mjs и es-module-lexer и собирает gsap.mjs и pixi-ui.mjs в public/vendor (запускается перед dev/build)
  validate-content.mjs — проверка структуры уроков
  build-assets.mjs     — сборка ресурсов оригинала через AssetPack в public/assets/packed (+ manifest-basic.json)
  fetch-reference.mjs  — скачивание эталона open-games в reference/
```

## Браузерные проверки

`tools/e2e/` — скрипты на puppeteer-core, которые запускают системный Chrome в headless-режиме с программным WebGL (swiftshader):

- `lib.mjs` — общие функции: компиляция папки шага через esbuild, открытие чистого `preview.html` 500 × 600 и запуск кода через тот же протокол `postMessage`, что у платформы;
- `run-dir.mjs` — один шаг: консоль и скриншот;
- `run-chapter.mjs` — все шаги главы в интерфейсе платформы с нажатием «Решение»;
- `checks/` — тематические проверки глав (мышь, игровая логика).

Результаты складываются в `tools/e2e/out/` (в `.gitignore`).

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер на http://localhost:5173 |
| `npm run build` | Проверка типов платформы и сборка в `dist/` |
| `npm run validate` | Проверка контента и типов кода уроков |
| `npm run typecheck` | Только типы платформы |

## Подводные камни

- **Monaco 0.57**: API TypeScript находится в `monaco.typescript`, а не в `monaco.languages.typescript`. Воркеры импортируются как `monaco-editor/editor/editor.worker.js?worker` и `monaco-editor/language/typescript/ts.worker.js?worker`.
- **Vite `optimizeDeps.include`**: все динамически импортируемые модули (языки и темы Shiki, Monaco) должны быть перечислены явно, иначе после первого запуска Vite пересобирает зависимости, и открытая страница падает с «Failed to fetch dynamically imported module».
- **Синхронизация моделей с TS-воркером**: воркер Monaco получает все модели только при своём создании (`eagerModelSync`), а дальше каждый запрос передаёт ему лишь свой файл. При переходе на другой шаг модели создаются разом, и проверка `main.ts` успевала пройти до того, как воркер узнавал о соседних файлах: «Cannot find module './Label'», и маркеры не пересчитывались. Поэтому `compileStep` сначала синхронизирует все файлы шага (`getWorker(...uris)`), а `refreshDiagnostics` после создания моделей синхронизирует их и меняет служебную extra-lib `file:///course-revalidate.d.ts` — это пересчитывает маркеры, не перезапуская воркер (смена настроек компилятора перезапустила бы его).
- **«TypeScript not registered!»**: при первой загрузке TS-воркер Monaco может быть не готов; `compileStep` повторяет попытку получить его.
- **Кириллица в Monaco**: отключён `unicodeHighlight.ambiguousCharacters`, иначе русские комментарии подсвечиваются как подозрительные.
- **Shiki** подключается через `shiki/core` с выбранными языками: полный бандл тянет ~200 грамматик.
