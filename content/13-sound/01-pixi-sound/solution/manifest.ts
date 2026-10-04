/**
 * Манифест ресурсов, собранный AssetPack из оригинальных ресурсов Puzzling Potions.
 * Внутри — бандлы preload, game, common, home и result, а картинки упакованы в атласы.
 * Эта версия манифеста — со звуками (они лежат в бандле common), но без Spine-анимаций из главы 14.
 */
export const MANIFEST_URL = '/assets/packed/manifest-sound.json';

/** Пути в манифесте указаны относительно этой папки */
export const ASSETS_BASE_PATH = '/assets/packed';

/** Шрифт курса: Nunito ExtraBold (лицензия OFL), латиница и кириллица */
export const FONT_URL = '/assets/fonts/nunito-extrabold.woff2';
/** Имя семейства, под которым шрифт будет доступен в fontFamily */
export const FONT_FAMILY = 'Nunito';
