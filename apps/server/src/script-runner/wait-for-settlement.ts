import type { Settlement } from './settlement.ts';

/**
 * A szkript eredményének várakozása a gazda oldali határidővel versenyeztetve
 * (SPEC-014 5.4 "Időkorlát" (2) ág). Ez az ág azért kell, mert az interrupt
 * kezelő a gazda ígéretre várakozás alatt nem fut (research
 * `2026-11-04-szkript-csomopont.md` Q-2), és egy soha fel nem oldott ígéret is
 * ide jut. A határidő saját, a végén törölt időzítő, nem `AbortSignal.timeout`,
 * mert annak időzítője `unref` (Q-2), és a törlése sem lehetséges. A várt ígéret
 * nem utasít el (a `resolvePromise` a hibát is feloldott eredményként adja). A
 * külső leállítás nem itt dől el: a szülő a szkript folyamatát öli meg
 * (SPEC-017 4.4).
 */
export async function waitForSettlement<TValue>(
  promise: Promise<TValue>,
  deadlineMs: number,
): Promise<Settlement<TValue>> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => {
        resolve({ kind: 'timed_out' });
      },
      Math.max(deadlineMs - Date.now(), 0),
    );
    void promise.then((value) => {
      clearTimeout(timer);
      resolve({ kind: 'settled', value });
    });
  });
}
