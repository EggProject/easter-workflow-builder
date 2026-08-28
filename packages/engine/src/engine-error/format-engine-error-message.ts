import type { EngineErrorKind } from './engine-error-kind.ts';

/**
 * A motor hibaüzenetének formázója, az F-24 konvenció szerint (SPEC-004 5.
 * szekció: "Minden hibaüzenet ... zárójelben tartalmazza a hibaosztály
 * nevét", ugyanaz a minta, mint a `packages/db`
 * `read-graph-snapshot.ts`-ben). A `detail` már egy teljes, magyar mondat; a
 * függvény ehhez fűzi a hibaosztály nevét zárójelben, a végén ponttal.
 */
export function formatEngineErrorMessage(kind: EngineErrorKind, detail: string): string {
  return `${detail} (${kind}).`;
}
