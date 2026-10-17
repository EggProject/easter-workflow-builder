import type { StepRunRecord } from '@easter-workflow-builder/protocol';
import type { BranchIterationSelection } from './branch-iteration-selection.ts';
import { collectStepRunScope } from './collect-step-run-scope.ts';

/**
 * A transcript szűkítésének lépés futás halmaza a kiválasztás szerint (user
 * döntés 2026-10-17, SPEC-008 6.3, O-39).
 *
 * - **Tétel nélkül** (a csomópontra kattintás után): a csomópont MINDEN
 *   saját lépés futása és mindegyik leszármazottja. `fan_out` esetén ez a
 *   szétosztás saját lépés futása és az összes ág, `loop` esetén minden
 *   iteráció a törzsével együtt.
 * - **Kiválasztott tétellel**: csak a tétel lépés futása és a leszármazottjai.
 */
export function resolveBranchIterationScope(
  selection: BranchIterationSelection,
  stepRuns: readonly StepRunRecord[],
): ReadonlySet<string> {
  const rootStepRunIds =
    selection.stepRunId === undefined
      ? stepRuns.filter((stepRun) => stepRun.nodeId === selection.node.id).map((stepRun) => stepRun.id)
      : [selection.stepRunId];
  return collectStepRunScope(rootStepRunIds, stepRuns);
}
