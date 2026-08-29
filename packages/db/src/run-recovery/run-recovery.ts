import { and, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Outcome } from '@easter-workflow-builder/core';
import { workflowRunTable } from '../workflow-run/workflow-run.ts';
import type { RunStatus } from '../workflow-run/run-status.ts';
import { stepRunTable } from '../step-run/step-run.ts';
import type { StepRunStatus } from '../step-run/step-run-status.ts';
import { insertEngineEventRow } from '../run-event/event-record/insert-engine-event-row.ts';

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

export interface CancelRunTreeResult {
  readonly cancelledRunIds: readonly string[];
}

/**
 * Az indulási helyreállítás ÉS a felhasználói megszakítás közös felülete
 * (SPEC-003 7.4 szekció "Szerver leállás" bekezdés, SPEC-004 9. szekció).
 * **Nincs saját tábla ehhez a témához**: mindkét művelet a `workflow_run` és
 * a `step_run` táblát EGYÜTT érinti, ezért egyik táblás témába sem tartozik
 * (8. szekció, "a `run-recovery`" sor). A `recoverInterruptedRuns` a szerver
 * indulásakor fut, a `cancelRunTree` a `packages/engine` `run-interrupt`
 * témájának `interruptRun` művelete hívja, a felhasználó explicit
 * megszakítási kérésére (SPEC-004 9. szekció 5. pont).
 */
export interface RunRecovery {
  recoverInterruptedRuns(): Outcome<RecoverInterruptedRunsResult>;

  /**
   * Egy futás fája (a `rootRunId` és minden alá tartozó, azonos gyökerű
   * al-workflow futás) megszakítása: minden nem terminális (`pending`/
   * `running`) futás `cancelled` állapotba megy, a hozzájuk tartozó minden
   * nem terminális lépés futás szintén, és futásonként EGY `run_finished`
   * motor esemény íródik `status: 'cancelled'` payloaddal, egyetlen
   * tranzakcióban (SPEC-004 9. szekció 5. pont, 13. szekció táblázat). A
   * `root_run_id` oszlop szerinti szűrés (a `workflow_run_root_idx` index)
   * miatt a hívónak nem kell összegyűjtenie a fa futásainak azonosítóját: már
   * TERMINÁLIS futás és lépés érintetlen marad, tehát a metódus akkor is
   * biztonságosan hívható, ha a fának időközben egy része magától befejeződött
   * (`cancelledRunIds` üres lista, ha nincs mit megszakítani).
   */
  cancelRunTree(rootRunId: string): Outcome<CancelRunTreeResult>;
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
      // `insertEngineEventRow` (`run-event/event-record/insert-engine-event-row.ts`)
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

  /**
   * `cancelRunTree`, a felhasználói megszakítás (`interruptRun`, `engine`
   * `run-interrupt` téma) DB oldali zárása (SPEC-004 9. szekció 5. pont).
   * Ugyanaz a tömeges `UPDATE ... WHERE status IN (...) RETURNING id` minta,
   * mint a `recoverInterruptedRuns`-ban, két eltéréssel: a szűrés a
   * `root_run_id` oszlopra szűkít (a `workflow_run_root_idx` index, egyetlen
   * futás fájára, nem a teljes adatbázisra), és a célállapot `cancelled`,
   * `run_finished` eseménnyel `interrupted`/`run_interrupted` helyett - a
   * kettő a `workflow_run.status` oszlopban különbözteti meg a felhasználói
   * döntést (`cancelled`) a rendszer döntésétől (`interrupted`, SPEC-004 10.2
   * szekció "Miért `interrupted` és nem `cancelled`").
   *
   * A `run_finished` payload alakja szó szerint a `packages/engine`
   * `RunFinishedPayload` mezőit követi (`status`, `errorKind`, `errorMessage`,
   * `failedBranchCount`), hogy az élő és a visszaolvasott esemény egyezzen
   * (ugyanaz az elv, mint a `workflow-run-repository.ts` `run_started`
   * payloadjánál): a `db` csomag nem importálhatja az `engine` típusát
   * (fordított rétegirány lenne), ezért a mezőnevek itt szó szerint,
   * duplikálva állnak.
   */
  function cancelRunTree(rootRunId: string): Outcome<CancelRunTreeResult> {
    return transaction(() => {
      const now = new Date();

      const cancelledRuns = database
        .update(workflowRunTable)
        .set({ status: 'cancelled', finishedAtMs: now })
        .where(
          and(eq(workflowRunTable.rootRunId, rootRunId), inArray(workflowRunTable.status, NON_TERMINAL_RUN_STATUSES)),
        )
        .returning({ id: workflowRunTable.id })
        .all();

      if (cancelledRuns.length === 0) {
        return { kind: 'ok', value: { cancelledRunIds: [] } };
      }

      const runIds = cancelledRuns.map((row) => row.id);

      database
        .update(stepRunTable)
        .set({ status: 'cancelled', finishedAtMs: now })
        .where(and(inArray(stepRunTable.runId, runIds), inArray(stepRunTable.status, NON_TERMINAL_STEP_RUN_STATUSES)))
        .run();

      for (const runId of runIds) {
        insertEngineEventRow(database, {
          runId,
          // eslint-disable-next-line unicorn/no-null -- futás szintű esemény: a run_event.step_run_id valódi NULL értéke, nem helyőrző (SPEC-003 6.2 szekció)
          stepRunId: null,
          kind: 'run_finished',
          occurredAtMs: now,
          payload: {
            status: 'cancelled',
            // eslint-disable-next-line unicorn/no-null -- a `RunFinishedPayload.errorKind`/`errorMessage` `T | null` mezője: a felhasználói megszakítás nem hibaosztály, a `null` a "nincs hiba" valódi tárolt értéke (SPEC-004 13. szekció táblázat)
            errorKind: null,
            // eslint-disable-next-line unicorn/no-null -- lásd a fenti indoklást
            errorMessage: null,
            failedBranchCount: 0,
          },
        });
      }

      return { kind: 'ok', value: { cancelledRunIds: runIds } };
    });
  }

  return { recoverInterruptedRuns, cancelRunTree };
}
