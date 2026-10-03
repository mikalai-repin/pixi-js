/**
 * Манифест ресурсов, собранный AssetPack из оригинальных ресурсов Puzzling Potions.
 * Внутри — бандлы preload, game, common, home и result, а картинки упакованы в атласы.
 * Это «базовая» версия манифеста: без звуков и Spine-анимаций, которые понадобятся в главах 13–14.
 */
export const MANIFEST_URL = '/assets/packed/manifest-basic.json';

/** Пути в манифесте указаны относительно этой папки */
export const ASSETS_BASE_PATH = '/assets/packed';

/** Шрифт курса: Nunito ExtraBold (лицензия OFL), латиница и кириллица */
export const FONT_URL = '/assets/fonts/nunito-extrabold.woff2';
/** Имя семейства, под которым шрифт будет доступен в fontFamily */
export const FONT_FAMILY = 'Nunito';
