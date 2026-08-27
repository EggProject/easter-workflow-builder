import type { Outcome } from '@easter-workflow-builder/core';

/**
 * Mit tegyen a hívó a lenyomathoz tartozó sorral: használja fel a meglévőt,
 * vagy szúrjon be újat.
 */
export type SnapshotReuseDecision = 'reuse' | 'insert';

/**
 * A pillanatkép újrafelhasználás döntése, tiszta függvényben (SPEC-003 5.6,
 * "Ütközés kezelés", és 55. kritérium).
 *
 * A lenyomat önmagában nem elég: **tartalom összehasonlítás kell**, különben a
 * helyesség egy kriptográfiai feltevésen állna, aminek a sérülése csendben
 * hamis pillanatképet adna egy futásnak.
 *
 * - `storedDocument === null`, tehát nincs sor a lenyomathoz: `insert`.
 * - a tárolt szöveg **bájtra azonos** az újjal: `reuse`, nincs beszúrás.
 * - a tárolt szöveg eltér: `graph_snapshot_hash_collision` hibaág. Semmi nem
 *   íródik, és a meglévő sort a hívó nem használhatja fel.
 *
 * Így mindhárom ág közvetlenül tesztelhető, `sha256` ütközés előállítása
 * nélkül.
 */
export function resolveSnapshotReuse(
  storedDocument: string | null,
  canonicalText: string,
): Outcome<SnapshotReuseDecision> {
  if (storedDocument === null) {
    return { kind: 'ok', value: 'insert' };
  }
  if (storedDocument === canonicalText) {
    return { kind: 'ok', value: 'reuse' };
  }
  return {
    kind: 'error',
    message:
      'A lenyomathoz már tartozik pillanatkép sor, de a tárolt dokumentum eltér az újtól (graph_snapshot_hash_collision).',
  };
}
