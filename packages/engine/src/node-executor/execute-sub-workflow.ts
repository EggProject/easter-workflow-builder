import type { WorkflowRunRecord } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { ExecutedStepInstance } from '../run-context/executed-step-instance.ts';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import { resolveStepReference } from '../run-context/resolve-step-reference.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import { beginStepRun } from './begin-step-run.ts';
import type { ChildWorkflowRunner } from './child-workflow-runner.ts';
import { detectWorkflowRecursion } from './detect-workflow-recursion.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
import { finishStepRunFailed } from './finish-step-run-failed.ts';
import { finishStepRunSucceeded } from './finish-step-run-succeeded.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionOutcome } from './node-executor-outcome.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

type SubWorkflowNodeConfig = Extract<ExecutableNodeConfig, { readonly type: 'sub_workflow' }>;

/**
 * A `sub_workflow` node bemenete (SPEC-004 5. szekció 9. sora, 5.9 szekció).
 * **A node NEM foglal párhuzamossági helyet** (7.2 táblázat: "a gyerek futás
 * lépései maguk kérnek helyet; ha a szülő tartana helyet, holtpont
 * keletkezne"), ezért - a `human_approval` végrehajtóhoz hasonlóan - nem kap
 * `ConcurrencyGate` paramétert.
 *
 * A `graph` és az `executedInstances` az `inputMapping` feloldásához kell: a
 * `resolveStepReference` (6.2 szekció) mindkettőt igényli. Ez az egyetlen
 * végrehajtó, ami megkapja a teljes `ExecutableGraph`-ot; a `branch` node
 * ezzel szemben csak a kimenő élek kulcslistáját kapja (lásd
 * `execute-branch.ts`). Az ok nem elvi különbség, hanem az, hogy a
 * hivatkozás feloldás szabálya (gráfbeli ős ÉS ág kontextus előtag) a gráf
 * bejövő él térképe nélkül nem eldönthető, és ezt a szabályt nem a hívónak,
 * hanem a már meglévő, tesztelt `run-context` függvénynek kell alkalmaznia.
 */
export interface ExecuteSubWorkflowInput {
  readonly instance: NodeExecutionInstance;
  readonly config: SubWorkflowNodeConfig;
  readonly graph: ExecutableGraph;
  readonly executedInstances: readonly ExecutedStepInstance[];
}

/**
 * Az `inputMapping` feloldása (SPEC-004 5.9 2. pont): a kulcs a **gyerek**
 * `start` node bemeneti mezője, az érték egy hivatkozás a **szülő**
 * kontextusába, node azonosító alakban. Minden értéket a már meglévő
 * `resolveStepReference` old fel, tehát a láthatósági szabály (gráfbeli ős ÉS
 * ág kontextus előtag) itt nincs újraírva; egyetlen fel nem oldható
 * hivatkozás `unresolvable_step_reference` hibát ad, és a leképezés
 * félbeszakad.
 */
function resolveInputMapping(
  input: ExecuteSubWorkflowInput,
  instance: StepInstanceReference,
): Outcome<Readonly<Record<string, unknown>>> {
  const mapped: Record<string, unknown> = {};
  for (const [field, referencedNodeId] of Object.entries(input.config.inputMapping)) {
    const resolved = resolveStepReference(input.graph, input.executedInstances, instance, referencedNodeId);
    if (resolved.kind === 'error') {
      return resolved;
    }
    mapped[field] = resolved.value;
  }
  return { kind: 'ok', value: mapped };
}

/**
 * A záró hibaág: egyetlen hívási pont mindhárom saját hibaosztálynak
 * (`workflow_recursion_detected`, `unresolvable_step_reference`,
 * `sub_workflow_failed`), hogy a `finishStepRunFailed` esetleges adatbázis
 * hibája ne duplikálódjon több, egyenként tesztelendő ágba - ugyanaz a minta,
 * mint az `execute-branch.ts` `failBranch` segédjében.
 */
function failSubWorkflow(
  runId: string,
  stepRunId: string,
  startedAtMs: number,
  errorKind: Extract<
    EngineErrorKind,
    'workflow_recursion_detected' | 'unresolvable_step_reference' | 'sub_workflow_failed'
  >,
  errorMessage: string,
  ports: NodeExecutorPorts,
): Outcome<NodeExecutionOutcome> {
  const failed = finishStepRunFailed({ runId, stepRunId, startedAtMs, errorKind, errorMessage }, ports);
  if (failed.kind === 'error') {
    return failed;
  }
  return { kind: 'ok', value: { kind: 'failed', stepRun: failed.value, errorKind, errorMessage } };
}

