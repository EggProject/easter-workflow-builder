import type { Outcome } from '@easter-workflow-builder/core';
import type { SnapshotEdge, StepRunRecord } from '@easter-workflow-builder/db';
import type { BranchContext } from '../branch-scope/branch-scope.ts';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { FailureEscapeKey } from '../error-policy/resolve-error-route.ts';
import { resolveErrorRoute } from '../error-policy/resolve-error-route.ts';
import { resolveRunCompletion } from '../error-policy/resolve-run-completion.ts';
import type { RunCompletion } from '../error-policy/run-completion.ts';
import { emitEngineEvent } from '../node-executor/emit-engine-event.ts';
import { executeNode } from '../node-executor/execute-node.ts';
import type { ExecuteNodeRequest } from '../node-executor/execute-node-request.ts';
import type { NodeExecutionInstance } from '../node-executor/node-executor-instance.ts';
import type { NodeExecutionOutcome } from '../node-executor/node-executor-outcome.ts';
import type { NodeExecutorDependencies } from '../node-executor/node-executor-dependencies.ts';
import { buildRunContext } from '../run-context/build-run-context.ts';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import { advanceScheduler } from '../scheduling/advance-scheduler.ts';
import { buildScopedKey } from '../scheduling/build-scoped-key.ts';
import { collectJoinInputs } from '../scheduling/collect-join-inputs.ts';
import { enqueueReadyInstance } from '../scheduling/enqueue-ready-instance.ts';
import { resolveFanOutItem } from '../scheduling/resolve-fan-out-item.ts';
import { resolveLoopIteration } from '../scheduling/resolve-loop-iteration.ts';
import { takeNextReadyInstance } from '../scheduling/take-next-ready-instance.ts';
import type { NodePlan, RunExecution } from './run-execution.ts';

// Halott vagy elhalt ág: egyetlen kimenő élre sem kerül `live` jelölés
// (SPEC-004 4.4 3. pont, 8.3 `fail_branch`).
const NO_LIVE_EDGE_IDS: ReadonlySet<string> = new Set();

// Egy lezárult végrehajtás, ahogy a hurok megkapja: a példány, a terve és a
// `executeNode` eredménye.
interface CompletedExecution {
  readonly instance: StepInstanceReference;
  readonly plan: NodePlan;
  readonly outcome: Outcome<NodeExecutionOutcome>;
}

const OK: Outcome<void> = { kind: 'ok', value: undefined };

function instanceKeyOf(instance: StepInstanceReference): string {
  return buildScopedKey(instance.nodeId, instance.branchContext);
}

// A `step_run.parent_step_run_id` a verem tetején álló hatókör bejegyzés
// `stepRunId` értéke, üres veremnél `null` (SPEC-004 4.3).
function parentStepRunIdOf(context: BranchContext): string | null {
  const innermost = context.at(-1);
  // eslint-disable-next-line unicorn/no-null -- a gyökér kontextusban futó példánynak valóban nincs szülő lépés futása (SPEC-004 4.3), ez a `step_run.parent_step_run_id` oszlop NULL értéke
  return innermost === undefined ? null : innermost.stepRunId;
}

// A `step_run.iteration` általános szabálya: a legfelső `loop` hatókör
// bejegyzés iterációja, `loop` keret nélkül 0 (SPEC-004 4.3). A `loop` node
// SAJÁT sorára ez nem érvényes, ott a példány addigi lefutásainak száma áll
// (4.6 1. pont) - lásd az `iterationOf` függvényt.
function innermostLoopIteration(context: BranchContext): number {
  let iteration = 0;
  for (const scope of context) {
    if (scope.kind === 'loop') {
      iteration = scope.iteration;
    }
  }
  return iteration;
}

function iterationOf(execution: RunExecution, plan: NodePlan, instance: StepInstanceReference): number {
  return plan.config.type === 'loop'
    ? resolveLoopIteration(execution.scheduler, instance)
    : innermostLoopIteration(instance.branchContext);
}

