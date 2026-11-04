import type { Settlement } from './settlement.ts';

/**
 * A szkript eredményének várakozása a gazda oldali határidővel és a kérés külső
 * jelével versenyeztetve (SPEC-014 5.4 "Időkorlát" (2) ág, 5.8). Ez az ág azért
 * kell, mert az interrupt kezelő a gazda ígéretre várakozás alatt nem fut
 * (research `2026-11-04-szkript-csomopont.md` Q-2), és egy soha fel nem oldott
 * ígéret is ide jut. A határidő saját, a végén törölt időzítő, nem
 * `AbortSignal.timeout`, mert annak időzítője `unref` (Q-2), és a törlése sem
 * lehetséges. A várt ígéret nem utasít el (a `resolvePromise` a hibát is
 * feloldott eredményként adja). A hívó a jel `aborted` állapotát a hívás előtt ellenőrzi, ezért a
 * figyelő csak a későbbi megszakításra vár.
 */
export async function waitForSettlement<TValue>(
  promise: Promise<TValue>,
  deadlineMs: number,
  signal: AbortSignal,
): Promise<Settlement<TValue>> {
  return new Promise((resolve) => {
    const onAbort = (): void => {
      finish({ kind: 'aborted' });
    };
    const timer = setTimeout(
      () => {
        finish({ kind: 'timed_out' });
      },
      Math.max(deadlineMs - Date.now(), 0),
    );
    function finish(settlement: Settlement<TValue>): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(settlement);
    }
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then((value) => {
      finish({ kind: 'settled', value });
    });
  });
}
