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
| `@pixi/ui` для кнопок | Своя кнопка `Button` на `NineSliceSprite`; `FancyButton` только в настройках | Гл. 10.6 |
| Поле не масштабируется, минимальный экран под поле | Поле вписывается между полосами HUD, масштаб до 1,5 | — |
| Spine-котёл и дракон | Статичный спрайт `white-cauldron` | Гл. 14 (необязательная) |
| 4 спецфишки (`row`, `column`, `colour`, `blast`), срабатывают по нажатию и при обмене | 2 спецфишки (`special-row`, `special-blast`), только по нажатию; цепная реакция есть | Гл. 12, практикум |
| Режимы сложности | Один режим `normal` | Не догоняем |
| Пул объектов `MultiPool` (`pool.get(ctor)`, фишки поля, копии, взрывы; навигация берёт экраны через `pool.get`, но обратно не сдаёт) | `Pool<T>` с функцией создания (гл. 12.4) только для эффектов: кольца, копии, искры. Фишки поля и экраны создаются заново | — |
| Котёл (Spine), зелья летят в котёл | Зелья летят в счёт HUD (`Hud.getScorePosition`), кривые — стандартные `sine.in/out`, `back.in` вместо `CustomEase` | Гл. 14 — котёл |
| Взрыв `PopExplosion` — 12 спрайтов на GSAP | Искры в `ParticleContainer` на тикере (гл. 12.5) | — |
| Размытие под всеми попапами (`new BlurFilter(5)` ставит попап) | Размытие ставит сам `GameScreen` на паузе (`addFilter`), плюс выцветание поля `ColorMatrixFilter` и pixi-filters (`GlowFilter`, `ShockwaveFilter`), которых в оригинале нет | — |
| Пауза: `pause`/`resume` у каждой фишки и `AsyncQueue.pause` | `gsap.exportRoot()` замораживает все текущие твины | — |
| AssetPack | Готовые файлы в `public/` | Гл. 15.2 |
| i18n | Тексты сразу на русском | Не догоняем |
| Очки: 1 за фишку + длина совпадения + `совпадений × раунд` (`Match3Stats`) | 10 × длина совпадения × номер раунда | Не догоняем |
| Системный шрифт Arial Rounded MT Bold | Веб-шрифт Nunito ExtraBold (OFL) | — |
| Три громкости: общая (`sound.volumeAll` + `muteAll` на нуле), музыка, эффекты; каждая под своим ключом `localStorage` (`utils/storage.ts`), сохраняется при каждом изменении | Две громкости (музыка, эффекты) + подсказка одним JSON под ключом `puzzling-potions:settings`, сохраняются по «Готово», чтение с проверкой типов (гл. 13.7); слайдер скорости убран | — |
| Звук кнопок в каждом классе кнопки (`LargeButton`, `SmallButton`, `ImageButton`…) | `Button` + `addButtonSounds` для `FancyButton` (гл. 13.8) | — |
| Пауза без звуковых эффектов | Под паузой эквалайзер глушит весь звук (`sound.filtersAll`, гл. 13.5); в меню подсказка «Нажмите на экран, чтобы включить звук», пока контекст заблокирован (гл. 13.4) | — |

## Найденные ошибки и особенности (глава 15, проверено запуском)

- Экраны из `pool.get(ctor)` не возвращаются (`giveBack`) и не уничтожаются: скелеты Spine старых экранов остаются на `Ticker.shared` (3 → 9 слушателей за три круга меню ↔ игра).
- `AsyncQueue.isPaused()` возвращает `this.processing`; `storage.getBool` превращает `'false'` в `true` (оба не вызываются).
- `index.html`: `background-color: 0xffffff` — неверный CSS, браузер отбрасывает правило (фон `rgba(0, 0, 0, 0)`).
- Один ход с одним раундом каскада — 17 строк `[Match3]` в консоли.
- Ходить можно во время каскада: замок на фишку (`isLocked`), а не на поле (проверено: второй ход посреди каскада меняет сетку).
- `resolveAndKillTweens` вызывает внутреннее поле GSAP `_prom` (промис убитого твина иначе не выполняется).
- Циклы импортов: `main.ts` ↔ `utils/navigation.ts`, `GameScreen` ↔ `ResultScreen`.
- Продакшен-сборка (`vite build`, Vite 7.2): 876 модулей → 7 JS-файлов, главный 699 КБ / 210 КБ gzip; при запуске передаётся JS 263 КБ (gzip) и звук 620 КБ, из них музыка 571 КБ.

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
| `Button.ts` | `ui/LargeButton.ts` + `ui/SmallButton.ts` (у нас свой класс на `NineSliceSprite`, в оригинале — `FancyButton`) |
| `SettingsPanel.ts` (`FancyButton`, `Slider`, `CheckBox`, `createIconButton`) | `popups/SettingsPopup.ts`, `ui/VolumeSlider.ts`, `ui/ImageButton.ts` (до гл. 13 у нас слайдер скорости вместо громкости) |
| `Hud.ts` | `ui/GameTimer.ts` + `ui/GameScore.ts` + кнопки паузы и настроек в `screens/GameScreen.ts` |
| Стартовая панель в `main.ts` (гл. 10.2) | `ui/RoundedBox.ts` (`NineSliceSprite` из `rounded-rectangle`, тень со сдвигом) |
| `resize()` и `layout()` в `main.ts` | `resize()` в `main.ts` (минимум 375 × 700, CSS-размер canvas) и `GameScreen.resize` |
| `navigation.ts` (`AppScreen`, `Navigation` с реестром `register`/`showScreen(name)`, `loadScreen`, `preload`, попапы, `blur`/`focus`) | `utils/navigation.ts` (в оригинале `showScreen(ctor)` и пул экранов; у нас имена — превью не поддерживает циклические импорты) |
| `app.ts` | `export const app` в `main.ts` оригинала |
| `GameScreen.ts`, `HomeScreen.ts`, `ResultScreen.ts`, `LoadScreen.ts` | `screens/*.ts` (без дракона, котла и облаков) |
| `PausePopup.ts` (+ `createDim`, `createPanel`), `SettingsPopup.ts` | `popups/PausePopup.ts`, `popups/SettingsPopup.ts` |
| `MaskTransition.ts` | `ui/MaskTransition.ts` (маска на экране результата, а не на контейнере навигации) |
| `stats.ts` (`saveScore`, `getGrade`, `getBestScore` в `localStorage`) | `utils/userStats.ts`, `Match3Stats.caulculateGrade` (у нас пороги по очкам 200/600/1200) |
| `userSettings.ts` (с гл. 13.7: `loadSettings` с проверкой, `saveSettings`) | `utils/userSettings.ts` + `utils/storage.ts` |
| `audio.ts` (`bgm`, `sfx`, `isAudioLocked`, гл. 13) | `utils/audio.ts` (у нас без общей громкости; `BGM.setVolume` останавливает твин кроссфейда) |
| `GameEffects.ts` (слой `vfx`: кольцо, полёт к счёту, искры, `earthquake`, `addFilter`/`removeFilter`, `playShockwave`, `onSpecial`) | `ui/GameEffects.ts` + `earthquake` из `utils/animation.ts` + `ui/PopExplosion.ts` |
| `pool.ts` | `utils/pool.ts` (`Pool`, `MultiPool`) |
| Спецфишки: `getSpecialSpawns`, `getSpecialArea` в `grid.ts`; `burnSpecials`, `spawnSpecials`, `activateSpecial` в `Board.ts` | `match3/Match3Special.ts` + `specials/Match3SpecialRow.ts`, `Match3SpecialBlast.ts` |
