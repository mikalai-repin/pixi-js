import { Application } from 'pixi.js';

const app = new Application();
await app.init();

// Добавляем canvas приложения на страницу
document.body.appendChild(app.canvas);

console.log('Рендерер:', app.renderer.name);
