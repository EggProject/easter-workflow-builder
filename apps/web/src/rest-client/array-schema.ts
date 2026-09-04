import type { SafeParsableSchema, SafeParseOutcome } from './safe-parsable-schema.ts';

/**
 * Egy elem sémából listaséma épít (SPEC-005 4.2 A és B táblázat lista
 * végpontjai: a válasz törzse csupasz tömb, nem burkolt objektum, lásd
 * `apps/server/src/workflow-endpoint/list-workflows.ts`). Kézzel írt
 * kombinátor, nem `z.array()`: az `apps/web` szándékosan nem veszi fel a
 * `zod` csomagot függőségként (SPEC-007 3.2), a tömb burkolása pedig nem
 * drótszintű alak, csak a már meglévő elem séma `.safeParse()` metódusát
 * hívja meg elemenként (`safe-parsable-schema.ts`).
 */
export function arraySchema<TValue>(itemSchema: SafeParsableSchema<TValue>): SafeParsableSchema<readonly TValue[]> {
  return {
    safeParse: (input: unknown): SafeParseOutcome<readonly TValue[]> => {
      if (!Array.isArray(input)) {
        return { success: false, error: { issues: [{ path: [] }] } };
      }
      const values: TValue[] = [];
      for (const [index, element] of input.entries()) {
        const parsed = itemSchema.safeParse(element);
        if (!parsed.success) {
          return {
            success: false,
            error: { issues: parsed.error.issues.map((issue) => ({ path: [index, ...issue.path] })) },
          };
        }
        values.push(parsed.data);
      }
      return { success: true, data: values };
    },
  };
}
