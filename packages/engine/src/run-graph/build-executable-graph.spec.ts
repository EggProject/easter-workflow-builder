/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { GraphSnapshotDocument, NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from './build-executable-graph.ts';

function node(id: string, type: NodeType): SnapshotNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config: {}, effectiveProviderId: 'minimax' };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

function snapshotDocument(nodes: readonly SnapshotNode[], edges: readonly SnapshotEdge[]): GraphSnapshotDocument {
  return {
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: 'wf', name: 'teszt', description: null },
    nodes,
    edges,
  };
}

describe('buildExecutableGraph', () => {
  it('üres pillanatképre mindhárom térkép üres', () => {
    const graph = buildExecutableGraph(snapshotDocument([], []));

    expect(graph.nodesById.size).toBe(0);
    expect(graph.outgoingEdges.size).toBe(0);
    expect(graph.incomingEdges.size).toBe(0);
  });

  it('egyetlen node-ot azonosító szerint indexel, él nélkül', () => {
    const graph = buildExecutableGraph(snapshotDocument([node('start', 'start')], []));

    expect(graph.nodesById.get('start')?.type).toBe('start');
    expect(graph.nodesById.size).toBe(1);
    expect(graph.outgoingEdges.size).toBe(0);
  });

  it('a kimenő és a bejövő éleket node-onként, a pillanatkép sorrendjében gyűjti', () => {
    const graph = buildExecutableGraph(
      snapshotDocument(
        [node('start', 'start'), node('a', 'agent_step'), node('b', 'agent_step'), node('c', 'join')],
        [edge('e1', 'start', 'a'), edge('e2', 'start', 'b'), edge('e3', 'a', 'c'), edge('e4', 'b', 'c')],
      ),
    );

    expect(graph.outgoingEdges.get('start')?.map((item) => item.id)).toStrictEqual(['e1', 'e2']);
    expect(graph.incomingEdges.get('c')?.map((item) => item.id)).toStrictEqual(['e3', 'e4']);
    expect(graph.outgoingEdges.get('c')).toBeUndefined();
    expect(graph.incomingEdges.get('start')).toBeUndefined();
  });

  it('nem létező node-ra mutató élre sem hibázik: a dangling_edge nem itt dől el', () => {
    const graph = buildExecutableGraph(snapshotDocument([node('start', 'start')], [edge('e1', 'start', 'hianyzo')]));

    expect(graph.nodesById.has('hianyzo')).toBe(false);
    expect(graph.incomingEdges.get('hianyzo')?.map((item) => item.id)).toStrictEqual(['e1']);
    expect(graph.outgoingEdges.get('start')?.map((item) => item.id)).toStrictEqual(['e1']);
  });
});
