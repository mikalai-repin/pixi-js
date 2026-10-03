# Оригинал: Puzzling Potions

Источник: `reference/open-games/puzzling-potions` — копия [pixijs/open-games](https://github.com/pixijs/open-games), коммит `83b4676` (2025-11-11). Автор игры — [Mauro](https://github.com/maurodetarso). Лицензия MIT; в курсе обязательно указываем авторство и ссылку.

Оригинальный Figma-файл доступен только для просмотра, использовать его ресурсы **нельзя**. Можно использовать ассеты из репозитория (`raw-assets`): они распространяются под MIT вместе с кодом.

## Общие данные

- Около 7 000 строк TypeScript в `src/`.
- Зависимости: `pixi.js ^8.14.1`, `@pixi/ui`, `@pixi/sound`, `gsap` (28 импортов), `@esotericsoftware/spine-pixi-v8`.
- Сборка: Vite + AssetPack (`.assetpack.js` → `public/assets/` + `assets-manifest.json`).
- API PixiJS, которые используются (по числу импортов): `Container` (32), `Sprite` (17), `Texture` (16), `NineSliceSprite` (5), `Graphics` (3), `BlurFilter` (3), `Ticker`, `Text`, `TilingSprite`, `TextStyle`, `FederatedPointerEvent`, `Assets`, `AssetsManifest`, `Application`.

Вывод: сама игра использует небольшую часть PixiJS. Поэтому курс **шире** игры (см. карту покрытия в course-plan.md): BitmapText, ParticleContainer, маски, фильтры, Mesh, RenderTexture и рендер-группы изучаются через врезки и учебные демо.

## Структура `src/`

| Путь | Что делает |
|---|---|
| `main.ts` | Создаёт `Application`, ресайз с минимальным размером 375×700, `visibilitychange`, запуск навигации |
| `utils/assets.ts` | Загрузка манифеста, бандлы, фоновая загрузка |
| `utils/navigation.ts` | Менеджер экранов и попапов (интерфейс `AppScreen`) |
| `utils/pool.ts` | Пул объектов |
| `utils/animation.ts` | Хелперы GSAP, `earthquake` (тряска), кастомные кривые |
| `utils/asyncUtils.ts` | `AsyncQueue`, `waitFor` |
| `utils/audio.ts` | Обёртка над `@pixi/sound`: `bgm`, `sfx` |
| `utils/storage.ts`, `userSettings.ts`, `userStats.ts` | Сохранение настроек и рекордов |
| `match3/Match3.ts` | Корневой класс игры (наследник `Container`), собирает подсистемы и колбэки `onMove/onMatch/onPop/...` |
| `match3/Match3Config.ts` | Режимы (`test/easy/normal/hard`), набор фишек, поле **9 строк × 7 столбцов**, `tileSize = 50`, 60 секунд |
| `match3/Match3Utility.ts` | Чистая логика сетки: `createGrid`, `getMatches`, `applyGravity`, `fillUp`, `swapPieces` и др. |
| `match3/Match3Board.ts` | Вид поля: создание/удаление фишек, маска `piecesMask`, `getViewPositionByGridPosition` |
| `match3/Match3Piece.ts` | Фишка: спрайты `highlight` + `image` + прозрачная `area` для событий; свайп с порогом 10 px; анимации на GSAP |
| `match3/Match3Actions.ts` | Ходы игрока: проверка хода на клоне сетки, обмен, откат |
| `match3/Match3Process.ts` | Каскад: очередь «статистика → спецфишки → совпадения → гравитация → досыпание → проверка» |
| `match3/Match3Special*.ts` | Спецфишки: blast, row, column, colour |
| `match3/Match3Stats.ts`, `Match3Timer.ts` | Очки, оценка, таймер |
| `screens/` | `LoadScreen`, `HomeScreen`, `GameScreen`, `ResultScreen` |
| `popups/` | `PausePopup`, `SettingsPopup`, `InfoPopup` |
| `ui/` | Компоненты: `TiledBackground` (TilingSprite), `Shelf`, `Cauldron` (Spine), `GameEffects`, кнопки (`@pixi/ui`), `Label` (Text), `MaskTransition` и др. |

Соглашение оригинала, которое мы переносим в курс: **grid** — модель (массив чисел, `0` — пусто), **board** — её визуальное представление из спрайтов.

## Ассеты (`raw-assets/`)

Папки с суффиксом `{m}` становятся бандлами манифеста, а папки `{tps}` упаковываются в атласы (TexturePacker-формат).

| Бандл | Содержимое |
|---|---|
| `preload` | `background.png` (280×300, тайл фона), `circle.png`, `logo-pixi.png`, Spine котла (`cauldron-skeleton.*`) |
| `home` | `logo-game.png` |
| `game` | Фишки `piece-dragon/frog/newt/snake/spider/yeti` (150×150), спецфишки `special-blast/row/column/colour`, `highlight` (150×150), полка `shelf-block/corner` (100×100), `books-01..05`, `game-header`, цифры `num-stroke-1..5` |
| `common` | Кнопки `button-large*` (301×112), `button-small*`, иконки, `character`, `star`, `rounded-rectangle`, `white-cauldron`, Spine дракона; звуки `sfx-*.wav`, музыка `bgm-game.mp3`, `bgm-main.mp3` |
| `result` | `result-base.png` |

### Как используем ассеты в курсе

- **Главы 1–4**: отдельные PNG (`/assets/game/piece-dragon.png` и т. д.), без атласов. Так проще объяснить `Assets.load`. Все файлы уже скопированы в `public/assets/` по бандлам, происхождение — в `public/assets/CREDITS.md`.
- **Глава 5**: заранее собранный атлас `game.json` и манифест с бандлами (генерируем AssetPack из `raw-assets`, кладём в `public/assets/`).
- **Глава 15**: показываем исходную структуру `raw-assets` и конфиг AssetPack.

## Что упрощаем в учебной версии

| Оригинал | Учебная версия | Когда догоняем оригинал |
|---|---|---|
| GSAP с кастомными кривыми | Свои твины на Ticker (8.3–8.7), затем GSAP; кривая падения `singleBounce` — своя функция вместо `CustomEase` | Гл. 8.8 — переходим на GSAP |
| Пауза каскада (`AsyncQueue.pause`), блокировка отдельных фишек | Каскад — цикл `while` с `await`, на время хода блокируется всё поле (`Board.processing`) | Гл. 11 — пауза |
| `@pixi/ui` для кнопок | Своя кнопка на Sprite | Гл. 10.6 |
| Spine-котёл и дракон | Статичный спрайт `white-cauldron` | Гл. 14 (необязательная) |
| 4 спецфишки | Без спецфишек | Гл. 12, практикум (2 спецфишки) |
| Режимы сложности | Один режим `normal` | Гл. 13.4 — настройки |
| Пул объектов | `new` / `destroy` | Гл. 12.4 |
| AssetPack | Готовые файлы в `public/` | Гл. 15.2 |
| i18n | Тексты сразу на русском | Не догоняем |
| Очки: 1 за фишку + длина совпадения + `совпадений × раунд` (`Match3Stats`) | 10 × длина совпадения × номер раунда | Не догоняем |
| Системный шрифт Arial Rounded MT Bold | Веб-шрифт Nunito ExtraBold (OFL) | — |

## Соответствие учебных файлов и оригинала

Заполняется по мере написания уроков. Итоговая структура учебной игры:

| Учебный файл | Оригинал |
|---|---|
| `main.ts` | `main.ts` |
| `grid.ts` | `match3/Match3Utility.ts` |
| `Piece.ts` | `match3/Match3Piece.ts` |
| `Board.ts` | `match3/Match3Board.ts` + `Match3Actions.ts` |
| `Board.process` (асинхронный каскад, гл. 8.5) | `match3/Match3Process.ts` + `utils/asyncUtils.ts` (`AsyncQueue`) |
| `tween.ts` | `utils/animation.ts` (до GSAP; после 8.8 из него используется только `singleBounce`) |
| `Background.ts` | `ui/TiledBackground.ts` |
| `countdown.ts` (`playCountdown`, `AnimatedSprite`, гл. 8.9; с гл. 9 — отдельный файл) | `ui/GameOvertime.ts` (цифры `num-stroke-*`, в оригинале — Sprite + GSAP) |
| `screens/*.ts` | `screens/*.ts` |
| `navigation.ts` | `utils/navigation.ts` |
| `Label.ts` | `ui/Label.ts` (шрифт Nunito вместо системного Arial Rounded MT Bold) |
| Счёт, таймер, «+N», «Комбо ×N» в `main.ts` (гл. 9) | `ui/GameScore.ts` (набегающий счёт), `ui/GameTimer.ts` (мигание в последние 10 с; у нас `BitmapText`, в оригинале `Label`), `GameScreen.onMatch` + `CloudLabel` (комбо), `Match3Stats` (очки) |