// Egy node kimenő éleinek azonosítói egy szűrő szerint. A `live` jelölés
// mindig él azonosítókon áll, a végrehajtó viszont csak `branch_key` szintű
// döntést ad vissza (`node-executor-outcome.ts`), ezért a fordítás itt
// történik.
// Egy node kimenő élei. A `buildExecutableGraph` csak azokhoz a node-okhoz vesz
// fel bejegyzést, amikhez tartozik él, tehát a terminális node-ra a térkép
// semmit nem ad; a hiány üres listát jelent, nem hibát. Egyetlen helyen áll,
// hogy a hiány kezelése ne ismétlődjön hívónként.
function outgoingEdgesOf(execution: RunExecution, nodeId: string): readonly SnapshotEdge[] {
  return execution.topology.graph.outgoingEdges.get(nodeId) ?? [];
}

function edgeIdsWhere(
  execution: RunExecution,
  nodeId: string,
  isLiveEdge: (branchKey: string | null) => boolean,
): ReadonlySet<string> {
  const edgeIds = new Set<string>();
  for (const edge of outgoingEdgesOf(execution, nodeId)) {
    if (isLiveEdge(edge.branchKey)) {
      edgeIds.add(edge.id);
    }
  }
  return edgeIds;
}

// A `selectedBranchKey: null` jelentése: minden `on_error`-tól különböző
// kimenő él `live` (SPEC-004 4.4 4. pont).
function liveEdgesForSuccess(
  execution: RunExecution,
  nodeId: string,
  selectedBranchKey: string | null,
): ReadonlySet<string> {
  const isLiveEdge =
    selectedBranchKey === null
      ? (branchKey: string | null): boolean => branchKey !== 'on_error'
      : (branchKey: string | null): boolean => branchKey === selectedBranchKey;
  return edgeIdsWhere(execution, nodeId, isLiveEdge);
}

function completeNode(
  execution: RunExecution,
  instance: StepInstanceReference,
  liveEdgeIds: ReadonlySet<string>,
): void {
  execution.scheduler = advanceScheduler(execution.scheduler, execution.topology, {
    kind: 'node_completed',
    instance,
    liveEdgeIds,
  });
}

/**
 * Egy lezárult, de **nem végleges sorsú** példány jelölése: csak a
 * `liveEdgeIds` élek kapnak `live` jelölést, a többi vár (`scheduling-event.ts`
 * "Miért kell a halasztás"). Két hívási helye van, mindkettő az
 * újrapróbálkozás menetében (8.2):
 *
 * - a hibára futott példány, aminek van `on_error` éle: a kezelő még
 *   ütemezhet újabb kísérletet, és akkor a megismételt lefutás jelöl
 *   (8.2 5. pont);
 * - az `error_handler`, ami újabb kísérletet ütemezett: a saját `exhausted`
 *   éle csak akkor dől el, amikor a kezelő utoljára fut le, ezért az üres
 *   `liveEdgeIds` halmazzal EGYETLEN éle sem kap jelölést - `dead` sem.
 */
function deferOutgoingMarks(
  execution: RunExecution,
  instance: StepInstanceReference,
  liveEdgeIds: ReadonlySet<string>,
): void {
  execution.scheduler = advanceScheduler(execution.scheduler, execution.topology, {
    kind: 'outgoing_marks_deferred',
    instance,
    liveEdgeIds,
  });
}

// A lefutott példány felvétele a nyilvántartásokba. **Hibás lefutás is
// bekerül**: a `steps` rekord (6.2) és a `join` bemenetek (5.6) a példány
// legutolsó lefutását nézik, és a retry pontosan azt jelenti, hogy ugyanannak
// a példánynak több lefutása van (`ExecutedStepInstance` doksija).
function recordExecuted(execution: RunExecution, instance: StepInstanceReference, stepRun: StepRunRecord): void {
  execution.executedInstances.push({
    nodeId: instance.nodeId,
    branchContext: instance.branchContext,
    output: stepRun.output,
  });
  const sdkSessionId = stepRun.sdkSessionId;
  if (sdkSessionId !== null) {
    execution.sessionInstances.push({ nodeId: instance.nodeId, branchContext: instance.branchContext, sdkSessionId });
  }
}

