import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';

export interface SnapshotStepRunMerge {
  /**
   * Csomópont azonosító -> a hozzá párosított lépés futások, a bemeneti
   * sorrendben. Kizárólag olyan kulcsot tartalmaz, amihez van legalább egy
   * lépés futás.
   */
  readonly nodeStepRuns: ReadonlyMap<string, readonly StepRunRecord[]>;
  /**
   * A pillanatképpel NEM párosítható lépés futások (AC23).
   */
  readonly unmatchedStepRuns: readonly StepRunRecord[];
}

/**
 * A pillanatkép csomópontjainak és a `GET /api/runs/{runId}/steps` sorainak
 * összefésülése a `nodeId` mezőn (SPEC-008 6.2, AC23).
 *
 * **Miért van egyáltalán nem párosítható sor.** A `step_run.node_id`
 * SZÁNDÉKOSAN nem idegen kulcs (SPEC-003 4.10), tehát hivatkozhat olyan
 * azonosítóra, ami a futás pillanatképében nem szerepel. A felület ezt nem
 * hibaágként kezeli: a rajz mindig a pillanatképet mutatja, a nem párosítható
 * sorok pedig a gráf alatt, listás alakban jelennek meg.
 *
 * **Egy csomóponthoz több sor is tartozhat**, eltérő `parent_step_run_id`
 * láncon (a `fan_out` ágai) vagy eltérő `iteration` értéken (a `loop`
 * iterációi), ezért a térkép értéke lista, nem egyetlen rekord (SPEC-008 6.3).
 */
export function mergeSnapshotStepRuns(
  nodes: readonly WorkflowNodeInput[],
  stepRuns: readonly StepRunRecord[],
): SnapshotStepRunMerge {
  const snapshotNodeIds = new Set(nodes.map((node) => node.id));
  const nodeStepRuns = new Map<string, StepRunRecord[]>();
  const unmatchedStepRuns: StepRunRecord[] = [];

  for (const stepRun of stepRuns) {
    if (!snapshotNodeIds.has(stepRun.nodeId)) {
      unmatchedStepRuns.push(stepRun);
      continue;
    }
    const bucket = nodeStepRuns.get(stepRun.nodeId);
    if (bucket === undefined) {
      nodeStepRuns.set(stepRun.nodeId, [stepRun]);
    } else {
      bucket.push(stepRun);
    }
  }

  return { nodeStepRuns, unmatchedStepRuns };
}
