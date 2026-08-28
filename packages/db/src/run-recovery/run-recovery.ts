import { and, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Outcome } from '@easter-workflow-builder/core';
import { workflowRunTable } from '../workflow-run/workflow-run.ts';
import type { RunStatus } from '../workflow-run/run-status.ts';
import { stepRunTable } from '../step-run/step-run.ts';
import type { StepRunStatus } from '../step-run/step-run-status.ts';
import { insertEngineEventRow } from '../run-event/insert-engine-event-row.ts';

/**
 * Ugyanaz az aláírás, mint a `DatabaseContext.transaction` (SPEC-003 9.1
 * szekció). Nem onnan importáljuk, hogy elkerüljük a kört, ugyanaz a minta,
 * mint a többi repository-ban (pl. `workflow-run-repository.ts`).
 */
type TransactionFunction = <TValue>(work: () => Outcome<TValue>) => Outcome<TValue>;

/**
 * A futás állapotgép két nem terminális állapota (SPEC-003 7.1 szekció:
 * "Terminális: succeeded, failed, cancelled, interrupted" - a maradék kettő
 * a nem terminális).
 */
const NON_TERMINAL_RUN_STATUSES: readonly RunStatus[] = ['pending', 'running'];

/**
 * A lépés futás állapotgép három nem terminális állapota (SPEC-003 7.2
 * szekció: "Terminális: succeeded, failed, rejected, cancelled, interrupted"
 * - a maradék három a nem terminális).
 */
const NON_TERMINAL_STEP_RUN_STATUSES: readonly StepRunStatus[] = ['pending', 'running', 'waiting_approval'];

export interface RecoverInterruptedRunsResult {
  readonly recoveredRunCount: number;
}

/**
 * Az indulási helyreállítás felülete (SPEC-003 7.4 szekció, "Szerver
 * leállás" bekezdés). **Nincs saját tábla ehhez a témához**: a
 * `workflow_run` és a `step_run` táblát EGYÜTT érinti, ezért egyik témába
 * sem tartozik (8. szekció, "a `run-recovery`" sor).
 */
export interface RunRecovery {
  recoverInterruptedRuns(): Outcome<RecoverInterruptedRunsResult>;
}

/**
 * `recoverInterruptedRuns` a szerver indulási helyreállítása (SPEC-003 7.4
 * szekció, PLAN-003 T-003-24). A hívó (egy KÉSŐBBI specifikációban az
 * `apps/server`) a saját indulásakor, minden hálózati kapcsolat fogadása
 * ELŐTT hívja meg; a `packages/db` csomag maga NEM hívja automatikusan (a
 * `db` réteg nem tudja, mikor "fogad hálózati kapcsolatot" - ez rögzített
 * tervezési döntés, nem hiányzó funkció).
 *
 * **Tömeges `UPDATE ... WHERE status IN (...)`, nem egyenkénti
 * `markRunInterrupted`/`markStepInterrupted` hívás iterálása** (SPEC-003 7.4
 * szekció pszeudokódja, PLAN-003 T-003-24 "Compare and set jelentése itt"
 * bekezdése). A két nevesített, egysoros állapotváltó
 * (`WorkflowRunRepository.markRunInterrupted`, `StepRunRepository.markStepInterrupted`,
 * T-003-24 zárta le, hogy hiányoztak a felületről) emiatt NEM ennek a
 * fájlnak a függősége: azok a saját témájukban (`workflow-run`, `step-run`)
 * élnek, önmagukban tesztelt, teljes állapotgép-lefedettséggel - a saját
 * `illegal_status_transition` águkat a saját `.spec.ts` fájljuk éri el,
 * közvetlen, valódi hívással (pl. egy már terminális futásra hívva).
 *
 * Ha `recoverInterruptedRuns` ezeket a metódusokat hívná soronként, egy
 * utólagos `isOkOutcome`-ellenőrzés a hibaágra ITT SOSEM futna le: ugyanabban
 * a tranzakcióban, ugyanazon a `better-sqlite3` kapcsolaton az imént
 * lekérdezett `pending`/`running` sor állapota nem változhat közben (F-8:
 * WAL módban is egyszerre egy író van), tehát a compare-and-set mindig
 * talál sort - egy ilyen, ebben a fájlban garantáltan holt ág bevezetése a
 * SPEC-003 12.4 szekció 100 százalékos, kizárás nélküli lefedettségi
 * küszöbét sértené. A tömeges `UPDATE` ugyanezt az eredményt adja, egyetlen
 * utasítással az összes érintett futásra/lépésre, holt ág nélkül - a
 * `WHERE status IN (...)` feltétel mindkét utasításban a `RunStatus`/
 * `StepRunStatus` unióból típusosan levezetett `NON_TERMINAL_*` listára épül
 * (lásd fent), nem szabad szövegre.
 */
