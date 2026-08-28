/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { validateStartNode } from './validate-start-node.ts';

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

describe('validateStartNode', () => {
  it('egyetlen start node esetén annak az azonosítóját adja vissza', () => {
    const graph = graphOf([node('start', 'start'), node('a', 'agent_step')], [edge('e1', 'start', 'a')]);

    expect(validateStartNode(graph)).toStrictEqual({ kind: 'ok', value: 'start' });
  });

  it('start node nélküli gráfra invalid_start_node hibát ad', () => {
    const graph = graphOf([node('a', 'agent_step')], []);

    expect(validateStartNode(graph)).toStrictEqual({
      kind: 'error',
      message: 'A gráfban pontosan egy start típusú node kell álljon, 0 darab áll benne (invalid_start_node).',
    });
  });

  it('két start node esetén invalid_start_node hibát ad', () => {
    const graph = graphOf([node('start', 'start'), node('start2', 'start')], []);

    expect(validateStartNode(graph)).toStrictEqual({
      kind: 'error',
      message: 'A gráfban pontosan egy start típusú node kell álljon, 2 darab áll benne (invalid_start_node).',
    });
  });
});
