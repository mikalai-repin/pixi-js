import type { AssetsManifest } from 'pixi.js';

/**
 * Все ресурсы игры, разложенные по бандлам.
 * Бандл — группа ресурсов, которая загружается целиком: например, всё для одного экрана.
 */
export const manifest: AssetsManifest = {
  bundles: [
    {
      name: 'game',
      assets: [
        { alias: 'piece-dragon', src: '/assets/game/piece-dragon.png' },
        { alias: 'piece-frog', src: '/assets/game/piece-frog.png' },
        { alias: 'piece-newt', src: '/assets/game/piece-newt.png' },
        { alias: 'piece-snake', src: '/assets/game/piece-snake.png' },
        { alias: 'piece-spider', src: '/assets/game/piece-spider.png' },
        { alias: 'piece-yeti', src: '/assets/game/piece-yeti.png' },
        { alias: 'highlight', src: '/assets/game/highlight.png' },
      ],
    },
    {
      name: 'result',
      assets: [{ alias: 'result-base', src: '/assets/result/result-base.png' }],
    },
  ],
};
