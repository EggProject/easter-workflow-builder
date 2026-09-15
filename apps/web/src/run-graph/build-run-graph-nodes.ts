import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { GraphNodeCardData } from '../graph-node-card/graph-node-card-data.ts';
import { pickDisplayedStepRun } from './pick-displayed-step-run.ts';

/**
 * A pillanatkép csomópontjainak dekorálása a hozzájuk párosított lépés
 * futásokból (SPEC-008 6.2, AC21): tiszta függvény, DOM és `@xyflow/react`
 * hivatkozás nélkül, tehát szintetikus bemenettel közvetlenül tesztelhető.
 *
 * Az `exactOptionalPropertyTypes: true` miatt a `status` kulcs csak akkor
 * kerül fel, ha valódi értéke van: egy `{ status: undefined }` alakú objektum
 * nem egyenértékű a kulcs hiányával.
 */
export function buildRunGraphNodes(
  nodes: readonly WorkflowNodeInput[],
  nodeStepRuns: ReadonlyMap<string, readonly StepRunRecord[]>,
): readonly GraphNodeCardData[] {
  return nodes.map((workflowNode) => {
    const displayed = pickDisplayedStepRun(nodeStepRuns.get(workflowNode.id) ?? []);
    return displayed === undefined ? { workflowNode } : { workflowNode, status: displayed.status };
  });
}
