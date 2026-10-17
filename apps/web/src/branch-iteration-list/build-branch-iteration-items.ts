import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { BranchIterationItem } from './branch-iteration-item.ts';
import type { BranchIterationSelection } from './branch-iteration-selection.ts';
import { resolveLoopIterationStatus } from './resolve-loop-iteration-status.ts';

/**
 * Egy tétel a lépés futásából.
 *
 * - **`loop`**: a felirat a csomópont kártya összesítésének alakja
 *   (`graph-node-card/GraphNodeCard.tsx`, "iteráció: N / M", a
 *   `step_run.iteration` és a `maxIterations`), sorszám nélkül, hogy a lista és
 *   a kártya ugyanazt a számozást használja (review észrevétel 2026-10-17). Az
 *   állapot az iteráció lépéseiből számol (`resolve-loop-iteration-status.ts`,
 *   user döntés 2026-10-17).
 * - **`fan_out`**: a felirat a sorszám és a lépés csomópontjának neve a
 *   pillanatképből, és ha a lépés futás a pillanatképen kívüli csomópontra
 *   mutat (a `step_run.node_id` szándékosan nem idegen kulcs, SPEC-003 4.10),
 *   a csomópont azonosítója. A sorszám miatt két azonos nevű ág (egy ágban
 *   futó ugyanaz a csomópont) gombjának hozzáférhető neve is különbözik. Az
 *   állapot a lépés futás saját állapota.
 */
function describeItem(
  config: WorkflowNodeInput['config'],
  stepRun: StepRunRecord,
  index: number,
  nodes: readonly WorkflowNodeInput[],
  stepRuns: readonly StepRunRecord[],
): BranchIterationItem {
  if (config.type === 'loop') {
    return {
      stepRunId: stepRun.id,
      label: `iteráció: ${String(stepRun.iteration)} / ${String(config.maxIterations)}`,
      status: resolveLoopIterationStatus(stepRun, stepRuns),
    };
  }
  const nodeLabel = nodes.find((node) => node.id === stepRun.nodeId)?.label ?? stepRun.nodeId;
  return { stepRunId: stepRun.id, label: `${String(index + 1)}. ${nodeLabel}`, status: stepRun.status };
}

/**
 * A tételes lista sorai (SPEC-008 6.3, O-39), a lépés futás lista alapján,
 * létrehozási sorrendben.
 *
 * - **`loop`**: a csomópont minden saját lépés futása egy tétel. A motor a
 *   `loop` minden kiértékelésére saját sort ír, az `iteration` oszlopban az
 *   addigi lefutások számával (SPEC-004 4.6 1. pont).
 * - **`fan_out`**: a szétosztás hatókörében KÖZVETLENÜL futó lépés futások,
 *   azaz amiknek a `parent_step_run_id` értéke a csomópont egyik saját lépés
 *   futása. **Kimondott korlát:** az ág indexe (`itemIndex`) nem része a
 *   `StepRunRecord` drótszintű alakjának, tehát egy több lépésből álló ág
 *   lépései nem csoportosíthatók ágankénti sorba: ilyenkor minden lépés
 *   futás külön tétel. Egy lépésből álló ágnál (a szokásos `fan_out` ->
 *   lépés -> `join` alak) egy tétel pontosan egy ág. Ugyanez az ok áll a
 *   kártya összesítésénél is (`run-graph/describe-run-node-summary.ts`).
 *
 * A sorrend a `createdAtMs` szerint növekvő; azonos időpontnál a lista
 * eredeti sorrendje marad, mert a `toSorted` stabil.
 */
export function buildBranchIterationItems(
  selection: Pick<BranchIterationSelection, 'node' | 'kind'>,
  nodes: readonly WorkflowNodeInput[],
  stepRuns: readonly StepRunRecord[],
): readonly BranchIterationItem[] {
  const ownStepRunIds = new Set(
    stepRuns.filter((stepRun) => stepRun.nodeId === selection.node.id).map((stepRun) => stepRun.id),
  );
  const itemStepRuns =
    selection.kind === 'loop'
      ? stepRuns.filter((stepRun) => ownStepRunIds.has(stepRun.id))
      : stepRuns.filter((stepRun) => stepRun.parentStepRunId !== null && ownStepRunIds.has(stepRun.parentStepRunId));
  return itemStepRuns
    .toSorted((first, second) => first.createdAtMs - second.createdAtMs)
    .map((stepRun, index) => describeItem(selection.node.config, stepRun, index, nodes, stepRuns));
}
