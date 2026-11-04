/**
 * Egy gazda függvény hívásának eredménye, mielőtt a sandbox ígérete
 * rendeződik (SPEC-014 5.4 "Hálózat" és "Fájl"). A `resolved` ág az érték JSON
 * szövege (a sandbox a lépés elején rögzített `JSON.parse`-szal értelmezi), vagy
 * `undefined`, ha az ígéret érték nélkül teljesül (`files.writeText`). A
 * `rejected` ág a sandboxban létrejövő hiba neve és üzenete; az üzenet a gazda
 * abszolút útvonalát nem tartalmazza, csak a szkript saját bemenetét.
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export type HostCallOutcome =
  | { readonly kind: 'resolved'; readonly json: string | undefined }
  | { readonly kind: 'rejected'; readonly name: 'Error' | 'TypeError'; readonly message: string };
