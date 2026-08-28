import type { Outcome } from '@easter-workflow-builder/core';
import type { StartRunInput, WorkflowRunRecord } from '@easter-workflow-builder/db';
import { collectSessionSourceNodes } from '../agent-step/collect-session-source-nodes.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ChildWorkflowRunRequest, ChildWorkflowRunResult } from '../node-executor/child-workflow-runner.ts';
import type { ValidatedRun } from '../run-validation/validated-run.ts';
import type { NodeExecutorDependencies } from '../node-executor/node-executor-dependencies.ts';
import { resolveEffectiveProvider } from '../provider-resolution/resolve-effective-provider.ts';
import { validateRun } from '../run-validation/validate-run.ts';
import { createSchedulerState } from '../scheduling/create-scheduler-state.ts';
import { enqueueStartInstance } from '../scheduling/enqueue-start-instance.ts';
import type { ActiveRunHandle } from './active-run-registry.ts';
import { createActiveRunRegistry } from './active-run-registry.ts';
import type { RunCompletion } from '../error-policy/run-completion.ts';
import { advanceRun } from './advance-run.ts';
import { buildSnapshotDocument } from './build-snapshot-document.ts';
import { buildChildResult } from './build-child-result.ts';
import { collectRunInputs } from './collect-run-inputs.ts';
import { prepareRun } from './prepare-run.ts';
import type { BuildSnapshotDocumentInput } from './build-snapshot-document.ts';
import type { NodePlan, RunExecution } from './run-execution.ts';
import type { RunSupervisor, RunSupervisorDependencies, StartRunRequest, StartedRun } from './run-supervisor.ts';

/**
 * A 4.8 menet 1 ... 4. lépésének eredménye: minden, amit a futás létrehozása
 * előtt ki kellett számolni, egy helyen. A `snapshot` a pillanatkép
 * dokumentum összeállításának bemenete, a `fallbackProviderId` mezőjében a
 * futás szintű, feloldott providerrel.
 */
interface PreparedRun {
  readonly snapshot: BuildSnapshotDocumentInput;
  readonly validated: ValidatedRun;
  readonly nodePlans: ReadonlyMap<string, NodePlan>;
}

/**
 * Egy elindított futás **belső** eredménye: a rekord mellett a
 * háttérfolyamat kézikönyve és az élő végrehajtási állapot is. A publikus
 * `StartedRun` ebből csak a rekordot adja ki; a másik kettő az al-workflow
 * megvárásához kell, lookup nélkül (lásd `startChildRun`).
 */
interface StartedRunInternals {
  readonly run: WorkflowRunRecord;
  readonly handle: ActiveRunHandle;
  readonly execution: RunExecution;
}

/**
 * A futás életciklusának vezetője (SPEC-004 4.8, 4.4 ... 4.6, 8.4,
 * PLAN-005 T-005-25).
 *
 * **Az állapot lezárásban él**, nem modulszintű változóban: két teszt (és két
 * `createEngine` hívás) nem láthatja egymás aktív futásait. Ugyanaz a minta,
 * mint a `createConcurrencyGate` és a `createApprovalWaitRegistry` esetén.
 *
 * **A rekurzió, ami feloldja a kört.** A `sub_workflow` végrehajtójának
 * szüksége van a "futtass le egy workflow-t" képességre, amit épp ez a téma
 * nyújt; a `node-executor` viszont nem importálhatja ezt a fájlt. A feloldás a
 * `ChildWorkflowRunner` port alakú függőség, amit itt **önmagunkkal** töltünk
 * ki: a `nodeExecutorDependencies.childWorkflowRunner` a lenti két helyi
 * függvény (`startChildRun`, `awaitChildRun`).
 */
