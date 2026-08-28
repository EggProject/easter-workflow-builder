/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from './build-executable-graph.ts';
import { computeReachableNodeIds } from './compute-reachable-node-ids.ts';
import type { ExecutableGraph } from './executable-graph.ts';

function node(id: string, type: NodeType): SnapshotNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config: {}, effectiveProviderId: 'minimax' };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

function graphOf(nodes: readonly SnapshotNode[], edges: readonly SnapshotEdge[]): ExecutableGraph {
  return buildExecutableGraph({
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: 'wf', name: 'teszt', description: null },
    nodes,
    edges,
  });
}

describe('computeReachableNodeIds', () => {
  it('elágazás nélküli láncon minden node-ot elér, a kiindulóval együtt', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step'), node('b', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'b')],
    );

    expect(computeReachableNodeIds(graph, 'start')).toStrictEqual(new Set(['start', 'a', 'b']));
  });

  it('kimenő él nélküli node-ból csak önmagát adja', () => {
    const graph = graphOf([node('start', 'start'), node('arva', 'agent_step')], []);

    expect(computeReachableNodeIds(graph, 'arva')).toStrictEqual(new Set(['arva']));
  });

  it('a nem elérhető node kimarad a halmazból', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step'), node('sziget', 'agent_step'), node('szigetutan', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'sziget', 'szigetutan')],
    );

    const reachable = computeReachableNodeIds(graph, 'start');

    expect(reachable).toStrictEqual(new Set(['start', 'a']));
    expect(reachable.has('sziget')).toBe(false);
    expect(reachable.has('szigetutan')).toBe(false);
  });

  it('kör esetén sem fut végtelenül, és minden érintett node-ot elér', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step'), node('b', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'a')],
    );

    expect(computeReachableNodeIds(graph, 'start')).toStrictEqual(new Set(['start', 'a', 'b']));
  });

  it('két úton elérhető node egyszer szerepel a halmazban', () => {
    const graph = graphOf(
      [node('start', 'branch'), node('a', 'agent_step'), node('b', 'agent_step'), node('c', 'join')],
      [edge('e1', 'start', 'a'), edge('e2', 'start', 'b'), edge('e3', 'a', 'c'), edge('e4', 'b', 'c')],
    );

    expect(computeReachableNodeIds(graph, 'start')).toStrictEqual(new Set(['start', 'a', 'b', 'c']));
  });
});
