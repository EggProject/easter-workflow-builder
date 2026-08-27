import type { Outcome } from '@easter-workflow-builder/core';

/**
 * Az adatbázis kapcsolat felülete. A repository mezők a következő témák
 * elkészültével bővülnek ide (`workflow-graph`, `graph-snapshot`, ...); a
 * `sqlite-connection` téma egyelőre csak a tranzakciót és a zárást adja
 * (SPEC-003 9.1 szekció).
 */
export interface DatabaseContext {
  transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue>;
  close(): void;
}
