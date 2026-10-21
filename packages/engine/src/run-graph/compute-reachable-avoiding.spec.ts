/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from './build-executable-graph.ts';
import { computeReachableAvoiding } from './compute-reachable-avoiding.ts';
import type { ExecutableGraph } from './executable-graph.ts';

function node(id: string): SnapshotNode {
  return { id, type: 'agent_step', label: id, position: { x: 0, y: 0 }, config: {}, effectiveProviderId: 'minimax' };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

// a -> b -> c -> a kör, plusz a -> d és b -> d.
function graphOf(): ExecutableGraph {
  return buildExecutableGraph({
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: 'wf', name: 'teszt', description: null },
    nodes: [node('a'), node('b'), node('c'), node('d')],
    edges: [
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'c'),
      edge('e3', 'c', 'a'),
      edge('e4', 'a', 'd'),
      edge('e5', 'b', 'd'),
    ],
  });
}

describe('computeReachableAvoiding', () => {
  it('a kihagyott node-ba nem lép be, tehát a mögötte álló node-ok sem elérhetők rajta át', () => {
    expect(computeReachableAvoiding(graphOf(), 'a', 'b')).toStrictEqual(new Set(['a', 'd']));
  });

  it('a kihagyott node nélküli úton elérhető node-ok bekerülnek, a kör nem okoz végtelen bejárást', () => {
    expect(computeReachableAvoiding(graphOf(), 'b', 'a')).toStrictEqual(new Set(['b', 'c', 'd']));
  });

  it('a kiindulási node akkor is a halmazban áll, ha az a kihagyott node', () => {
    expect(computeReachableAvoiding(graphOf(), 'a', 'a')).toStrictEqual(new Set(['a', 'b', 'c', 'd']));
  });
});
