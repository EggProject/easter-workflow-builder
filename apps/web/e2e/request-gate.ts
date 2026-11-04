/**
 * Kézzel nyitható kapu egy mockolt REST válasz visszatartásához: a kezelő a
 * `route.fulfill` előtt `await`-eli a `passed` ígéretet, a teszt pedig a
 * várakozás alatti állapotot (betöltés jelzés, tiltott gombok) állítja, és
 * csak utána hívja az `open`-t. Időzítő nincs (`.claude/CLAUDE.md` 11.
 * szekció); ugyanez a minta él a `wait-indicators.spec.ts` fájlban.
 */
export interface RequestGate {
  readonly open: () => void;
  readonly passed: Promise<undefined>;
}

export function createRequestGate(): RequestGate {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  return {
    open: () => {
      resolve(undefined);
    },
    passed: promise,
  };
}
