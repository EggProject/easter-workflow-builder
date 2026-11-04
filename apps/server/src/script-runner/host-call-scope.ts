import type { QuickJSContext, QuickJSDeferredPromise, QuickJSHandle, QuickJSRuntime } from 'quickjs-emscripten-core';

/**
 * A gazda függvények közös környezete egy lépésben (SPEC-014 5.4).
 *
 * - `stringify`, `parse`: a lépés elején, a szkript előtt rögzített sandbox
 *   függvények; a gazda a sandbox argumentumait JSON szövegként olvassa, és az
 *   eredményt JSON szövegből építi, tehát objektum hivatkozás nem megy át (5.5).
 * - `signal`: a kérés jele és a lépés vége együtt; a folyamatban lévő hálózati
 *   kérés ezen szakad meg, és a jel után érkező gazda eredmény a sandboxot már
 *   nem érinti.
 * - `pendingCalls`: a még nem rendezett gazda hívások ígérete (`deferred`), a
 *   lebontás előtt felszabadítandó (research `2026-11-04-szkript-csomopont.md`
 *   Q-2 B).
 * - `reportHostCrash`: a gazdára kijutó hiba (például a mély `JSON.stringify`
 *   `RangeError`-ja a feloldás után futó feladatban, Q-6) a lépés hibája lesz.
 * - `isInterrupted`: az interrupt kezelő már megszakította a szkriptet (a
 *   határidő lejárt); ezután a gazda függvény sandbox kódot nem futtat
 *   (`install-host-functions.ts`).
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export interface HostCallScope {
  readonly context: QuickJSContext;
  readonly runtime: QuickJSRuntime;
  readonly stringify: QuickJSHandle;
  readonly parse: QuickJSHandle;
  readonly signal: AbortSignal;
  readonly pendingCalls: Set<QuickJSDeferredPromise>;
  readonly reportHostCrash: (error: unknown) => void;
  readonly isInterrupted: () => boolean;
}
