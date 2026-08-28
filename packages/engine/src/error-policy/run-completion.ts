import type { RunStatus } from '@easter-workflow-builder/db';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';

/**
 * Egy magától befejeződött futás záró állapota (SPEC-004 8.4). A négy mező
 * pontosan a `RunFinishedPayload` négy mezője, illetve a `markRunFailed`
 * két paramétere, hogy a `run-supervisor` (T-005-25) fordítás nélkül
 * továbbadhassa őket.
 *
 * **A `status` szándékosan csak két értéket vehet fel.** A `cancelled` a
 * felhasználó döntése (9. szekció), az `interrupted` a rendszeré (10.
 * szekció), a `pending` és a `running` pedig nem terminális - egyik sem
 * ennek a függvénynek a hatóköre. **Nincs `partially_succeeded` állapot**: a
 * `RunStatus` unió változatlanul hat értékű marad (8.4, PLAN-005 44.
 * elfogadási kritérium).
 *
 * A `failedBranchCount` a kezeletlen hibával elhalt ágak száma, ami a
 * `run_finished` esemény payloadjába megy. `fail_run` politika mellett ez
 * mindig 1, mert a futás az első kezeletlen hibánál leáll; `fail_branch`
 * mellett annyi, ahány ág elhalt.
 */
/**
 * **Miért diszkriminált unió, és nem négy, egymástól független mező.** A
 * `status` és a két hiba mező kitöltöttsége együtt mozog: `succeeded`
 * állapotban mindkettő `null`, `failed` állapotban mindkettő kitöltött. Egy
 * lapos alakban a hívónak (`run-supervisor`, T-005-25) a `markRunFailed(runId,
 * errorKind: string, errorMessage: string)` hívás előtt egy `?? ''` jellegű
 * szűkítést kellene írnia, aminek az egyik ága sosem futna le - a 100
 * százalékos, kizárás nélküli lefedettségi küszöb mellett pontosan az a fajta
 * ág, amit tilos bevezetni (`.claude/CLAUDE.md` 5. szekció). Az unió a
 * szűkítést a `status` mezőre bízza, tehát a hívónak nem keletkezik holt ága.
 */
export type RunCompletion =
  | {
      readonly status: Extract<RunStatus, 'succeeded'>;
      readonly errorKind: null;
      readonly errorMessage: null;
      readonly failedBranchCount: number;
    }
  | {
      readonly status: Extract<RunStatus, 'failed'>;
      readonly errorKind: EngineErrorKind;
      readonly errorMessage: string;
      readonly failedBranchCount: number;
    };
