import { Application } from 'pixi.js';

const app = new Application();
await app.init();

console.log('Рендерер:', app.renderer.name);