/**
 * A hiba útja (SPEC-004 8.1) és a lépésenként állítható hibapolitika (8.3) egy
 * lezárult, sikertelen példányra. A döntést a tiszta `resolveErrorRoute` adja;
 * itt kizárólag a következményei állnak.
 *
 * Kezelt hiba esetén a menekülő élek `live` jelölést kapnak, és - kizárólag az
 * `on_error` úton - a cél `error_handler` példány kulcsa alatt eltároljuk a
 * hiba adatait, mert a kezelő végrehajtása azokat kéri (8.2 bevezető). Az
 * `exhausted` és a `rejected` menekülő él célja nem `error_handler` node,
 * tehát ott nincs mit eltárolni.
 *
 * **Az `on_error` út az `outgoing_marks_deferred` eseménnyel megy, nem a
 * `node_completed` eseménnyel**: a nem menekülő élek jelölése elhalasztódik,
 * amíg a kezelő el nem dönti, indul-e újabb kísérlet (8.2 5. pont, lásd a
 * `scheduling-event.ts` "Miért kell a halasztás" bekezdését és a
 * `settleDeferredFailure` függvényt). A másik két menekülő kulcs
 * (`exhausted`, `rejected`) után nincs újrapróbálkozás, tehát ott a jelölés
 * azonnal végleges.
 */
function applyFailureRoute(
  execution: RunExecution,
  plan: NodePlan,
  instance: StepInstanceReference,
  failure: { readonly errorKind: EngineErrorKind; readonly errorMessage: string; readonly attempt: number },
  escapeKey: FailureEscapeKey,
): void {
  const route = resolveErrorRoute({
    graph: execution.topology.graph,
    nodeId: instance.nodeId,
    escapeKey,
    onUnhandledError: plan.onUnhandledError,
  });

  if (route.kind === 'handled') {
    if (escapeKey === 'on_error') {
      rememberPendingFailure(execution, instance, route.liveEdgeIds, failure);
      deferOutgoingMarks(execution, instance, route.liveEdgeIds);
      return;
    }
    completeNode(execution, instance, route.liveEdgeIds);
    return;
  }

  execution.unhandledErrors.push({ nodeId: instance.nodeId, errorKind: failure.errorKind });
  completeNode(execution, instance, NO_LIVE_EDGE_IDS);
  if (route.kind === 'fail_run') {
    execution.failRunRequested = true;
  }
}

// Az `on_error` élek célján álló `error_handler` példányok kulcsa alá teszi a
// hiba adatait. A cél példány ág kontextusa azonos a hibára futott példányéval:
// az `on_error` él nem nyit hatókört (`advance-scheduler.ts`
// `isScopeOpeningEdge`).
function rememberPendingFailure(
  execution: RunExecution,
  instance: StepInstanceReference,
  liveEdgeIds: ReadonlySet<string>,
  failure: { readonly errorKind: EngineErrorKind; readonly errorMessage: string; readonly attempt: number },
): void {
  for (const edge of outgoingEdgesOf(execution, instance.nodeId)) {
    if (liveEdgeIds.has(edge.id)) {
      execution.pendingFailures.set(buildScopedKey(edge.targetNodeId, instance.branchContext), {
        failedInstance: instance,
        errorKind: failure.errorKind,
        errorMessage: failure.errorMessage,
        attempt: failure.attempt,
        escapeEdgeIds: liveEdgeIds,
      });
    }
  }
}

/**
 * A hibára futott példányon elhalasztott `dead` jelölések véglegesítése
 * (SPEC-004 4.4 5. pont).
 *
 * A hívás feltétele: a hibakontextust fogyasztó példány - az `on_error` él
 * célján álló `error_handler` (`validateErrorHandlerEdges`) - **nem**
 * `retry_scheduled` eredménnyel zárt, tehát a hibára futott példány már nem
 * fog újra lefutni. Ilyenkor a kimenő élei `dead` jelölést kapnak, a menekülő
 * élt kihagyva, mert az az `outgoing_marks_deferred` eseményen már `live`
 * jelölést kapott, és a felülírása visszamenőleg halottá tenné a lefutott
 * kezelőt.
 *
 * A jelölés nélkül a hibás ág nem terjedne tovább: egy több bejövő élű
 * leszármazott, aminek egy másik ága `live`, a 4.4 2. pontja szerint
 * futtatható, ezért a halasztás nem maradhat örökre nyitva.
 */
