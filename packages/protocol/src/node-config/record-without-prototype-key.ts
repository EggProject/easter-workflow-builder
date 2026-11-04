import { z } from 'zod';
import { isRecord } from '@easter-workflow-builder/typeguards';

function hasNoPrototypeKey(value: unknown): boolean {
  return !isRecord(value) || !Object.hasOwn(value, '__proto__');
}

/**
 * Egy rekord séma, ami a bemenet saját `__proto__` kulcsát elutasítja
 * (PLAN-012 T-012-27). A `z.record` egy ilyen kulcsot (a `JSON.parse` saját
 * tulajdonságként hozza létre) csendben eldob (mérve, zod 4.4.3: a kulcs
 * sémája le sem fut rá), a `db` guardja viszont megtartaná; a két oldal így
 * csak az elutasítással dönt egyformán. Az ellenőrzés a nyers bemeneten fut,
 * a `pipe` után a megadott séma dönt; a `z.infer` eredménye a megadott séma
 * kimenete, tehát a `db` párral szembeni típusszintű sodródás védelem
 * változatlan.
 */
export function recordWithoutPrototypeKey<Schema extends z.ZodType>(schema: Schema): z.ZodPipe<z.ZodUnknown, Schema> {
  return z
    .unknown()
    .refine(hasNoPrototypeKey, { message: 'A rekord nem tartalmazhat __proto__ kulcsot.' })
    .pipe(schema);
}
