/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { validateErrorHandlerEdges } from './validate-error-handler-edges.ts';

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

const nodes: readonly SnapshotNode[] = [node('start', 'start'), node('a', 'agent_step'), node('h', 'error_handler')];

describe('validateErrorHandlerEdges', () => {
  it('error_handler célú on_error élre zöld', () => {
    const graph = graphOf(nodes, [edge('e1', 'start', 'a'), edge('e2', 'a', 'h', 'on_error')]);

    expect(validateErrorHandlerEdges(graph)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('on_error él nélküli gráfra zöld', () => {
    const graph = graphOf(nodes, [edge('e1', 'start', 'a')]);

    expect(validateErrorHandlerEdges(graph)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('nem error_handler célra invalid_error_handler_edge hibát ad', () => {
    const graph = graphOf(nodes, [edge('e2', 'start', 'a', 'on_error')]);

    expect(validateErrorHandlerEdges(graph)).toStrictEqual({
      kind: 'error',
      message: 'A(z) e2 on_error él célja (a) nem error_handler típusú node (invalid_error_handler_edge).',
    });
  });

  it('nem létező célra is invalid_error_handler_edge hibát ad', () => {
    const graph = graphOf(nodes, [edge('e2', 'start', 'nincs', 'on_error')]);

    expect(validateErrorHandlerEdges(graph)).toStrictEqual({
      kind: 'error',
      message: 'A(z) e2 on_error él célja (nincs) nem error_handler típusú node (invalid_error_handler_edge).',
    });
  });
});