export function createRunSupervisor(dependencies: RunSupervisorDependencies): RunSupervisor {
  const { ports } = dependencies;
  const registry = createActiveRunRegistry();

  /**
   * Gyerek futás azonosítója -> a lezárulásának eredménye. **Nem az aktív
   * futások nyilvántartásából dolgozunk**: az a futás terminális állapotában
   * kiürül, az `awaitChildRun` viszont a `startChildRun` után tetszőleges
   * mikrotaszkkal később hívódik, tehát elkéshetne. Ez a térkép a
   * `startChildRun` pillanatában kap bejegyzést, és az `awaitChildRun`
   * hívásakor ürül, tehát pontosan addig él, ameddig kell.
   */
  const childCompletions = new Map<string, Promise<Outcome<ChildWorkflowRunResult>>>();

  const nodeExecutorDependencies: NodeExecutorDependencies = {
    ports,
    concurrencyGate: dependencies.concurrencyGate,
    approvalRegistry: dependencies.approvalRegistry,
    childWorkflowRunner: { startChildRun, awaitChildRun },
  };

  /**
   * A SPEC-004 4.8 menet 1 ... 7. lépése, ebben a sorrendben. **Az 1 ... 5. lépés egyetlen adatot sem ír**: egy érvénytelen workflow soha nem hoz létre
   * `workflow_run` sort.
   */
  function startRunInternals(request: StartRunRequest): Outcome<StartedRunInternals> {
    // 1. A workflow, a gráfja és a globális beállítás olvasása. A három
    //    olvasás eredményét a `collectRunInputs` fűzi össze, hogy a hívási
    //    helyen egyetlen, ténylegesen mindkét kimenetében előforduló elágazás
    //    maradjon (lásd az ottani doksit).
    const inputs = collectRunInputs(
      ports.database.workflows.getWorkflow(request.workflowId),
      ports.database.workflows.readGraph(request.workflowId),
      ports.database.settings.readSettings(),
    );
    if (inputs.kind === 'error') {
      return inputs;
    }
    const { workflow, graph, settings } = inputs.value;

    // 2. Provider feloldás. A futás szintű (workflow felülírás vagy globális
    //    alapértelmezés) feloldás előre fut, mert a `workflow_run.provider_id`
    //    oszlop ezt kéri, és mert az ideiglenes pillanatkép dokumentumnak is
    //    kell egy nem nullázható érték (`build-snapshot-document.ts`). A
    //    node-onkénti feloldást a `validateRun` végzi el (4.8 2. lépés).
    const runProviderId = resolveEffectiveProvider(
      settings.defaultProviderId,
      workflow.providerId,
      // eslint-disable-next-line unicorn/no-null -- a futás szintű feloldásnak nincs lépés szintű felülírása, ez a `resolveEffectiveProvider` bemeneti típusának valódi "nincs" értéke (SPEC-004 11.1)
      null,
    );
    if (runProviderId.kind === 'error') {
      return runProviderId;
    }

    const snapshotInput = {
      workflow,
      graph,
      sdkVersionPin: dependencies.installedAgentSdkVersion,
      fallbackProviderId: runProviderId.value,
    };

    // 3. Gráf validáció (4.5, 4.6, 4.7) az IDEIGLENES pillanatkép dokumentumon.
    const validated = validateRun(
      buildSnapshotDocument({ ...snapshotInput, providerByNodeId: new Map() }),
      settings.defaultProviderId,
      workflow.providerId,
    );
    if (validated.kind === 'error') {
      return validated;
    }

    // 3. (provider validáció, 11.2) és 4. (a bemenet ellenőrzése).
    const nodePlans = prepareRun({
      validated: validated.value,
      descriptorLookup: ports.providerDescriptorLookup,
      installedAgentSdkVersion: dependencies.installedAgentSdkVersion,
      input: request.input,
    });
    if (nodePlans.kind === 'error') {
      return nodePlans;
    }

    // 5 ... 7.
    return startValidatedRun(request, {
      snapshot: { ...snapshotInput, providerByNodeId: validated.value.effectiveProviderByNodeId },
      validated: validated.value,
      nodePlans: nodePlans.value,
    });
  }

  /**
   * A 4.8 menet 5 ... 7. lépése, az első adatíró szakasz: a végleges
   * pillanatkép dokumentum, a `startRun` tranzakció, a `run_started` esemény
   * élő kiadása, a `markRunRunning`, végül a `start` node példányának
   * ütemezése és a háttérfolyamat elindítása.
   */
  function startValidatedRun(request: StartRunRequest, prepared: PreparedRun): Outcome<StartedRunInternals> {
    const startRunInput: StartRunInput = {
      workflowId: request.workflowId,
      input: request.input,
      providerId: prepared.snapshot.fallbackProviderId,
      graphSnapshotDocument: buildSnapshotDocument(prepared.snapshot),
      ...(request.parent !== undefined && { parent: request.parent }),
    };

    const started = ports.database.runs.startRun(startRunInput);
    if (started.kind === 'error') {
      return started;
    }

    // A `run_started` SORT a `db` már megírta, a futás beszúrásával azonos
    // tranzakcióban (SPEC-004 13. szekció, 4.8 6. lépés), ezért itt csak az
    // élő nézetnek adjuk ki, `writeEngineEvent` nélkül - különben két
    // `run_started` sor keletkezne ugyanarra a futásra.
    ports.eventPublisher.publish({
      kind: 'run_started',
      runId: started.value.id,
      // eslint-disable-next-line unicorn/no-null -- a `run_started` futás szintű esemény, a `run_event.step_run_id` valódi NULL értéke (SPEC-003 6.2)
      stepRunId: null,
      payload: {
        workflowId: started.value.workflowId,
        providerId: started.value.providerId,
        graphSnapshotHash: started.value.graphSnapshotHash,
        persistedStreamDeltas: started.value.persistedStreamDeltas,
      },
    });

    const running = ports.database.runs.markRunRunning(started.value.id);
    if (running.kind === 'error') {
      return running;
    }

    const execution: RunExecution = {
      runId: running.value.id,
      topology: prepared.validated,
      nodePlans: prepared.nodePlans,
      sessionSourceNodes: collectSessionSourceNodes(prepared.validated.nodeConfigsById),
      runInput: request.input,
      scheduler: enqueueStartInstance(createSchedulerState(), prepared.validated.startNodeId),
      executedInstances: [],
      sessionInstances: [],
      unhandledErrors: [],
      pendingFailures: new Map(),
      retryAttempts: new Map(),
      failRunRequested: false,
      stopRequested: false,
    };

    return { kind: 'ok', value: { run: running.value, handle: launch(execution, running.value), execution } };
  }

  /**
   * A háttérfolyamat elindítása és a kézikönyve. A `completion` a léptetés
   * eredménye; a `finally` ág a futás terminális állapotában kiveszi a
   * kézikönyvet a nyilvántartásból, hogy az ne nőjön a lefutott futások
   * számával.
   */
  function launch(execution: RunExecution, run: WorkflowRunRecord): ActiveRunHandle {
    const completion = runToCompletion(execution);
    const handle: ActiveRunHandle = {
      runId: execution.runId,
      rootRunId: run.rootRunId,
      workflowId: run.workflowId,
      completion,
      requestStop: () => {
        execution.stopRequested = true;
      },
      isStopRequested: () => execution.stopRequested,
    };
    registry.register(handle);
    return handle;
  }

  /**
   * A léptetés és a kézikönyv kivétele a nyilvántartásból, minden ágon. A
   * `try/finally` a `.finally()` láncolás helyett áll (`unicorn/prefer-await`).
   */
  async function runToCompletion(execution: RunExecution): Promise<Outcome<RunCompletion>> {
    try {
      return await advanceRun(execution, nodeExecutorDependencies);
    } finally {
      registry.release(execution.runId);
    }
  }

  function startRun(request: StartRunRequest): Outcome<StartedRun> {
    const started = startRunInternals(request);
    if (started.kind === 'error') {
      return started;
    }
    return { kind: 'ok', value: { run: started.value.run } };
  }

  /**
   * A `ChildWorkflowRunner` első fele (SPEC-004 5.9 3. pont): a gyerek futás
   * indítása a **teljes** 4.8 menettel, a gyerek workflow SAJÁT provider
   * feloldásával (a kérés nem hordoz providert, tehát a szülő választása
   * típusszinten sem szivároghat át), és a **még futó** gyerek rekordjának
   * visszaadása.
   */
  function startChildRun(request: ChildWorkflowRunRequest): Promise<Outcome<WorkflowRunRecord>> {
    const started = startRunInternals({
      workflowId: request.targetWorkflowId,
      input: request.input,
      parent: request.parent,
    });
    if (started.kind === 'error') {
      return Promise.resolve(started);
    }
    childCompletions.set(started.value.run.id, awaitChildCompletion(started.value));
    return Promise.resolve({ kind: 'ok', value: started.value.run });
  }

  /**
   * A gyerek futás terminális rekordja és kimenete (SPEC-004 5.9 6. pont). A
   * rekordot **újra beolvassuk**, mert a `startChildRun` óta a futás
   * terminális állapotba került; a kimenetet a `collectTerminalOutput` adja a
   * gyerek lefutott példányaiból.
   */
  async function awaitChildCompletion(started: StartedRunInternals): Promise<Outcome<ChildWorkflowRunResult>> {
    const completion = await started.handle.completion;
    return buildChildResult(
      completion,
      ports.database.runs.getRun(started.run.id),
      started.execution.topology.graph,
      started.execution.executedInstances,
    );
  }

  /**
   * A `ChildWorkflowRunner` második fele: várakozás a már elindított gyerek
   * futás terminális állapotára. A bejegyzés a `startChildRun` óta áll, és itt
   * ürül ki - ismeretlen azonosítóra hibaág, amit a hívó `sub_workflow` lépés
   * `sub_workflow_failed` osztállyal zár.
   */
  function awaitChildRun(childRunId: string): Promise<Outcome<ChildWorkflowRunResult>> {
    const pending = childCompletions.get(childRunId);
    if (pending === undefined) {
      return Promise.resolve({
        kind: 'error',
        message: formatEngineErrorMessage(
          'sub_workflow_failed',
          `A(z) "${childRunId}" azonosítójú al-workflow futást nem ez a motor indította el`,
        ),
      });
    }
    childCompletions.delete(childRunId);
    return pending;
  }

  return {
    startRun,
    startChildRun,
    awaitChildRun,
    listActiveRuns: () => registry.list(),
    getActiveRun: (runId) => registry.get(runId),
  };
}
