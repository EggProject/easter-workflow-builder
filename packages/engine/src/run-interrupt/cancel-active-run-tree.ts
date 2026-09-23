import type { Outcome } from '@easter-workflow-builder/core';
import type { CancelRunTreeResult } from '@easter-workflow-builder/db';
import type { ConcurrencyGate } from '../concurrency-gate/concurrency-gate.ts';
import type { DatabaseContext } from '../engine-port/database-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { EngineEvent } from '../engine-event/engine-event.ts';
import type { ApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';
import type { ActiveRunHandle } from '../run-supervisor/active-run-registry.ts';
import type { AgentQueryRegistry } from './agent-query-registry.ts';
import { closeWaitingApprovalStepRuns } from './close-waiting-approval-step-runs.ts';
import { stopAndAwaitRunTree } from './stop-and-await-run-tree.ts';

/**
 * A `cancelActiveRunTree` függőségei: a motor egyetlen, közös szabályozója,
 * jóváhagyás regisztere és `AgentQuery` nyilvántartása, plusz a két port, amin
 * a lezárás íródik és élőben kimegy.
 */
export interface CancelActiveRunTreeDependencies {
  readonly database: DatabaseContext;
  readonly eventPublisher: EventPublisherPort;
  readonly concurrencyGate: Pick<ConcurrencyGate, 'denyWaitingForRunIds'>;
  readonly agentQueryRegistry: AgentQueryRegistry;
  readonly approvalRegistry: ApprovalWaitRegistry;
}

/**
 * Aktív futások egy halmazának megszakítása `cancelled` záró állapottal: a
 * felhasználói megszakítás fa mechanizmusa (SPEC-004 9. szekció 2 ... 5.
 * pont), a hatókör kiválasztása nélkül. Két hívója van, és csak a hatókörben
 * térnek el:
 *
 * - az `interruptRun` a cél futás teljes fáját adja (`rootRunId` szerint), és
 *   a `cancelRunTree` primitívvel zár;
 * - a `fail_run` hibapolitika a bukott futás al-workflow futásait adja (a
 *   `run-supervisor` `cancelChildRunTrees` művelete, `parentRunId` lánc), és a
 *   `cancelRuns` primitívvel zár, mert a bukott futás maga `failed`, nem
 *   `cancelled` (SPEC-004 8.3, 8.4, user döntés 2026-09-23).
 *
 * A menet, ebben a sorrendben:
 *
 * 1. A futások döntésre váró jóváhagyásainak sora `cancelled`
 *    (`closeWaitingApprovalStepRuns`), ugyanabban a szinkron menetben, mint a
 *    várakozásuk lezárása a 2. pontban: a futó lépések leállásáig tartó
 *    ablakban érkező döntés így a sor állapotán bukik
 *    (`illegal_status_transition`). Ha az írás hibázik, a függvény a futások
 *    leállítása nélkül adja vissza a hibát.
 * 2. `requestStop()`, a sorban álló agent lépések elutasítása, a várakozások
 *    lezárása, `interrupt()` a futó agent lépéseken, majd a futások
 *    `completion` Promise-ának megvárása (`stopAndAwaitRunTree`).
 * 3. A DB oldali zárás egy tranzakcióban (`closeInDatabase`): a nem terminális
 *    futások és lépéseik `cancelled`, futásonként egy `run_finished` esemény.
 * 4. A `run_finished` esemény élő kiadása a ténylegesen lezárt futásokra, a
 *    sikeres DB zárás UTÁN: a sort a 3. pont tranzakciója már megírta, és a
 *    leállított léptető hurok szándékosan nem ad ki semmit (`advance-run.ts`
 *    `finishRun`).
 */
export async function cancelActiveRunTree(
  handles: readonly ActiveRunHandle[],
  closeInDatabase: () => Outcome<CancelRunTreeResult>,
  dependencies: CancelActiveRunTreeDependencies,
): Promise<Outcome<CancelRunTreeResult>> {
  const approvalsClosed = closeWaitingApprovalStepRuns(
    new Set(handles.map((handle) => handle.runId)),
    'cancelled',
    dependencies.database,
  );
  if (approvalsClosed.kind === 'error') {
    return approvalsClosed;
  }
  await stopAndAwaitRunTree(
    handles,
    'cancelled',
    dependencies.agentQueryRegistry,
    dependencies.approvalRegistry,
    dependencies.concurrencyGate,
  );

  const cancelled = closeInDatabase();
  if (cancelled.kind === 'error') {
    return cancelled;
  }

  // A payload mezőről mezőre az, amit a `db` a sorba írt.
  for (const cancelledRunId of cancelled.value.cancelledRunIds) {
    dependencies.eventPublisher.publish({
      kind: 'run_finished',
      runId: cancelledRunId,
      // eslint-disable-next-line unicorn/no-null -- a `run_finished` futás szintű esemény, a `run_event.step_run_id` valódi NULL értéke (SPEC-003 6.2)
      stepRunId: null,
      // eslint-disable-next-line unicorn/no-null -- a megszakítás nem hibaosztály, a `null` a "nincs hiba" valódi értéke (SPEC-004 13. szekció)
      payload: { status: 'cancelled', errorKind: null, errorMessage: null, failedBranchCount: 0 },
    } satisfies EngineEvent);
  }

  return cancelled;
}
