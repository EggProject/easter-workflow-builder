import type { Outcome } from '@easter-workflow-builder/core';
import type { RecoverInterruptedRunsResult } from '@easter-workflow-builder/db';
import type { ConcurrencyGate } from '../concurrency-gate/concurrency-gate.ts';
import type { DatabaseContext } from '../engine-port/database-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { EngineEvent } from '../engine-event/engine-event.ts';
import type { ApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import type { RunSupervisor } from '../run-supervisor/run-supervisor.ts';
import type { AgentQueryRegistry } from './agent-query-registry.ts';
import { stopAndAwaitRunTree } from './stop-and-await-run-tree.ts';

/**
 * A `shutdownActiveRuns` függősége. A `runSupervisor` szándékosan csak a
 * `listActiveRuns` és a `stopAcceptingRuns` metódust várja (`Pick`, nem a
 * teljes `RunSupervisor`), ugyanaz az elv, mint az
 * `InterruptRunDependencies`-nél (`interrupt-run.ts`): ez a téma nem indít
 * futást és nem old fel providert, csak a MÁR futó futásokat kérdezi le, és
 * az újak indítását tiltja le. A `concurrencyGate` a motor egyetlen, közös
 * szabályozója, amit a leállás lezár (0. pont lent); ebből is csak a `close`
 * kell. Az `eventPublisher` a lezáró `run_interrupted` esemény élő kiadásához
 * kell (4. pont lent).
 */
export interface ShutdownActiveRunsDependencies {
  readonly database: DatabaseContext;
  readonly eventPublisher: EventPublisherPort;
  readonly runSupervisor: Pick<RunSupervisor, 'listActiveRuns' | 'stopAcceptingRuns'>;
  readonly concurrencyGate: Pick<ConcurrencyGate, 'close'>;
  readonly agentQueryRegistry: AgentQueryRegistry;
  readonly approvalRegistry: ApprovalWaitRegistry;
}

/**
 * A szabályos leállás teljes menete (SPEC-004 10.2 szekció, PLAN-005
 * T-005-27), a `createEngine` (T-005-28) `shutdown()` metódusának alapja.
 * `SIGINT`/`SIGTERM` esetén a hívó ezt hívja meg:
 *
 * 0. **Új futás és új lépés többé nem indul** (10.2 1. pont): a
 *    `runSupervisor.stopAcceptingRuns()` után minden futás indítás
 *    `engine_shutting_down` hibát ad, a `concurrencyGate.close()` után pedig
 *    egyetlen agent lépés sem kap helyet, a sorban állók sem. Mindkettő
 *    szinkron, és az 1. pont ELŐTT fut, tehát a lekérdezett lista a leállás
 *    teljes hatóköre marad. Mérve: e pont nélkül egy a jel előtt fogadott, de
 *    csak utána beérkező törzsű indító kérés új futást indított, aminek az
 *    agent lépése `interrupt()` nélkül végigfutott, és a kilépést a lépés
 *    teljes hosszával késleltette (SPEC-006 8.2).
 * 1. **MINDEN aktív futás lekérdezése** (`runSupervisor.listActiveRuns()`,
 *    NEM egyetlen futás fájára szűkítve, ellentétben az `interruptRun`-nal -
 *    a szabályos leállás a TELJES szervert viszi le, nem egy felhasználói
 *    kérést szolgál ki egyetlen futásra).
 * 2. **`stopAndAwaitRunTree`** (MÁR KÉSZ, T-005-26 - lásd ott) mindegyikükre:
 *    a szabályozó egyikükből sem enged több lépést indulni, minden élő
 *    agent lépés `AgentQuery`-jén lefut az `interrupt()`, és a függvény
 *    megvárja mindegyik `completion` Promise-át (10.2 szekció 1 ... 2. pont,
 *    ugyanaz a menet, mint a 9. szekció megszakításnál).
 * 3. **`database.recovery.recoverInterruptedRuns('graceful_shutdown')`**
 *    (MÁR KÉSZ `db` réteg, a `reason` paraméter a T-005-27 bővítése, lásd
 *    `packages/db` `run-recovery.ts`): EGYETLEN tranzakcióban minden
 *    `pending`/`running` futás és nem terminális lépésük `interrupted`
 *    állapotba megy, futásonként egy `run_interrupted` eseménnyel (10.2
 *    szekció 3. pont).
 * 4. **A lezáró esemény élő kiadása** (`eventPublisher.publish`) a 3. pont
 *    által visszaadott MINDEN futásra (`recoveredRunIds`, nem a kézikönyvek
 *    listája, mert a helyreállítás hatóköre a teljes adatbázis). A sort a
 *    `db` már megírta, ezért nincs `writeEngineEvent`, ugyanaz a minta, mint
 *    az `interruptRun` 5. pontja. Az élő SSE kapcsolatoknak ekkor még
 *    nyitva kell lenniük: ezt a szerver leállási sorrendje biztosítja
 *    (SPEC-006 8.2).
 *
 * **Miért NEM kell külön `interruptRunTree`-szerű, `rootRunId` szerint
 * szűkített DB primitíva.** A `stopAndAwaitRunTree` utáni 2. lépés
 * (`recoverInterruptedRuns`) semmilyen `rootRunId` szűrést nem kap: a 10.2
 * szekció szabályos leállása a szerver ÖSSZES aktív futására hat, ami
 * pontosan a `recoverInterruptedRuns` MEGLÉVŐ, teljes adatbázisra kiterjedő
 * hatóköre (10.1 szekció, ugyanaz, amit az indulási helyreállítás is hív). A
 * `cancelRunTree` (`root_run_id` szerint szűkített, `interruptRun` a T-005-26
 * óta) egy MÁSIK forgatókönyv (felhasználói megszakítás egyetlen futásra),
 * nem ennek a függvénynek a felhasználási esete. Ez pontosan a SPEC-004 10.2
 * szekció "A szabályos és a durva leállás ugyanoda érkezik ... nem kell
 * külön ágat karbantartani" mondatának a közvetlen következménye: a `db`
 * oldali zárás a startup-recovery témával AZONOS hívás, csak eltérő `reason`
 * értékkel (lásd `startup-recovery/run-startup-recovery.ts`).
 */
export async function shutdownActiveRuns(
  dependencies: ShutdownActiveRunsDependencies,
): Promise<Outcome<RecoverInterruptedRunsResult>> {
  dependencies.runSupervisor.stopAcceptingRuns();
  dependencies.concurrencyGate.close();
  const handles = dependencies.runSupervisor.listActiveRuns();
  await stopAndAwaitRunTree(handles, dependencies.agentQueryRegistry, dependencies.approvalRegistry);
  const recovered = dependencies.database.recovery.recoverInterruptedRuns('graceful_shutdown');
  if (recovered.kind === 'error') {
    return recovered;
  }

  for (const runId of recovered.value.recoveredRunIds) {
    dependencies.eventPublisher.publish({
      kind: 'run_interrupted',
      runId,
      // eslint-disable-next-line unicorn/no-null -- a `run_interrupted` futás szintű esemény, a `run_event.step_run_id` valódi NULL értéke (SPEC-003 6.2)
      stepRunId: null,
      payload: { reason: 'graceful_shutdown' },
    } satisfies EngineEvent);
  }

  return recovered;
}
