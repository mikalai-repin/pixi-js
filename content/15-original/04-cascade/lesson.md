---
title: Ход и каскад
files: [Board.ts, grid.ts, Piece.ts, GameScreen.ts, GameEffects.ts, main.ts, navigation.ts, Hud.ts, audio.ts, Cauldron.ts, Dragon.ts, HomeScreen.ts, ResultScreen.ts, LoadScreen.ts, PausePopup.ts, SettingsPopup.ts, MaskTransition.ts, pool.ts, stats.ts, userSettings.ts, Button.ts, Label.ts, countdown.ts, Background.ts, app.ts, manifest.ts]
focus: Board.ts
noSolution: true
api: []
---

Сердце игры «три в ряд» — что происходит после хода: обмен, совпадения, падение, досыпание, снова совпадения. Мы писали это в главах 7 и 8 как один цикл `while` в `Board.process`. Оригинал устроен иначе, и в двух местах — по-настоящему по-другому. Разберём.

## Ход: модель не меняется зря

[`Match3Actions.swapPieces`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/match3/Match3Actions.ts) сначала проверяет ход на **копии сетки** — как наш `isValidMove`, — а дальше:

```ts src/match3/Match3Actions.ts
const valid = this.validateMove(positionA, positionB);
this.match3.onMove?.({ from: positionA, to: positionB, valid });

if (valid) {
    // Модель меняется, только если ход разрешён
    match3SwapPieces(this.match3.board.grid, positionA, positionB);
    pieceA.row = positionB.row;
    // ...
}
// Фишки едут на места друг друга в любом случае
await Promise.all([pieceA.animateSwap(...), pieceB.animateSwap(...)]);
if (!valid) {
    // ...и возвращаются, если ход неудачный
}
```

У нас неудачный ход дважды вызывает `swap`: модель меняется и тут же меняется обратно. Результат тот же, но оригинал аккуратнее: модель никогда не бывает в «неправильном» состоянии даже на мгновение. А сама анимация «туда и обратно» — чисто визуальная. Хорошее правило: **модель меняется только по правилам игры, а вид может показывать что угодно**.

Есть и отличие в правилах: ход со спецфишкой в оригинале разрешён всегда, и спецфишка взрывается от обмена. У нас спецфишки срабатывают только по нажатию — это мы записали в технический долг главы 12.

## Замок на фишку, а не на поле

Посмотрите, что мешает сделать ход:

```ts src/match3/Match3Actions.ts
const pieceA = this.match3.board.getPieceByPosition(from);
const pieceB = this.match3.board.getPieceByPosition(to);
if (!pieceA || !pieceB || pieceA.isLocked() || pieceB.isLocked()) return;
```

Только **занятость самих фишек**. Фишка запирает себя на время своей анимации (`lock()` в начале `animateSwap`, `animateFall`, `animatePop`, `unlock()` в конце). А у нас в главе 8 на время хода и всего каскада заперто **всё поле**: `if (this.processing) return`.

Значит, в оригинале можно ходить, **пока идёт каскад** — фишками, которые сейчас не падают и не исчезают. Мы проверили на запущенном оригинале: посреди каскада (`process.isProcessing()` — `true`) второй ход по двум нижним фишкам принят, и их типы в сетке поменялись местами. Новые совпадения от такого хода подхватит следующий раунд каскада: он каждый раз заново ищет совпадения в сетке.

Это заметно меняет ощущение от игры: опытный игрок не ждёт, пока доиграет анимация, и делает больше ходов за 60 секунд. Цена — сложность: модель меняется сразу с нескольких сторон, и всё, что читает сетку, должно быть к этому готово. Именно поэтому в главе 8 мы выбрали простой общий замок.

## Каскад как очередь

[`Match3Process`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/match3/Match3Process.ts) делит раунд каскада на шесть шагов и кладёт их в **очередь асинхронных функций**:

```ts src/match3/Match3Process.ts
private async runProcessRound() {
    this.queue.add(async () => { this.round += 1; this.updateStats(); });
    this.queue.add(async () => { await this.processSpecialMatches(); });
    this.queue.add(async () => { await this.processRegularMatches(); });
    this.queue.add(async () => { this.applyGravity(); }); // без await: падение идёт одновременно с досыпанием
    this.queue.add(async () => { await this.refillGrid(); });
    this.queue.add(async () => { this.processCheckpoint(); });
}
```

