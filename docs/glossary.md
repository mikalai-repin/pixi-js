# Словарь терминов

Единые переводы для всех уроков. При первом упоминании в уроке пишем: «якорь (`anchor`)», дальше только русский термин. Имена классов и методов **не переводим**.

Новый термин сначала добавляем сюда, потом используем в уроке.

## PixiJS и рендеринг

| English | Русский | Комментарий |
|---|---|---|
| renderer | рендерер | WebGL / WebGPU / Canvas |
| render | отрисовка, рендер | «отрисовать кадр» |
| frame | кадр | |
| stage | сцена (`stage`) | корневой контейнер |
| scene graph | граф сцены, дерево сцены | |
| display object | объект отображения | в v8 — любой наследник `Container` |
| container | контейнер | |
| child / parent | дочерний объект / родитель | |
| sprite | спрайт | |
| texture | текстура | |
| texture source | источник текстуры | `TextureSource`, данные на GPU |
| frame (texture) | фрейм текстуры | прямоугольник внутри источника |
| spritesheet / atlas | атлас | «спрайтшит» не используем |
| asset | ресурс | «ассет» — допустимо в разговорной речи в тексте, но в заголовках «ресурс» |
| bundle | бандл | группа ресурсов |
| manifest | манифест | |
| alias | псевдоним (`alias`) | |
| graphics | графика (`Graphics`) | «нарисовать в Graphics» |
| fill / stroke | заливка / обводка | |
| mask | маска | |
| filter | фильтр | |
| filter area | область фильтра (`filterArea`) | прямоугольник, в котором работает фильтр |
| blur | размытие | `BlurFilter` |
| color matrix | цветовая матрица | `ColorMatrixFilter`: матрица 4 × 5 над RGBA |
| glow | свечение | `GlowFilter` из pixi-filters |
| shockwave | ударная волна | `ShockwaveFilter` из pixi-filters |
| blend mode | режим смешивания | |
| additive blending | сложение (режим `add`) | цвета складываются, картинка светлеет |
| premultiplied alpha | предумноженная альфа | цвет уже умножен на прозрачность |
| tint | тонирование (`tint`) | |
| batch / batching | батч / батчинг | объединение отрисовок |
| draw call | вызов отрисовки (draw call) | |
| render group | рендер-группа | |
| culling | отсечение (culling) | |
| render texture | рендер-текстура | |
| shader | шейдер | |
| mesh | меш | |
| bounds | границы | |

## Трансформации и координаты

| English | Русский | Комментарий |
|---|---|---|
| position | позиция | |
| anchor | якорь | точка привязки текстуры, доля 0..1 |
| pivot | точка поворота (`pivot`) | в пикселях, в локальных координатах |
| scale | масштаб | |
| rotation | поворот | в радианах |
| angle | угол | в градусах |
| skew | наклон (skew) | |
| transform | трансформация | |
| local / global coordinates | локальные / глобальные координаты | |
| world transform | мировая трансформация | |
| resolution | разрешение (`resolution`) | плотность пикселей |

## События

| English | Русский | Комментарий |
|---|---|---|
| event | событие | |
| event mode | режим событий (`eventMode`) | |
| pointer | указатель | мышь, палец, стилус |
| hit area | область попадания (`hitArea`) | |
| hit test | проверка попадания | |
| bubbling | всплытие | |
| swipe | свайп | |
| tap | тап | |

## Время и анимация

