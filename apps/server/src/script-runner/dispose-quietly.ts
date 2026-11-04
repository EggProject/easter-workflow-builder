import type { QuickJSContext, QuickJSHandle, QuickJSRuntime } from 'quickjs-emscripten-core';

/**
 * A lépés lebontása: előbb minden, a lépés alatt létrehozott handle, utána a
 * kontextus és a runtime (research `2026-11-04-szkript-csomopont.md` Q-2 B: a
 * tiszta lebontás feltétele, hogy a runtime `dispose` előtt minden handle
 * felszabaduljon). A lebontás hibája (a `JS_FreeRuntime` assertje, ami a gazdán
 * `WebAssembly.RuntimeError`; egy megszakított `then` lánc vagy a gazdára jutott
 * hiba után hibátlan handle kezelés mellett is jöhet, Q-3, Q-6) elkapott, és a
 * lépés eredményét nem változtatja meg, mert a modul úgyis eldobott (SPEC-014
 * 5.4 "Életciklus"). A handle listát a hívó tölti, minden handle pontosan
 * egyszer kerül bele.
 */
export function disposeQuietly(
  handles: readonly QuickJSHandle[],
  context: QuickJSContext,
  runtime: QuickJSRuntime,
): void {
  try {
    for (const handle of handles) {
      handle.dispose();
    }
    context.dispose();
    runtime.dispose();
  } catch {
    // A modul eldobott, a lebontás hibájának nincs következménye (Q-3).
  }
}
