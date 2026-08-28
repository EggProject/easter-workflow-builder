import { isInt } from '@easter-workflow-builder/typeguards';
import type { GraphSnapshotDocumentVersion } from './graph-snapshot-document.ts';

/**
 * A kiadott verziók kulcsonként. A `Record<GraphSnapshotDocumentVersion, true>`
 * annotáció miatt a fordító hibát ad, ha az unió bővül, de ez a lista nem: a
 * guard így nem tud csendben ismeretlennek mondani egy már kiadott verziót.
 */
const GRAPH_DOCUMENT_VERSION_KEYS: Readonly<Record<GraphSnapshotDocumentVersion, true>> = {
  1: true,
};

/**
 * Ismert, a mai kód által olvasható dokumentumverzió-e a beolvasott szám
 * (SPEC-003 5.3, 3. és 5. lépés).
 *
 * Ez a guard teszi a `readGraphSnapshot` `switch` szerkezetét ténylegesen
 * kimerítővé: az ismeretlen számot a hívó **a switch előtt** zárja ki
 * `unknown_graph_document_version` hibaággal, tehát a switch már csak az ismert
 * unión fut, és egy jövőbeli verzió felvétele fordítási hibát ad addig, amíg a
 * hozzá tartozó `case` ág hiányzik.
 */
export function isGraphSnapshotDocumentVersion(value: unknown): value is GraphSnapshotDocumentVersion {
  return isInt(value) && Object.hasOwn(GRAPH_DOCUMENT_VERSION_KEYS, value);
}
