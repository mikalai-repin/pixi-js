# Формат уроков

## Структура на диске

```
content/
  course.json                     — порядок глав
  01-first-app/
    chapter.json                  — название, описание, порядок шагов
    01-what-is-pixi/
      lesson.md
      start/
        main.ts
      solution/
        main.ts
    02-application/
      lesson.md
      start/main.ts
      solution/main.ts
      check.ts                    — необязательно
  02-sprites/
    ...
```

Правила именования:
- Папки глав и шагов: `NN-slug`, где `slug` — латиница в kebab-case. Номер задаёт порядок, slug идёт в URL (`/sprites/anchor`).
- Файлы кода — `.ts`. Точка входа всегда `main.ts`. Импорты между файлами пишутся **без расширения**: `import { Piece } from './Piece'`.
- Вкладки в редакторе идут в порядке, указанном в `files` во frontmatter, иначе по алфавиту, при этом `main.ts` всегда первая.

## `course.json`

```json
{
  "title": "PixiJS по-русски",
  "pixiVersion": "8.22.0",
  "chapters": ["01-first-app", "02-sprites", "03-containers"]
}
```

## `chapter.json`

```json
{
  "title": "Спрайты",
  "description": "Выводим картинки на экран и разбираемся с трансформациями.",
  "part": 1
}
```

Шаги берутся из подпапок по порядку номеров.

## `lesson.md`

### Frontmatter

```yaml
---
title: Якорь
files: [main.ts]          # видимые вкладки и их порядок (необязательно)
readonly: []              # файлы, которые ученик видит, но не редактирует
focus: main.ts            # какая вкладка открыта при входе
startFrom: previous       # previous (по умолчанию) | custom
api: [Sprite.anchor]      # какие API вводит шаг — для оглавления и поиска
noSolution: true          # шаг без задания (демо, теория): папки solution/ нет
---
```

`startFrom: previous` означает, что `start/` должен совпадать с `solution/` предыдущего шага (это проверяет валидатор). `custom` используется в начале главы или когда между шагами нужна «закадровая» подготовка кода (например, добавлен вспомогательный файл). Такая подготовка обязательно описывается в тексте шага.

### Тело

Обычный Markdown плюс контейнеры:

```md
::: tip
Короткий совет.
:::

::: warning
Частая ошибка или ловушка.
:::

::: deep Под капотом: как устроена Texture
Необязательный подробный блок. По умолчанию свёрнут.
:::

::: task
Что ученик должен сделать в редакторе в этом шаге.
:::

::: hint Подсказка 1: как посчитать позиции
Сворачиваемая подсказка к практикуму. Подсказки идут от общей к конкретной.
:::
```

Блоки кода с указанием файла и выделением строк:

````md
```ts main.ts {3-4}
const dragon = new Sprite(texture);
app.stage.addChild(dragon);
dragon.anchor.set(0.5);
dragon.position.set(app.screen.width / 2, app.screen.height / 2);
```
````

Ссылки на API ведут на официальную документацию: `[Sprite](https://pixijs.download/release/docs/scene.Sprite.html)`. Перед публикацией ссылку проверяем.

Внутренние ссылки на другие шаги: `[шаг про якорь](step:02-sprites/04-anchor)`.

## `start/` и `solution/`

- Полные снимки всех файлов шага, без диффов: так проще читать и проверять.
- `start/` — с чего ученик начинает. Места, которые нужно дописать, отмечаются комментарием `// TODO: ...` на русском.
- `solution/` — эталон. Он должен запускаться без ошибок и без предупреждений TypeScript.
- Файлы, которые не меняются в шаге, всё равно лежат в обеих папках.

## `check.ts` (необязательно)

```ts
import type { Application } from 'pixi.js';
import type { CheckResult } from '@course/check';

export default function check(app: Application): CheckResult {
  // проверяем состояние сцены
  return { pass: true };
}
```

- Проверяем **результат** (сцену), а не текст кода.
- Каждая проверка `pass: false` содержит `hint` на русском: что не так и куда смотреть, без готового ответа.

## Ассеты

- Лежат в `public/assets/`, в коде указываются абсолютным путём `/assets/...`.
- Папки повторяют бандлы оригинала: `preload/`, `game/`, `common/`, `home/`, `result/`. Внутри — отдельные PNG (атласы оригинала разложены), звуки и файлы Spine. Пример: `/assets/game/piece-dragon.png`, `/assets/preload/background.png`, `/assets/common/button-large.png`.
- С главы 5 — ресурсы, собранные AssetPack (`npm run assets`, скрипт `scripts/build-assets.mjs`): `public/assets/packed/`. Там атласы в webp/png и `@0.5x`, звуки в mp3/ogg и два манифеста:
  - `manifest.json` — полный, со звуками и Spine (с главы 13);
  - `manifest-basic.json` — без звуков и Spine. Используется в главах 5–12, чтобы без `@pixi/sound` и плагина Spine не было предупреждений о неизвестных файлах.
- Имена кадров в атласах совпадают с именами файлов оригинала без расширения: `piece-dragon`, `highlight`, `icon-pause`, `logo-pixi`. Псевдонимы атласов: `game-atlas`, `common-atlas` и т. д.
- `packed/` хранится в git. Пересобирать только при изменении ресурсов; хеши в именах файлов зависят от содержимого.
- Происхождение каждого файла фиксируется в `public/assets/CREDITS.md`.