Последний шаг, `processCheckpoint`, смотрит на сетку: остались совпадения или пустые клетки — ставит в очередь ещё один раунд, иначе завершает каскад и вызывает `onProcessComplete`. Наш `while (matches.length > 0)` делает то же самое циклом.

Очередь — это [`AsyncQueue`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/utils/asyncUtils.ts):

```ts src/utils/asyncUtils.ts
public async process() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length) {
        if (this.paused) {
            await waitFor(0.1);
        } else {
            const fn = this.queue.shift();
            if (fn) await fn();
        }
    }
    this.processing = false;
}
```

Функции выполняются по одной, каждая ждёт предыдущую. Зачем очередь, а не просто `await` подряд? Ради **паузы**: пока `paused`, цикл просыпается раз в 100 мс и ничего не делает. Следующий шаг каскада не начнётся, пока игру не продолжат.

## Пауза: два подхода

Очередь останавливает каскад **между шагами**. А что с анимациями, которые идут прямо сейчас? Оригинал останавливает их у каждой фишки: `Match3Board.pause` вызывает `piece.pause()`, а та — `pauseTweens` для своих объектов из [`utils/animation.ts`](https://github.com/pixijs/open-games/blob/83b4676/puzzling-potions/src/utils/animation.ts):

```ts src/utils/animation.ts
export function pauseTweens(targets: gsap.TweenTarget) {
    const tweens = gsap.getTweensOf(targets);
    for (const tween of tweens) tween.pause();
}
```

Шаг каскада ждёт анимаций фишек — а они стоят. Значит, стоит и шаг.

У нас в главе 11 один вызов `gsap.exportRoot()` замораживает **все** твины сразу, и каскад стоит сам: он ждёт тех же твинов. Получается короче, но грубее: замирает всё, что идёт на GSAP, — и потому пришлось следить, чтобы анимация самого попапа создавалась **после** `exportRoot`. Подход оригинала точнее: каждая подсистема сама знает, что ей останавливать.

## Хитрость с промисами твинов

Ещё одна функция из `utils/animation.ts`:

```ts src/utils/animation.ts
export async function resolveAndKillTweens(targets: gsap.TweenTarget) {
    const tweens = gsap.getTweensOf(targets);
    for (const tween of tweens) {
        // Force resolve tween promise, if exists
        if ((tween as any)['_prom']) (tween as any)['_prom']();
    }
    gsap.killTweensOf(targets);
}
```

Зачем? Убитый твин **никогда не выполняет свой промис**. Если кто-то ждал его через `await`, он будет ждать вечно — и, например, шаг каскада никогда не закончится. Мы проверили: после `gsap.killTweensOf` промис твина так и не выполнился, а если перед этим вызвать `_prom`, — выполнился. Поэтому фишка оригинала перед новой анимацией «дорешает» старую. Но `_prom` — **внутреннее** поле GSAP, его нет в документации и типах (отсюда `as any`): в любой новой версии GSAP оно может исчезнуть. Надёжнее не убивать твин, которого кто-то ждёт, а завершить его: `tween.progress(1)` доводит твин до конца и выполняет промис штатно.

Помните главу 14? Там мы опирались на то же свойство нарочно: если сменить музыку посреди затухания, `killTweensOf` убивает твин затухания, и `.then(() => previous.stop())` не вызывается — музыка не останавливается.

## Проверьте себя

::: task
1. Почему в оригинале можно ходить во время каскада, а у нас нет? Чем приходится платить за такую возможность?
2. Найдите в `AsyncQueue` метод `isPaused`. Что он возвращает на самом деле?
3. Что случится с `await piece.animateFall(...)`, если кто-то вызовет `gsap.killTweensOf(piece.position)` посреди падения?
:::

::: hint Ответы
1. Оригинал запирает только фишки, которые сейчас анимируются (`isLocked`), а мы — всё поле на время хода и каскада. Плата — модель меняется из нескольких мест одновременно, и код каскада должен это выдерживать.
2. `return this.processing;` — значение «идёт обработка», а не «на паузе». Это опечатка, и она не проявляется только потому, что `isPaused` у очереди нигде не вызывается.
3. Без `resolveAndKillTweens` — `await` не закончится никогда: промис убитого твина не выполняется. Поэтому фишки оригинала убивают свои твины только через `resolveAndKillTweens`.
:::
