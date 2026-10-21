import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { GraphNodeCardData } from '../graph-node-card/graph-node-card-data.ts';
import type { BranchDecision } from './branch-decision.ts';
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
  /**
   * Csomópont azonosító -> a hozzá leképezett `branch_taken` döntések, növekvő
   * `eventId` szerint (`group-branch-decisions-by-node.ts`): az alapértelmezett
   * ág jelvény adata a lista utolsó eleméből jön (SPEC-008 6.6, O-24).
   */
  readonly branchDecisionsByNodeId: ReadonlyMap<string, readonly BranchDecision[]>;
  /**
   * Igaz, amíg a futás lépés futásai még töltődnek (SPEC-008 9. szekció 8.
   * async pontja): minden csomópont az "állapot betöltése" jelzést kapja.
   */
  readonly isStatusLoading: boolean;
}

/**
 * A pillanatkép csomópontjainak dekorálása a hozzájuk párosított lépés
 * futásokból (SPEC-008 6.2, 6.3, AC21, AC22, AC24): tiszta függvény, DOM és
 * `@xyflow/react` hivatkozás nélkül, tehát szintetikus bemenettel közvetlenül
 * tesztelhető.
 *
 * A két jelvény adata (SPEC-008 6.6): a próbálkozás szám a megjelenített lépés
 * futásból jön, ugyanabból a sorból, mint az állapot; az alapértelmezett ág a
 * csomópont legutóbbi döntéséből, az ág kiemelés módjától függetlenül, ezért a
 * mód itt nem is bemenet (O-24).
 *
 * Az `exactOptionalPropertyTypes: true` miatt az elhagyható kulcsok csak
 * akkor kerülnek fel, ha valódi értékük van: egy `{ status: undefined }`
 * alakú objektum nem egyenértékű a kulcs hiányával.
 */
export function buildRunGraphNodes(input: Readonly<RunGraphNodesInput>): readonly GraphNodeCardData[] {
  const {
    nodes,
    nodeStepRuns,
    stepRuns,
    onOpenSubWorkflowRun,
    pendingApprovalRequestedAtByStepRunId,
    branchDecisionsByNodeId,
    isStatusLoading,
  } = input;

  return nodes.map((workflowNode) => {
    const ownStepRuns = nodeStepRuns.get(workflowNode.id) ?? [];
    const displayed = pickDisplayedStepRun(ownStepRuns);
    const summary = describeRunNodeSummary(workflowNode, ownStepRuns, stepRuns, pendingApprovalRequestedAtByStepRunId);
    const latestDecision = branchDecisionsByNodeId.get(workflowNode.id)?.at(-1);
    return {
      workflowNode,
      ...(displayed !== undefined && { status: displayed.status, attempt: displayed.attempt }),
      ...(isStatusLoading && { isStatusLoading: true as const }),
      ...(summary !== undefined && { runDecoration: { summary, onOpenSubWorkflowRun } }),
      ...(latestDecision?.usedDefault === true && { usedDefaultBranch: true as const }),
    };
  });
}
