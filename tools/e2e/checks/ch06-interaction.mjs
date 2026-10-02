// Проверка главы 6 мышью: клик по клетке, зазоры без hitArea и с ней, залипание свайпа, обмен и пауза.
// node tools/e2e/checks/ch06-interaction.mjs
import { CONTENT, cellCenter, compileDir, launch, openPreview, swipe, wait } from '../lib.mjs';

const C = `${CONTENT}/06-interaction`;
const browser = await launch();
const open = (step) => openPreview(browser, compileDir(`${C}/${step}/solution`));
const pieceAt = (page, label) =>
  page.evaluate((label) => {
    const layer = __PIXI_APP__.stage.getChildByLabel('pieces', true);
    const p = layer.children.find((c) => c.label.endsWith(label));
    return p && { x: p.x, y: p.y, scale: p.scale.x };
  }, label);

{
  const { page, logs } = await open('03-event-object');
  const c = cellCenter(2, 1);
  await page.mouse.click(c.x, c.y);
  await wait(300);
  console.log('03 клик по [2,1]:', logs.at(-1), '— ожидаем «клетка [2, 1]»');
  const before = logs.length;
  await page.mouse.click(175, cellCenter(6, 1).y); // стык столбцов 1 и 2 в строке без выбранной фишки
  await wait(300);
  console.log('03 клик в зазор:', logs.length > before ? logs.at(-1) : 'нет события', '— ожидаем «нет события»');
  await page.close();
}
{
  const { page, logs } = await open('05-hit-area');
  const before = logs.length;
  await page.mouse.click(175, cellCenter(6, 1).y);
  await wait(300);
  console.log('05 клик в зазор:', logs.length > before ? logs.at(-1) : 'нет события', '— ожидаем событие');
  await page.close();
}
for (const step of ['06-swipe', '07-outside']) {
  const { page, logs } = await open(step);
  await swipe(page, cellCenter(4, 3), 30, 0);
  console.log(step, 'обычный свайп:', logs.filter((l) => l.includes('Свайп')).at(-1));
  const d = cellCenter(6, 1);
  const n0 = logs.length;
  // Нажали, резко увели за поле, отпустили там, потом просто водим мышью над той же фишкой
  await page.mouse.move(d.x, d.y);
  await page.mouse.down();
  await page.mouse.move(5, 590, { steps: 1 });
  await page.mouse.up();
  await wait(200);
  await page.mouse.move(d.x, d.y, { steps: 3 });
  await page.mouse.move(d.x + 25, d.y, { steps: 5 });
  await wait(200);
  console.log(step, 'после отпускания снаружи:', logs.slice(n0), step === '06-swipe' ? '— ожидаем ложный свайп right (баг)' : '— ожидаем один свайп down в момент рывка');
  await page.close();
}
{
  const { page, logs } = await open('09-practice');
  await swipe(page, cellCenter(4, 3), 30, 0);
  console.log('09 [4,3] после свайпа вправо:', await pieceAt(page, '[4, 3]'), '— ожидаем x = 50');
  await swipe(page, cellCenter(0, 0), 0, -30);
  console.log('09 [0,0] после свайпа за край:', await pieceAt(page, '[0, 0]'), '— ожидаем x = -150, y = -200');
  await page.mouse.click(500 - 26, 26); // кнопка паузы
  await wait(200);
  await swipe(page, cellCenter(1, 1), 30, 0);
  console.log('09 на паузе [1,1]:', await pieceAt(page, '[1, 1]'), '— ожидаем x = -100');
  console.log('09 ошибки:', logs.filter((l) => l.startsWith('[pageerror]')));
  await page.close();
}
await browser.close();
