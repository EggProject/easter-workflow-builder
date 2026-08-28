import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from './executable-graph.ts';

/**
 * A `loop` node kötelező ágainak ellenőrzése (SPEC-004 4.6, a validációs
 * sorrend 4. lépése): minden `loop` típusú node-nak legalább egy `continue` és
 * legalább egy `exit` `branchKey` értékű kimenő éle kell legyen, különben a
 * hiba `loop_missing_branch_edge`.
 *
 * A két kulcs a SPEC-004 4.2 táblázatában a `loop` node egyetlen megengedett
 * `branch_key` párja, ezért itt szövegesen áll; a fenntartott kulcsok
 * félrehasználását (`reserved_branch_key_misuse`) a `run-validation` téma
 * vizsgálja (PLAN-005 T-005-15).
 */
export function validateLoopBranchEdges(graph: ExecutableGraph): Outcome<void> {
  for (const node of graph.nodesById.values()) {
    if (node.type !== 'loop') {
      continue;
    }
    const outgoing = graph.outgoingEdges.get(node.id) ?? [];
    const branchKeys = new Set(outgoing.map((edge) => edge.branchKey));

    if (!branchKeys.has('continue') || !branchKeys.has('exit')) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'loop_missing_branch_edge',
          `A(z) ${node.id} loop node kimenő élei közül hiányzik a continue vagy az exit ág`,
        ),
      };
    }
  }

  return { kind: 'ok', value: undefined };
}
