/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { collectAncestorNodeIds } from './collect-ancestor-node-ids.ts';

function node(id: string, type: NodeType): SnapshotNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config: {}, effectiveProviderId: 'minimax' };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string, branchKey: string | null = null): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey };
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

describe('collectAncestorNodeIds', () => {
  it('lineáris gráfon minden feljebbi node ős', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step'), node('b', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'b')],
    );

    expect(collectAncestorNodeIds(graph, 'b')).toStrictEqual(new Set(['a', 'start']));
  });

  it('a kiindulási node soha nincs a saját ősei között', () => {
    const graph = graphOf([node('start', 'start'), node('a', 'agent_step')], [edge('e1', 'start', 'a')]);

    expect(collectAncestorNodeIds(graph, 'start')).toStrictEqual(new Set());
  });

  it('elágazó, majd visszatalálkozó ágakon mindkét út ősei felkerülnek', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('b', 'branch'),
        node('x', 'agent_step'),
        node('y', 'agent_step'),
        node('z', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'b'),
        edge('e2', 'b', 'x', 'bal'),
        edge('e3', 'b', 'y', 'jobb'),
        edge('e4', 'x', 'z'),
        edge('e5', 'y', 'z'),
      ],
    );

    expect(collectAncestorNodeIds(graph, 'z')).toStrictEqual(new Set(['x', 'y', 'b', 'start']));
  });

  it('a testvér ág node-ja nem ős', () => {
    const graph = graphOf(
      [node('start', 'start'), node('b', 'branch'), node('x', 'agent_step'), node('y', 'agent_step')],
      [edge('e1', 'start', 'b'), edge('e2', 'b', 'x', 'bal'), edge('e3', 'b', 'y', 'jobb')],
    );

    expect(collectAncestorNodeIds(graph, 'x').has('y')).toBe(false);
  });

  it('a visszaéllel zárt ciklus nem okoz végtelen bejárást', () => {
    const graph = graphOf(
      [node('start', 'start'), node('l', 'loop'), node('torzs', 'agent_step'), node('vege', 'agent_step')],
      [
        edge('e1', 'start', 'l'),
        edge('e2', 'l', 'torzs', 'continue'),
        edge('e3', 'torzs', 'l'),
        edge('e4', 'l', 'vege', 'exit'),
      ],
    );

    expect(collectAncestorNodeIds(graph, 'torzs')).toStrictEqual(new Set(['l', 'start']));
  });
});
