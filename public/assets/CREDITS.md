# Происхождение ресурсов

Все файлы в `preload/`, `game/`, `common/`, `home/`, `result/` взяты без изменений из игры
**Puzzling Potions** (https://github.com/pixijs/open-games/tree/main/puzzling-potions),
папка `raw-assets`, коммит 83b4676 (2025-11-11).

© 2025 PixiJS, автор игры — Mauro (https://github.com/maurodetarso). Лицензия MIT.

Папки соответствуют бандлам оригинала (`preload{m}`, `game{m}` и т. д.); атласы `{tps}`
здесь разложены на отдельные PNG.

## Шрифты (`fonts/`)

`fonts/nunito-extrabold.woff2` — шрифт **Nunito ExtraBold** (https://github.com/googlefonts/nunito),
© 2014 The Nunito Project Authors, лицензия SIL Open Font License 1.1 (текст — `fonts/OFL.txt`).
Файл получен из TTF Google Fonts (версия v32): оставлены латиница, кириллица и знаки препинания,
формат переведён в WOFF2 утилитой `pyftsubset` (fonttools). Оригинальная игра использует
системный шрифт Arial Rounded MT Bold, которого может не быть у ученика, поэтому в курсе — Nunito.