function settleDeferredFailure(execution: RunExecution, instance: StepInstanceReference): void {
  const instanceKey = instanceKeyOf(instance);
  const failure = execution.pendingFailures.get(instanceKey);
  if (failure === undefined) {
    return;
  }
  execution.pendingFailures.delete(instanceKey);
  execution.scheduler = advanceScheduler(execution.scheduler, execution.topology, {
    kind: 'deferred_marks_settled',
    instance: failure.failedInstance,
    keptEdgeIds: failure.escapeEdgeIds,
  });
}

/**
 * Egy sikeres `error_handler` lefutás következménye (SPEC-004 8.2 4. és 5. pont): a hibát adó példány újra sorba áll, `attempt + 1` értékkel, és a
 * vezérlés a **megismételt node** saját kimenő élein megy tovább, nem a
 * kezelőén.
 *
 * **A kezelő kimenő élei ilyenkor jelöletlenek maradnak**, nem `dead`
 * jelölést kapnak. A kezelő ugyanis még lefuthat mégegyszer: ha a megismételt
 * lépés ismét hibázik, az `on_error` éle újra `live` jelölést kap, és a
 * következő lefutás akár az `exhausted` ágra is mehet (8.2 2. pont). Egy
 * korai `dead` jelölés az `exhausted` élen ugyanazt a hibát okozná, mint a
 * hibára futott példány korai jelölése: egy több bejövő élű leszármazott
 * kétszer futna le (`scheduling-event.ts` "Miért kell a halasztás").
 *
 * A halasztás nem marad örökre nyitva: sikeres újrapróbálkozás után a
 * megismételt példány `on_error` éle `dead` jelölést kap, ettől a kezelő
 * példány halottá válik, és a halott ág terjesztése jelöli meg a kezelő
 * kimenő éleit (`advance-scheduler.ts` `settleInstance`).
 */
function applyRetryScheduled(
  execution: RunExecution,
  instance: StepInstanceReference,
  nextAttempt: number,
): Outcome<void> {
  const handlerKey = instanceKeyOf(instance);
  const failure = execution.pendingFailures.get(handlerKey);
  if (failure === undefined) {
    return internalError(`A(z) ${instance.nodeId} error_handler példányához nem tartozik hibakontextus`);
  }
  execution.pendingFailures.delete(handlerKey);
  execution.retryAttempts.set(instanceKeyOf(failure.failedInstance), nextAttempt);
  execution.scheduler = enqueueReadyInstance(execution.scheduler, failure.failedInstance);
  deferOutgoingMarks(execution, instance, NO_LIVE_EDGE_IDS);
  return OK;
}

function internalError(detail: string): Outcome<never> {
  return { kind: 'error', message: formatEngineErrorMessage('run_execution_failed', detail) };
}

/**
 * Egy lezárult végrehajtás beépítése a futás állapotába: a `NodeExecutionOutcome`
 * hét ága leképezve a `scheduling` téma három `SchedulingEvent` ágára, illetve
 * a hibakezelésre (`node-executor-outcome.ts` szerződése).
 */
