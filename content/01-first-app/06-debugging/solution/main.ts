import { Application } from 'pixi.js';

const app = new Application();
await app.init({
  background: '#1e1035',
  resizeTo: window,
  antialias: true,
});

document.body.appendChild(app.canvas);

// Даём доступ к приложению для PixiJS DevTools и консоли браузера
globalThis.__PIXI_APP__ = app;

console.log('Рендерер:', app.renderer.name);
console.log('Экран:', app.screen.width, '×', app.screen.height);
console.log('Объектов на сцене:', app.stage.children.length);
console.log('Сцена:', app.stage);

// Каждый кадр немного сдвигаем оттенок фона
let hue = 260;
app.ticker.add((ticker) => {
  hue = (hue + 0.5 * ticker.deltaTime) % 360;
  app.renderer.background.color = { h: hue, s: 55, l: 14 };
});
