import type { StepRunRecord } from '@easter-workflow-builder/protocol';
import type { BranchDecision } from './branch-decision.ts';

/**
 * A döntések csomópontonként, növekvő `eventId` szerint, tehát minden lista
 * utolsó eleme a csomópont legutóbbi döntése (SPEC-008 6.6, 88., 91.).
 *
 * **A csomópont a lépés futás listából jön.** A döntés `stepRunId` mezője a
 * lépés futás lista egy sorára mutat, és annak `nodeId` mezője a `branch`
 * csomópont (SPEC-008 6.6 1. pont). Amíg a lista azt a sort nem tartalmazza, a
 * döntés nem képezhető le, és ez nem hiba: a függvény minden renderen újra
 * számol, tehát a lista következő frissülése után a döntés a helyére kerül.
 *
 * A sorrend kifejezetten rendezett, nem a beérkezésé: a "legutóbbi" a
 * legnagyobb `id`-jű döntés, akkor is, ha a pótolt és az élő keretek más
 * sorrendben érkeztek (SPEC-008 6.6, 3. és 4. döntés).
 */
export function groupBranchDecisionsByNode(
  decisions: ReadonlyMap<number, BranchDecision>,
  stepRuns: readonly StepRunRecord[],
): ReadonlyMap<string, readonly BranchDecision[]> {
  const nodeIdByStepRunId = new Map(stepRuns.map((stepRun) => [stepRun.id, stepRun.nodeId]));
  const grouped = new Map<string, BranchDecision[]>();
  const ordered = decisions
    .values()
    .toArray()
    .toSorted((first, second) => first.eventId - second.eventId);

  for (const decision of ordered) {
    const nodeId = nodeIdByStepRunId.get(decision.stepRunId);
    if (nodeId === undefined) {
      continue;
    }
    const bucket = grouped.get(nodeId);
    if (bucket === undefined) {
      grouped.set(nodeId, [decision]);
    } else {
      bucket.push(decision);
    }
  }

  return grouped;
}
