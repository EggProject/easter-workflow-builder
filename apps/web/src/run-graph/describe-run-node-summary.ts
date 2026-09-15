import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { RunNodeSummary } from '../graph-node-card/graph-node-card-data.ts';
import { pickDisplayedStepRun } from './pick-displayed-step-run.ts';

/**
 * Hány ágra bontott a `fan_out` csomópont, a SAJÁT lépés futásai alapján.
 *
 * **Miért a lépés futás kimenete a forrás.** A motor a `fan_out` node-ra
 * PONTOSAN EGY sort ír, és a kimenetébe a kiértékelt elemlistát teszi
 * (`packages/engine/src/node-executor/execute-fan-out.ts`:
 * `finishStepRunSucceeded({ ..., output: items })`, a doksija szerint "a node
 * kimenete a kiértékelt elemlista"). Az ágak darabszáma tehát ennek a
 * listának a hossza, nem a sorok száma: a sorok száma csak akkor több egynél,
 * ha maga a `fan_out` áll egy külső `loop` vagy `fan_out` hatókörében, ezért
 * az összes saját sor kimenete összegződik.
 *
 * `undefined`, ha egyetlen saját sor kimenete sem lista: a futás még nem érte
 * el a csomópontot, vagy a kiértékelés elbukott. Ilyenkor nincs mit
 * összesíteni, és a kártya a puszta állapotjelzést mutatja.
 */
function countFanOutBranches(nodeStepRuns: readonly StepRunRecord[]): number | undefined {
  let branchCount: number | undefined;
  for (const stepRun of nodeStepRuns) {
    if (Array.isArray(stepRun.output)) {
      branchCount = (branchCount ?? 0) + stepRun.output.length;
    }
  }
  return branchCount;
}

/**
 * A `fan_out` hatókörében futó lépés futások sikeres és bukott darabszáma.
 *
 * **Mit számol pontosan, és miért nem ágankénti bontást.** A `step_run`
 * sorok `parent_step_run_id` mezője a hatókör verem tetején álló bejegyzés
 * azonosítója (SPEC-004 4.3), a `fan_out` pedig a saját `stepRunId` értékével
 * nyit hatókört (`packages/engine/src/scheduling/build-fan-out-item-context.ts`:
 * `{ kind: 'fan_out', stepRunId, itemIndex }`). Az ág INDEXE (`itemIndex`)
 * viszont NEM része a `StepRunRecord` drótszintű alakjának, tehát ágankénti
 * bontás ebből az adatból nem számolható. Amit meg lehet mondani: a `fan_out`
 * hatókörében futó lépés futások közül hány zárult sikeresen és hány bukott
 * el. A felület ezt mutatja, az ág darabszám mellett.
 */
function countScopedOutcomes(
  nodeStepRuns: readonly StepRunRecord[],
  stepRuns: readonly StepRunRecord[],
): { readonly succeededCount: number; readonly failedCount: number } {
  const ownStepRunIds = new Set(nodeStepRuns.map((stepRun) => stepRun.id));
  let succeededCount = 0;
  let failedCount = 0;
  for (const stepRun of stepRuns) {
    const { parentStepRunId } = stepRun;
    if (parentStepRunId === null || !ownStepRunIds.has(parentStepRunId)) {
      continue;
    }
    if (stepRun.status === 'succeeded') {
      succeededCount += 1;
    } else if (stepRun.status === 'failed') {
      failedCount += 1;
    }
  }
  return { succeededCount, failedCount };
}

/**
 * Egy csomópont futás nézeti összesítése (SPEC-008 6.3, AC22, AC24). Tiszta
 * függvény, DOM és `@xyflow/react` hivatkozás nélkül.
 *
 * A három érintett típust a node `config.type` mezője dönti el, nem a
 * `node.type`: a `config` hordozza a `maxIterations` korlátot, és a drótszintű
 * séma szándékosan nem kapcsolja össze a két mezőt (SPEC-005), tehát a
 * `config` a mérvadó forrás arra, mit lehet összesíteni. A maradék hét
 * típusnak nincs mit, azokra `undefined` jár.
 */
export function describeRunNodeSummary(
  node: WorkflowNodeInput,
  nodeStepRuns: readonly StepRunRecord[],
  stepRuns: readonly StepRunRecord[],
): RunNodeSummary | undefined {
  if (node.config.type === 'fan_out') {
    const branchCount = countFanOutBranches(nodeStepRuns);
    if (branchCount === undefined) {
      return undefined;
    }
    const { succeededCount, failedCount } = countScopedOutcomes(nodeStepRuns, stepRuns);
    return { kind: 'fan_out', branchCount, succeededCount, failedCount };
  }

  if (node.config.type === 'loop') {
    const displayed = pickDisplayedStepRun(nodeStepRuns);
    if (displayed === undefined) {
      return undefined;
    }
    return { kind: 'loop', iteration: displayed.iteration, maxIterations: node.config.maxIterations };
  }

  if (node.config.type === 'sub_workflow') {
    const subWorkflowRunId = pickDisplayedStepRun(nodeStepRuns)?.subWorkflowRunId ?? undefined;
    if (subWorkflowRunId === undefined) {
      return undefined;
    }
    return { kind: 'sub_workflow', subWorkflowRunId };
  }

  return undefined;
}
