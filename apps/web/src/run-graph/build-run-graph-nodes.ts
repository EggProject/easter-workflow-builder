import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { GraphNodeCardData } from '../graph-node-card/graph-node-card-data.ts';
import { describeRunNodeSummary } from './describe-run-node-summary.ts';
import { pickDisplayedStepRun } from './pick-displayed-step-run.ts';

export interface RunGraphNodesInput {
  /**
   * A pillanatkép csomópontjai, domain alakra vetítve.
   */
  readonly nodes: readonly WorkflowNodeInput[];
  /**
   * Csomópont azonosító -> a hozzá párosított lépés futások
   * (`merge-snapshot-step-runs.ts`).
   */
  readonly nodeStepRuns: ReadonlyMap<string, readonly StepRunRecord[]>;
  /**
   * A futás MINDEN lépés futása: a `fan_out` hatókörében futó sorok
   * megtalálásához a párosított listán túl a teljes lista is kell
   * (`describe-run-node-summary.ts`).
   */
  readonly stepRuns: readonly StepRunRecord[];
  readonly onOpenSubWorkflowRun: (subWorkflowRunId: string) => void;
  /**
   * Lépés futás azonosító -> a hozzá tartozó függő jóváhagyás `requestedAtMs`
   * mezője (T-009-27, `approval-prompt/pending-approval-requested-at-by-step-run.ts`).
   */
  readonly pendingApprovalRequestedAtByStepRunId: ReadonlyMap<string, number>;
}

/**
 * A pillanatkép csomópontjainak dekorálása a hozzájuk párosított lépés
 * futásokból (SPEC-008 6.2, 6.3, AC21, AC22, AC24): tiszta függvény, DOM és
 * `@xyflow/react` hivatkozás nélkül, tehát szintetikus bemenettel közvetlenül
 * tesztelhető.
 *
 * Az `exactOptionalPropertyTypes: true` miatt az elhagyható kulcsok csak
 * akkor kerülnek fel, ha valódi értékük van: egy `{ status: undefined }`
 * alakú objektum nem egyenértékű a kulcs hiányával.
 */
export function buildRunGraphNodes(input: Readonly<RunGraphNodesInput>): readonly GraphNodeCardData[] {
  const { nodes, nodeStepRuns, stepRuns, onOpenSubWorkflowRun, pendingApprovalRequestedAtByStepRunId } = input;

  return nodes.map((workflowNode) => {
    const ownStepRuns = nodeStepRuns.get(workflowNode.id) ?? [];
    const displayed = pickDisplayedStepRun(ownStepRuns);
    const summary = describeRunNodeSummary(workflowNode, ownStepRuns, stepRuns, pendingApprovalRequestedAtByStepRunId);
    return {
      workflowNode,
      ...(displayed !== undefined && { status: displayed.status }),
      ...(summary !== undefined && { runDecoration: { summary, onOpenSubWorkflowRun } }),
    };
  });
}