export function createRunRecovery(database: BetterSQLite3Database, transaction: TransactionFunction): RunRecovery {
  function recoverInterruptedRuns(): Outcome<RecoverInterruptedRunsResult> {
    return transaction(() => {
      const now = new Date();

      // 1. Minden `pending` vagy `running` futás -> `interrupted` (SPEC-003
      // 7.4 szekció, 25. kritérium). A `RETURNING id` (SQLite 3.35+,
      // `better-sqlite3` 13.0.3) egy kérésben adja vissza az érintett
      // futások azonosítóját, ugyanaz a minta, mint a `transitionRun`
      // compare-and-set `UPDATE`-jében (`workflow-run-repository.ts`),
      // csak itt sok sorra egyszerre (`.all()`, nem `.get()`).
      const interruptedRuns = database
        .update(workflowRunTable)
        .set({ status: 'interrupted', finishedAtMs: now })
        .where(inArray(workflowRunTable.status, NON_TERMINAL_RUN_STATUSES))
        .returning({ id: workflowRunTable.id })
        .all();

      if (interruptedRuns.length === 0) {
        return { kind: 'ok', value: { recoveredRunCount: 0 } };
      }

      const runIds = interruptedRuns.map((row) => row.id);

      // 2. A hozzájuk tartozó MINDEN nem terminális lépés futás ->
      // `interrupted`, egyetlen tömeges `UPDATE`-tel (SPEC-003 7.2 szekció
      // nem terminális állapotai: pending, running, waiting_approval).
      // Szándékosan nincs `.returning()`: a beírt esemény futásonkénti, nem
      // lépésenkénti (lásd lent), tehát a frissített lépés futás sorokra
      // itt nincs szükség.
      database
        .update(stepRunTable)
        .set({ status: 'interrupted', finishedAtMs: now })
        .where(and(inArray(stepRunTable.runId, runIds), inArray(stepRunTable.status, NON_TERMINAL_STEP_RUN_STATUSES)))
        .run();

      // 3. Futásonként EGY `run_interrupted` motor esemény (SPEC-003 7.4
      // szekció szó szerint: "futásonként egy `run_interrupted` motor
      // esemény íródik", `origin: 'engine'`, `stepRunId: null`). Az
      // `insertEngineEventRow` (`run-event/insert-engine-event-row.ts`)
      // PLAIN, tranzakció nélküli segédfüggvény, ugyanúgy hívható itt, mint
      // a `workflow-run-repository.ts` `startRun`-jában a `run_started`
      // eseménynél. A visszaadott `Outcome`-ot ugyanazon okból nem
      // ágaztatjuk el, mint ott: a `not_found` hibaág logikailag kizárt,
      // mert a `runId` az imént, UGYANEBBEN a tranzakcióban lett kiolvasva
      // (a fenti `UPDATE ... RETURNING`) a `workflow_run` táblából - egy
      // elágazás ide egy soha nem futó, tesztelhetetlen ágat vinne be
      // (SPEC-003 12.4 szekció 100 százalékos lefedettségi küszöbe).
      for (const runId of runIds) {
        insertEngineEventRow(database, {
          runId,
          // eslint-disable-next-line unicorn/no-null -- futás szintű esemény: a run_event.step_run_id valódi NULL értéke, nem helyőrző (SPEC-003 6.2 szekció)
          stepRunId: null,
          kind: 'run_interrupted',
          occurredAtMs: now,
          payload: { runId },
        });
      }

      return { kind: 'ok', value: { recoveredRunCount: runIds.length } };
    });
  }

  return { recoverInterruptedRuns };
}
