import type { FetchFunction } from '@easter-workflow-builder/core';

/**
 * A `FetchFunction` port böngésző oldali megvalósítása: a natív `fetch`
 * hívása, módosítás nélkül (SPEC-007 8.3).
 */
export const browserFetchFunction: FetchFunction = (input, init) => globalThis.fetch(input, init);
