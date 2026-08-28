import type { BranchContext, BranchScope } from '../branch-scope/branch-scope.ts';

// Egy hatókör bejegyzés összehasonlítható alakja. Mind a három mező benne van,
// a `stepRunId` is, ugyanazzal a megfontolással, mint a `run-context` téma
// `findVisibleStepInstance` függvényében: nélküle két különböző `fan_out` node
// azonos sorszámú eleme azonos kontextusnak látszana.
function scopeKey(scope: BranchScope): readonly [string, string, number] {
  return scope.kind === 'fan_out'
    ? [scope.kind, scope.stepRunId, scope.itemIndex]
    : [scope.kind, scope.stepRunId, scope.iteration];
}

/**
 * Az ütemező nyilvántartásainak kulcsa: egy azonosító és egy ág kontextus
 * párja egyetlen sztringben (SPEC-004 4.3). Ugyanez az alak áll az élenkénti
 * jelölés, a `fan_out` kibontás és a `loop` lefutásszám kulcsán is, mert
 * mindhármat az `(azonosító, ág kontextus)` pár azonosítja, és egyik sem
 * határozható meg pusztán az azonosítóból.
 *
 * A kulcs JSON alak, nem elválasztó karakterrel összefűzött sztring: így a
 * keretek sorrendje és minden mezője egyértelműen kódolt, és egy azonosítóban
 * álló elválasztó karakter sem tud két különböző kulcsot egybemosni. Ugyanez a
 * megfontolás áll a `branch-scope` téma `scopeStackKey` és a `run-context`
 * téma `contextKey` függvénye mögött.
 *
 * **Élazonosító és node azonosító nem ütközhet egymással**, mert külön
 * térképekben áll a kettő; ezért nincs a kulcsban típusjelölő előtag.
 */
export function buildScopedKey(id: string, context: BranchContext): string {
  return JSON.stringify([id, context.map((scope) => scopeKey(scope))]);
}
