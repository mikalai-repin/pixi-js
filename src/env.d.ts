/** Список файлов public/assets (относительно этой папки) — его собирает плагин asset-list в vite.config.ts */
declare module 'virtual:asset-list' {
  const files: string[];
  export default files;
}