/**
 * A már elindult gyerek futás bejelentése (SPEC-004 5.9 3. pont): a
 * `step_run.sub_workflow_run_id` oszlop utólagos kitöltése, majd a
 * `sub_workflow_started` esemény kiadása. Az oszlop **csak itt**, a
 * `startChildRun` sikere után írható, mert a gyerek futás azonosítója korábban
 * nem létezik (lásd a `db` `attachSubWorkflowRun` doksiját).
 *
 * A hibaága **adatbázis hiba**, nem "az al-workflow elbukott", ezért a hívó
 * változatlanul, `Outcome` hibaágként adja tovább - ugyanaz az elv, mint a
 * `beginStepRun` vagy a `finishStepRun*` hibájánál a többi végrehajtóban.
 */
function announceChildRun(
  runId: string,
  stepRunId: string,
  targetWorkflowId: string,
  childRun: WorkflowRunRecord,
  ports: NodeExecutorPorts,
): Outcome<void> {
  const attached = ports.database.stepRuns.attachSubWorkflowRun(stepRunId, childRun.id);
  if (attached.kind === 'error') {
    return attached;
  }

  return emitEngineEvent(
    {
      kind: 'sub_workflow_started',
      runId,
      stepRunId,
      payload: { subWorkflowRunId: childRun.id, targetWorkflowId, depth: childRun.depth },
    },
    ports,
  );
}

/**
 * A `sub_workflow` node végrehajtója (SPEC-004 5. szekció 9. sora, 5.9
 * szekció, PLAN-005 T-005-23):
 *
 * 1. `beginStepRun` (`createStepRun` + `markStepRunning` + `step_started`,
 *    hely kérése nélkül, 7.2). A `subWorkflowRunId` itt még `null`, mert a
 *    gyerek futás azonosítója csak a 3. pontban keletkezik.
 * 2. A **szülő** futás rekordjának beolvasása (`getRun`): innen jön a
 *    `workflowAncestry` a rekurzióvédelemhez, és a `rootRunId`/`depth`/
 *    `workflowAncestry` hármas a gyerek `parent` kontextusához.
 * 3. **Rekurzióvédelem** (5.9 1. pont): a `detectWorkflowRecursion` tiszta
 *    függvény hibája esetén a lépés azonnal `failed` állapotban zár
 *    `workflow_recursion_detected` osztállyal, és a `ChildWorkflowRunner`
 *    **el sem indul** - a kör így a gyerek futás létrehozása előtt szakad meg,
 *    tehát nem keletkezik el sem induló, félbehagyott `workflow_run` sor.
 * 4. **A bemenet leképezése** (5.9 2. pont, `resolveInputMapping`).
 * 5. **A gyerek futás indítása** (`ChildWorkflowRunner.startChildRun`, a
 *    szülő futás `parent` kontextusával), majd a bejelentése
 *    (`announceChildRun`: `sub_workflow_run_id` oszlop és
 *    `sub_workflow_started` esemény). A kettő hibaága **különbözik**: az
 *    indítás hibája `sub_workflow_failed` osztályú lépés hiba (egy el sem
 *    indult gyerek ugyanúgy sikertelen al-workflow), a bejelentésé viszont
 *    adatbázis hiba, ami változatlanul, `Outcome` hibaágként megy tovább.
 * 6. **Várakozás** a gyerek terminális állapotára
 *    (`ChildWorkflowRunner.awaitChildRun`). A várakozás alatt ez a végrehajtó
 *    semmilyen erőforrást nem tart: nem kért párhuzamossági helyet, és nem
 *    tart nyitva tranzakciót - ez a 5.9 5. pontja szerinti holtpont
 *    mentesség a `node-executor` réteg szintjén.
 * 7. **Zárás** (5.9 6. pont): előbb a `sub_workflow_finished` esemény (a
 *    gyerek tényleges terminális állapotával), majd a lépés zárása. A gyerek
 *    `succeeded` állapota esetén a lépés `succeeded`, a kimenete a
 *    `ChildWorkflowRunResult.output`; minden más terminális állapotnál
 *    (`failed`, `cancelled`, `interrupted`) a lépés `failed`,
 *    `sub_workflow_failed` osztállyal.
 *
 * **A gyerek workflow saját provider feloldása** (5.9 4. pont) ebben a
 * végrehajtóban nem jelenik meg kódként, és ez szándékos: a feloldás a 4.8
 * menet 2. lépése, amit a `ChildWorkflowRunner.startChildRun` implementációja
 * futtat le a **gyerek** workflow sorára és lépéseire. A végrehajtó a szülő
 * `providerId` értékét nem adja át (a `ChildWorkflowRunRequest` alakjában nincs
 * ilyen mező), tehát a szülő választása típusszinten sem tud átszivárogni.
 */
