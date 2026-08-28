import type { Outcome } from '@easter-workflow-builder/core';
import type { SnapshotEdge } from '@easter-workflow-builder/db';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

// Egyetlen `branch` node kimenő éleinek ellenőrzése. Külön függvényben áll, és
// nem a hívó ciklusába ágyazva, mert az `on_error` él átugrása egymásba
// ágyazott ciklusban `continue` lenne (`unicorn/no-break-in-nested-loop`).
function validateBranchNodeEdges(
  nodeId: string,
  declaredKeys: ReadonlySet<string>,
  outgoingEdges: readonly SnapshotEdge[],
): Outcome<void> {
  for (const edge of outgoingEdges) {
    if (edge.branchKey === 'on_error') {
      continue;
    }
    if (edge.branchKey === null || !declaredKeys.has(edge.branchKey)) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'branch_key_unknown',
          `A(z) ${nodeId} branch node ${edge.id} élének branch_key értékét (${edge.branchKey ?? 'nincs kulcs'}) a branches lista nem tartalmazza`,
        ),
      };
    }
  }

  return { kind: 'ok', value: undefined };
}

/**
 * A SPEC-004 4.7 táblázat 5. sora: "minden `branch` él `branch_key` értéke
 * szerepel a `branches[]` listában", különben `branch_key_unknown`.
 *
 * Az `on_error` él kivétel, és nem is lehet másképp: a 4.2 táblázat utolsó
 * előtti sora szerint **bármely** node kaphat `on_error` élt, tehát a `branch`
 * node hibaága nem a `branches[]` listából jön. Ezt az élt a
 * `validateErrorHandlerEdges` vizsgálja.
 *
 * A `null` `branchKey` a `branch` node kimenő élén hiba: a 4.2 táblázat a
 * `branch` sorban a `branches[].key` egyikét **kötelezően** írja elő, tehát a
 * "nincs kulcs" itt nem az egyetlen normál kimenet, hanem ismeretlen ág.
 */
export function validateBranchEdgeKeys(
  graph: ExecutableGraph,
  configsById: ReadonlyMap<string, ExecutableNodeConfig>,
): Outcome<void> {
  for (const [nodeId, config] of configsById) {
    if (config.type !== 'branch') {
      continue;
    }
    const declaredKeys = new Set(config.branches.map((option) => option.key));
    const outgoingEdges = graph.outgoingEdges.get(nodeId) ?? [];

    const outcome = validateBranchNodeEdges(nodeId, declaredKeys, outgoingEdges);
    if (outcome.kind === 'error') {
      return outcome;
    }
  }

  return { kind: 'ok', value: undefined };
}