function applyCompletion(execution: RunExecution, completed: CompletedExecution): Outcome<void> {
  const { instance, plan, outcome } = completed;
  if (outcome.kind === 'error') {
    return outcome;
  }
  const value = outcome.value;
  recordExecuted(execution, instance, value.stepRun);

  // A hiba útja lezárult: ha ez a példány egy hibakontextust fogyasztó
  // `error_handler`, és NEM újabb kísérletet ütemezett, a hibára futott
  // példány elhalasztott jelölései véglegesíthetők (8.2 5. pont).
  if (value.kind !== 'retry_scheduled') {
    settleDeferredFailure(execution, instance);
  }

  switch (value.kind) {
    case 'succeeded': {
      completeNode(execution, instance, liveEdgesForSuccess(execution, instance.nodeId, value.selectedBranchKey));
      return OK;
    }
    case 'fan_out_expanded': {
      execution.scheduler = advanceScheduler(execution.scheduler, execution.topology, {
        kind: 'fan_out_expanded',
        instance,
        stepRunId: value.stepRun.id,
        items: value.items,
      });
      return OK;
    }
    case 'loop_advanced': {
      execution.scheduler = advanceScheduler(execution.scheduler, execution.topology, {
        kind: 'loop_advanced',
        instance,
        stepRunId: value.stepRun.id,
        shouldContinue: value.shouldContinue,
      });
      return OK;
    }
    case 'approval_decided': {
      applyApprovalDecision(execution, plan, instance, value);
      return OK;
    }
    case 'retry_scheduled': {
      return applyRetryScheduled(execution, instance, value.nextAttempt);
    }
    case 'retry_exhausted': {
      applyFailureRoute(
        execution,
        plan,
        instance,
        { ...failureOf(value), attempt: value.stepRun.attempt },
        'exhausted',
      );
      return OK;
    }
    case 'failed': {
      applyFailureRoute(execution, plan, instance, { ...failureOf(value), attempt: value.stepRun.attempt }, 'on_error');
      return OK;
    }
  }
}

function failureOf(value: Extract<NodeExecutionOutcome, { readonly errorKind: EngineErrorKind }>): {
  readonly errorKind: EngineErrorKind;
  readonly errorMessage: string;
} {
  return { errorKind: value.errorKind, errorMessage: value.errorMessage };
}

/**
 * A `human_approval` döntésének leképezése (SPEC-004 5.8 utolsó pontja).
 * `approved`: a `live` jelölés az `approved` élekre megy. `rejected`: ha van
 * `rejected` kimenő él, a vezérlés arra megy; ha nincs, a 8.3 hibapolitika
 * következik `approval_rejected` osztállyal - ez pontosan ugyanaz a döntési
 * fa, mint a hibáé, csak a menekülő él kulcsa `rejected`.
 */
function applyApprovalDecision(
  execution: RunExecution,
  plan: NodePlan,
  instance: StepInstanceReference,
  value: Extract<NodeExecutionOutcome, { readonly kind: 'approval_decided' }>,
): void {
  if (value.decision === 'approved') {
    completeNode(execution, instance, liveEdgesForSuccess(execution, instance.nodeId, 'approved'));
    return;
  }

  const errorMessage = formatEngineErrorMessage(
    'approval_rejected',
    `A(z) "${instance.nodeId}" human_approval lépését elutasították`,
  );
  applyFailureRoute(
    execution,
    plan,
    instance,
    { errorKind: 'approval_rejected', errorMessage, attempt: value.stepRun.attempt },
    'rejected',
  );
}

/**
 * A `executeNode` kérésének összeállítása egy futtathatóvá vált példányhoz. A
 * tíz mező mindegyike a futás állapotából jön (`execute-node-request.ts`
 * doksija).
 */
function buildRequest(
  execution: RunExecution,
  plan: NodePlan,
  instance: StepInstanceReference,
): Outcome<ExecuteNodeRequest> {
  const nodeInstance: NodeExecutionInstance = {
    runId: execution.runId,
    instance,
    parentStepRunId: parentStepRunIdOf(instance.branchContext),
    iteration: iterationOf(execution, plan, instance),
    attempt: execution.retryAttempts.get(instanceKeyOf(instance)) ?? 1,
    providerId: plan.providerId,
  };
  const joinInputs = collectJoinInputs(execution.scheduler, execution.topology, execution.executedInstances, instance);
  const failure = execution.pendingFailures.get(instanceKeyOf(instance));

  const common = {
    instance: nodeInstance,
    runContext: buildRunContext({
      graph: execution.topology.graph,
      executedInstances: execution.executedInstances,
      instance,
      input: execution.runInput,
      item: resolveFanOutItem(execution.scheduler, instance.branchContext),
      ...(plan.config.type === 'join' && { joinInputs }),
      ...(failure !== undefined && { error: { kind: failure.errorKind, message: failure.errorMessage } }),
    }),
    graph: execution.topology.graph,
    executedInstances: execution.executedInstances,
    runInput: execution.runInput,
    availableBranchKeys: plan.availableBranchKeys,
    joinInputs,
    descriptor: plan.descriptor,
    sessionSourceNodes: execution.sessionSourceNodes,
    sessionInstances: execution.sessionInstances,
  };

  const config = plan.config;
  if (config.type !== 'error_handler') {
    return { kind: 'ok', value: { ...common, kind: 'node', config } };
  }
  if (failure === undefined) {
    return internalError(
      `A(z) ${instance.nodeId} error_handler példánya nem on_error élen vált futtathatóvá, tehát nincs hozzá hibakontextus`,
    );
  }
  return {
    kind: 'ok',
    value: {
      ...common,
      kind: 'error_handler',
      config,
      failedErrorKind: failure.errorKind,
      failedAttempt: failure.attempt,
    },
  };
}

