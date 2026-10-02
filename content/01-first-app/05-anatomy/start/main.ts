import { Application } from 'pixi.js';

const app = new Application();
await app.init({
  background: '#1e1035',
  resizeTo: window,
  antialias: true,
});

document.body.appendChild(app.canvas);

console.log('Рендерер:', app.renderer.name);
