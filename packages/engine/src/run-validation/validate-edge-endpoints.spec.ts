/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { validateEdgeEndpoints } from './validate-edge-endpoints.ts';

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

const nodes: readonly SnapshotNode[] = [node('start', 'start'), node('a', 'agent_step')];

describe('validateEdgeEndpoints', () => {
  it('létező végpontokra zöld', () => {
    const graph = graphOf(nodes, [edge('e1', 'start', 'a')]);

    expect(validateEdgeEndpoints(graph)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('él nélküli gráfra zöld', () => {
    expect(validateEdgeEndpoints(graphOf(nodes, []))).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('nem létező forrásra dangling_edge hibát ad', () => {
    const graph = graphOf(nodes, [edge('e1', 'nincs', 'a')]);

    expect(validateEdgeEndpoints(graph)).toStrictEqual({
      kind: 'error',
      message: 'A(z) e1 él forrása (nincs) nem létező node a pillanatképben (dangling_edge).',
    });
  });

  it('nem létező célra dangling_edge hibát ad', () => {
    const graph = graphOf(nodes, [edge('e1', 'start', 'nincs')]);

    expect(validateEdgeEndpoints(graph)).toStrictEqual({
      kind: 'error',
      message: 'A(z) e1 él célja (nincs) nem létező node a pillanatképben (dangling_edge).',
    });
  });
});
