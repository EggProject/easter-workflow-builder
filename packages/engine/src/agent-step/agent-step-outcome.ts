import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';

/**
 * Egy agent lépés futtatásának üzleti eredménye (SPEC-004 5.2 9. pont).
 *
 * - `succeeded`: a `result` üzenet `subtype` értéke `success`, és ha a lépés
 *   strukturált kimenetet vár, az meg is érkezett. Az `output` a megérkezett
 *   strukturált kimenet; strukturált kimenetet nem váró lépésnél `undefined`,
 *   mert a `result` üzenet ilyenkor nem hordoz kimenet mezőt.
 * - `failed`: az `errorKind` a `step_run.error_kind` oszlopba kerülő
 *   hibaosztály, az `errorMessage` pedig a hozzá tartozó, F-24 konvenció
 *   szerinti üzenet, ami ugyanezt a nevet zárójelben is tartalmazza.
 *
 * **Miért nem az `Outcome` hibaága hordozza ezt.** A lépés hibája nem a
 * függvény hibája: a token adatok és a `result` `subtype` hibás lefutásnál is
 * megvannak, és a `step_run` sorra ugyanabban a záró tranzakcióban íródnak
 * (SPEC-003 4.10). Ezért az `AgentStepExecution` **sikeres** `Outcome` ágon
 * érkezik, és ez a mező mondja meg, `succeeded` vagy `failed` állapotba megy
 * a lépés.
 */
export type AgentStepOutcome =
  | { readonly status: 'succeeded'; readonly output: unknown }
  | { readonly status: 'failed'; readonly errorKind: EngineErrorKind; readonly errorMessage: string };