// Egy példány végrehajtása, a `CompletedExecution` alakra fűzve. Külön
// függvény, mert a `.then()` láncolást a `unicorn/prefer-await` szabály nem
// engedi, `await` viszont csak `async` függvényben állhat.
async function runInstance(
  request: ExecuteNodeRequest,
  dependencies: NodeExecutorDependencies,
  instance: StepInstanceReference,
  plan: NodePlan,
): Promise<CompletedExecution> {
  const outcome = await executeNode(request, dependencies);
  return { instance, plan, outcome };
}

/**
 * Minden jelenleg futtatható példány elindítása. A hurok **nem várja meg**,
 * hogy egy lépés helyet kapjon a párhuzamossági szabályozótól: az `agent_step`
 * és a `join` `ai_synthesis` végrehajtója maga áll sorba (7.2), tehát a
 * "azonnali indítás" itt az async végrehajtás elindítását jelenti, nem a
 * tényleges provider hívást.
 */
function startReadyInstances(
  execution: RunExecution,
  dependencies: NodeExecutorDependencies,
  inFlight: Map<string, Promise<CompletedExecution>>,
): Outcome<void> {
  for (;;) {
    const taken = takeNextReadyInstance(execution.scheduler);
    if (taken === undefined) {
      return OK;
    }
    execution.scheduler = taken.state;

    const instance = taken.ready.instance;
    const plan = execution.nodePlans.get(instance.nodeId);
    if (plan === undefined) {
      return internalError(`A(z) ${instance.nodeId} node-hoz nem tartozik végrehajtási terv`);
    }

    const request = buildRequest(execution, plan, instance);
    if (request.kind === 'error') {
      return request;
    }

    inFlight.set(instanceKeyOf(instance), runInstance(request.value, dependencies, instance, plan));
  }
}

/**
 * A léptető hurok (SPEC-004 4.4 ... 4.6): amíg van futtatható vagy futó
 * példány, minden futtathatót elindít, majd megvárja, hogy **legalább egy**
 * befejeződjön, és az eredményét beépíti a futás állapotába.
 *
 * **`fail_run` és külső leállítás után nem indul új lépés**, a már futók
 * viszont befejeződnek. A futó lépések tényleges megszakítása (az SDK
 * `interrupt()` hívása) a `run-interrupt` téma dolga (9. szekció, T-005-26):
 * ez a téma a saját hatáskörében annyit tesz, hogy a futásból nem enged több
 * lépést indulni - ez a 9. szekció 2. pontja, a 3. pont marad a T-005-26-nak.
 */
async function runSchedulingLoop(
  execution: RunExecution,
  dependencies: NodeExecutorDependencies,
): Promise<Outcome<void>> {
  const inFlight = new Map<string, Promise<CompletedExecution>>();

  for (;;) {
    if (!execution.failRunRequested && !execution.stopRequested) {
      const started = startReadyInstances(execution, dependencies, inFlight);
      if (started.kind === 'error') {
        return started;
      }
    }
    if (inFlight.size === 0) {
      return OK;
    }

    const completed = await Promise.race(inFlight.values());
    inFlight.delete(instanceKeyOf(completed.instance));

    const applied = applyCompletion(execution, completed);
    if (applied.kind === 'error') {
      return applied;
    }
  }
}