export async function executeSubWorkflow(
  input: ExecuteSubWorkflowInput,
  ports: NodeExecutorPorts,
  runner: ChildWorkflowRunner,
): Promise<Outcome<NodeExecutionOutcome>> {
  const { instance, config } = input;
  const { runId } = instance;
  const nodeId = instance.instance.nodeId;

  /* eslint-disable unicorn/no-null -- a `sub_workflow` node nem agent lépés, nincs modellje, session módja vagy strukturált kimenet stratégiája; a `subWorkflowRunId` pedig a gyerek futás indítása előtt még valóban ismeretlen (lásd a `db` `attachSubWorkflowRun` doksiját) */
  const began = beginStepRun(
    {
      runId,
      nodeId,
      nodeType: 'sub_workflow',
      parentStepRunId: instance.parentStepRunId,
      iteration: instance.iteration,
      attempt: instance.attempt,
      providerId: instance.providerId,
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    },
    ports,
  );
  /* eslint-enable unicorn/no-null */
  if (began.kind === 'error') {
    return began;
  }
  const stepRunId = began.value.stepRun.id;
  const { startedAtMs } = began.value;

  const parentRun = ports.database.runs.getRun(runId);
  if (parentRun.kind === 'error') {
    return parentRun;
  }

  const recursion = detectWorkflowRecursion(parentRun.value.workflowAncestry, config.targetWorkflowId);
  if (recursion.kind === 'error') {
    return failSubWorkflow(runId, stepRunId, startedAtMs, 'workflow_recursion_detected', recursion.message, ports);
  }

  const mappedInput = resolveInputMapping(input, instance.instance);
  if (mappedInput.kind === 'error') {
    return failSubWorkflow(runId, stepRunId, startedAtMs, 'unresolvable_step_reference', mappedInput.message, ports);
  }

  const childRun = await runner.startChildRun({
    targetWorkflowId: config.targetWorkflowId,
    input: mappedInput.value,
    parent: {
      rootRunId: parentRun.value.rootRunId,
      depth: parentRun.value.depth,
      workflowAncestry: parentRun.value.workflowAncestry,
    },
  });
  if (childRun.kind === 'error') {
    const errorMessage = formatEngineErrorMessage(
      'sub_workflow_failed',
      `A(z) "${nodeId}" sub_workflow node "${config.targetWorkflowId}" al-workflow futása nem indult el: ${childRun.message}`,
    );
    return failSubWorkflow(runId, stepRunId, startedAtMs, 'sub_workflow_failed', errorMessage, ports);
  }

  const announced = announceChildRun(runId, stepRunId, config.targetWorkflowId, childRun.value, ports);
  if (announced.kind === 'error') {
    return announced;
  }

  const finishedChild = await runner.awaitChildRun(childRun.value.id);
  if (finishedChild.kind === 'error') {
    const errorMessage = formatEngineErrorMessage(
      'sub_workflow_failed',
      `A(z) "${nodeId}" sub_workflow node "${childRun.value.id}" al-workflow futásának megvárása sikertelen: ${finishedChild.message}`,
    );
    return failSubWorkflow(runId, stepRunId, startedAtMs, 'sub_workflow_failed', errorMessage, ports);
  }

  const childStatus = finishedChild.value.run.status;
  const finishEmitted = emitEngineEvent(
    {
      kind: 'sub_workflow_finished',
      runId,
      stepRunId,
      payload: { subWorkflowRunId: childRun.value.id, status: childStatus },
    },
    ports,
  );
  if (finishEmitted.kind === 'error') {
    return finishEmitted;
  }

  if (childStatus !== 'succeeded') {
    const errorMessage = formatEngineErrorMessage(
      'sub_workflow_failed',
      `A(z) "${nodeId}" sub_workflow node "${childRun.value.id}" al-workflow futása "${childStatus}" állapotban zárt`,
    );
    return failSubWorkflow(runId, stepRunId, startedAtMs, 'sub_workflow_failed', errorMessage, ports);
  }

  const finished = finishStepRunSucceeded({ runId, stepRunId, startedAtMs, output: finishedChild.value.output }, ports);
  if (finished.kind === 'error') {
    return finished;
  }

  // eslint-disable-next-line unicorn/no-null -- a `NodeExecutionOutcome.selectedBranchKey` `null` értéke a "minden nem `on_error` kimenő él live" jelentés (node-executor-outcome.ts)
  return { kind: 'ok', value: { kind: 'succeeded', stepRun: finished.value, selectedBranchKey: null } };
}
