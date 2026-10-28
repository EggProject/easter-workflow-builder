import type { SafeParsableSchema, SafeParseOutcome } from './safe-parsable-schema.ts';

/**
 * Az üres törzsű (`204`) válasz sémája: a `decodeResponseBody` a 204 válasz
 * törzsét `undefined` értékre dekódolja, ezt fogadja el. Kézzel írt, nem Zod
 * séma: az üres törzs nem drótszintű alak (nincs mezője), és az `apps/web`
 * nem veszi fel a `zod` csomagot (SPEC-007 3.2). Ilyen válasza a
 * `clearConcurrencyLimit` végpontnak van (SPEC-005 4.2 E táblázat 25. sora).
 */
export const emptyResponseSchema: SafeParsableSchema<undefined> = {
  safeParse: (input: unknown): SafeParseOutcome<undefined> =>
    input === undefined ? { success: true, data: undefined } : { success: false, error: { issues: [{ path: [] }] } },
};