| English | Русский | Комментарий |
|---|---|---|
| ticker | тикер (`Ticker`) | |
| game loop | игровой цикл | |
| delta time | дельта времени | |
| frame rate, FPS | частота кадров (FPS) | кадров в секунду |
| slow motion | замедление | `ticker.speed < 1` |
| tween | твин | анимация «из A в B» |
| interpolation, lerp | интерполяция, `lerp` | значение между A и B по доле t |
| easing | функция плавности (easing) | |
| overshoot | перелёт | `backOut` проскакивает цель и возвращается |
| tiling sprite | повторяющийся спрайт (`TilingSprite`) | заполняет область узором из текстуры |
| pattern | узор | повторяющаяся картинка фона |
| frame-by-frame animation | покадровая анимация | |
| skeletal animation | скелетная анимация | Spine |
| juice | «сочность» (juice) | кавычки при первом упоминании |
| screen shake | тряска экрана | |
| particles | частицы | |
| particle container | контейнер частиц (`ParticleContainer`) | |
| static / dynamic properties | статические / динамические свойства | у частиц: выгружаются на GPU при изменении списка / каждый кадр |
| object pool | пул объектов | |
| effects layer, VFX | слой эффектов | `GameEffects`, поле `vfx` (visual effects) |
| anticipation | замах | движение в обратную сторону перед основным |

## Текст

| English | Русский | Комментарий |
|---|---|---|
| text | текст (`Text`) | |
| text style | стиль текста (`TextStyle`) | |
| font, font family | шрифт, семейство шрифтов (`fontFamily`) | |
| fallback font | запасной шрифт | следующий в списке `fontFamily` |
| web font | веб-шрифт | файл шрифта, загружаемый страницей |
| glyph | глиф | изображение одного символа |
| bitmap font | растровый шрифт (`BitmapFont`) | глифы заранее нарисованы в текстуру |
| word wrap | перенос строк (`wordWrap`) | |
| drop shadow | тень (`dropShadow`) | |
| kerning | кернинг | поправка расстояния между парами букв |
| rich text | форматированный текст | разные стили внутри одной надписи |
| SDF / MSDF | SDF / MSDF | шрифт на полях расстояний, чёткий при любом масштабе |

## Интерфейс

| English | Русский | Комментарий |
|---|---|---|
| button state: default / hover / pressed | состояние кнопки: обычное / наведение / нажатие | |
| nine-slice | девятизонное масштабирование, nine-slice (`NineSliceSprite`) | углы не растягиваются |
| component | компонент | класс интерфейса с понятным API: `Button`, `Hud` |
| resize | изменение размера, ресайз | |
| layout | раскладка | расстановка элементов под размер экрана |
| logical pixel | логический пиксель | единица `app.screen` |
| device pixel ratio | плотность пикселей экрана (`devicePixelRatio`) | |
| signal | сигнал | события `@pixi/ui`: `onPress.connect(...)` |
| slider | слайдер (`Slider`) | |
| checkbox | флажок (`CheckBox`) | |
| screen lifecycle | жизненный цикл экрана | `prepare → resize → show → update… → hide → destroy` |
| navigation | навигация | объект, который переключает экраны |
| registry | реестр | экраны по именам в навигации |
| transition | переход | анимация смены экранов |
| sprite mask | маска-спрайт | маска по прозрачности текстуры |
| dim | затемнение | полупрозрачный слой под попапом |
| focus / blur | фокус / потеря фокуса | вкладка видна / ушла в фон |

## Игра (match-3)

| English | Русский | Комментарий |
|---|---|---|
| match-3 | «три в ряд» (match-3) | |
| Puzzling Potions | Puzzling Potions | название игры не переводим |
| Bubbo Bubbo | Bubbo Bubbo | название игры не переводим |
| grid | сетка | модель: массив чисел |
| board | поле | вид: спрайты |
| piece | фишка | |
| tile / slot | клетка | |
| tile size | размер клетки | `tileSize` |
| match | совпадение | |
| swap | обмен | |
| gravity | гравитация | падение фишек |
| refill | досыпание | |
| cascade / combo | каскад / комбо | |
| special piece | спецфишка | |
| row blast / bomb | полоса / бомба | `special-row` / `special-blast` |
| chain reaction | цепная реакция | взрыв задевает другую спецфишку |
| screen | экран | Home, Game, Result |
| popup | попап | |
| HUD | HUD, интерфейс поверх игры | |