/**
 * A futás záró állapotának kiírása (SPEC-004 8.4): `resolveRunCompletion`,
 * majd a megfelelő nevesített állapotváltó és a `run_finished` esemény.
 *
 * **Külső leállítás után nem írunk állapotot.** A megszakítás (9. szekció 5. pont) és a szabályos leállás (10.2) a futást és minden nem terminális lépését
 * egyetlen tranzakcióban zárja le; ha a hurok is írna, két, egymással
 * versenyző állapotváltás keletkezne ugyanarra a sorra.
 */
function finishRun(execution: RunExecution, dependencies: NodeExecutorDependencies): Outcome<RunCompletion> {
  const completion = resolveRunCompletion(execution.unhandledErrors);
  if (execution.stopRequested) {
    return { kind: 'ok', value: completion };
  }

  const { database } = dependencies.ports;
  const marked =
    completion.status === 'succeeded'
      ? database.runs.markRunSucceeded(execution.runId)
      : database.runs.markRunFailed(execution.runId, completion.errorKind, completion.errorMessage);
  if (marked.kind === 'error') {
    return marked;
  }

  const emitted = emitEngineEvent(
    {
      kind: 'run_finished',
      runId: execution.runId,
      // eslint-disable-next-line unicorn/no-null -- a `run_finished` futás szintű esemény, a `run_event.step_run_id` valódi NULL értéke (SPEC-003 6.2)
      stepRunId: null,
      payload: {
        status: completion.status,
        errorKind: completion.errorKind,
        errorMessage: completion.errorMessage,
        failedBranchCount: completion.failedBranchCount,
      },
    },
    dependencies.ports,
  );
  if (emitted.kind === 'error') {
    return emitted;
  }

  return { kind: 'ok', value: completion };
}

/**
 * A futás lezárása egy **léptetés közbeni**, nem lépés szintű hiba után
 * (`run_execution_failed`). A futás sorát `failed` állapotba visszük és
 * kiadjuk a `run_finished` eseményt, hogy a futás ne maradjon örökre
 * `running` állapotban.
 *
 * **A két írás eredményét szándékosan nem ágaztatjuk el.** A hibaosztály
 * leggyakoribb forrása épp egy adatbázis hiba; ilyenkor a lezárás sem
 * sikerülhet, és egy második, ugyanarról szóló hibaüzenet nem visz közelebb -
 * a hívó az EREDETI üzenetet kapja vissza, ami megnevezi a tényleges okot. Az
 * indulási helyreállítás (10. szekció, T-005-27) a bennragadt `running`
 * futásokat amúgy is `interrupted` állapotba viszi a következő induláskor.
 */
function abortRun(execution: RunExecution, dependencies: NodeExecutorDependencies, message: string): void {
  dependencies.ports.database.runs.markRunFailed(execution.runId, 'run_execution_failed', message);
  emitEngineEvent(
    {
      kind: 'run_finished',
      runId: execution.runId,
      // eslint-disable-next-line unicorn/no-null -- a `run_finished` futás szintű esemény, a `run_event.step_run_id` valódi NULL értéke (SPEC-003 6.2)
      stepRunId: null,
      payload: {
        status: 'failed',
        errorKind: 'run_execution_failed',
        errorMessage: message,
        failedBranchCount: execution.unhandledErrors.length,
      },
    },
    dependencies.ports,
  );
}

/**
 * Egy elindított futás léptetése a terminális állapotig, majd a záró állapot
 * kiírása (SPEC-004 4.4 6. pont, 8.4). A `run-supervisor` ezt hívja
 * háttérben, a `startRun` visszatérése UTÁN: a hívó (a HTTP réteg) nem várja
 * meg a futást, az előrehaladást az `eventPublisher` porton át látja.
 *
 * A visszatérési érték hibaága kizárólag **léptetés közbeni**, nem lépés
 * szintű hibát jelent (`run_execution_failed`); egy elbukott lépés a sikeres
 * ágon, `failed` záró állapotú `RunCompletion` értékben érkezik (8.4).
 */
export async function advanceRun(
  execution: RunExecution,
  dependencies: NodeExecutorDependencies,
): Promise<Outcome<RunCompletion>> {
  const looped = await runSchedulingLoop(execution, dependencies);
  if (looped.kind === 'error') {
    abortRun(execution, dependencies, looped.message);
    return looped;
  }
  return finishRun(execution, dependencies);
}
