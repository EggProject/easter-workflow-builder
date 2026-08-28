/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { validateNodeReachability } from './validate-node-reachability.ts';

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

describe('validateNodeReachability', () => {
  it('a start node-ból elérhető lánc rendben van', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step'), node('b', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'b')],
    );

    expect(validateNodeReachability(graph, 'start')).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('a magában álló start node rendben van', () => {
    const graph = graphOf([node('start', 'start')], []);

    expect(validateNodeReachability(graph, 'start')).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('a start node-ból el nem érhető node-ra unreachable_node hibát ad', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step'), node('arva', 'agent_step')],
      [edge('e1', 'start', 'a')],
    );

    expect(validateNodeReachability(graph, 'start')).toStrictEqual({
      kind: 'error',
      message: 'A(z) arva node nem érhető el a(z) start start node-ból (unreachable_node).',
    });
  });

  it('a csak befelé mutató éllel kötött node is elérhetetlen, ha az él iránya visszafelé megy', () => {
    const graph = graphOf([node('start', 'start'), node('elozetes', 'agent_step')], [edge('e1', 'elozetes', 'start')]);

    expect(validateNodeReachability(graph, 'start')).toStrictEqual({
      kind: 'error',
      message: 'A(z) elozetes node nem érhető el a(z) start start node-ból (unreachable_node).',
    });
  });
});
