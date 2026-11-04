import { isString } from '@easter-workflow-builder/typeguards';
import type { GraphSnapshotHash } from './graph-snapshot-hash.ts';

/**
 * A `sha256` lenyomat alakja: 256 bit, azaz 64 kisbetűs hexadecimális
 * karakter (SPEC-003 9.4 szekció, F-24). A `$` kapcsoló nélkül kizárólag a
 * szöveg végén illeszkedik, tehát egy záró sortörés sem fogadható el.
 */
const GRAPH_SNAPSHOT_HASH_PATTERN = /^[\da-f]{64}$/;

/**
64 karakteres kisbetűs hexadecimális szöveg-e a bemenet (SPEC-003 9.4 szekció).
*/
export function isGraphSnapshotHash(value: unknown): value is GraphSnapshotHash {
  return isString(value) && GRAPH_SNAPSHOT_HASH_PATTERN.test(value);
}
