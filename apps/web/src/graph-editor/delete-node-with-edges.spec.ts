/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput/WorkflowEdgeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { deleteNodeWithEdges } from './delete-node-with-edges.ts';

function node(id: string): WorkflowNodeInput {
  return {
    id,
    type: 'script',
    label: id,
    positionX: 0,
    positionY: 0,
    config: { type: 'script', source: 'x', runtime: 'expression', onUnhandledError: 'fail_run' },
  };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

describe('deleteNodeWithEdges', () => {
  const nodes = [node('a'), node('b'), node('c')];
  const edges = [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ac', 'a', 'c'), edge('cb', 'c', 'b')];

  it('eltávolítja a csomópontot és a bejövő és kimenő éleit is, a többit megtartja a sorrendjükkel', () => {
    const result = deleteNodeWithEdges(nodes, edges, 'b');
    expect(result.nodes.map((remaining) => remaining.id)).toEqual(['a', 'c']);
    expect(result.edges.map((remaining) => remaining.id)).toEqual(['ac']);
  });

  it('a törölt csomópontra hivatkozó él nem marad', () => {
    const result = deleteNodeWithEdges(nodes, edges, 'c');
    expect(result.edges.some((remaining) => remaining.sourceNodeId === 'c' || remaining.targetNodeId === 'c')).toBe(
      false,
    );
  });

  it('ismeretlen azonosítónál mindent megtart', () => {
    const result = deleteNodeWithEdges(nodes, edges, 'missing');
    expect(result.nodes).toEqual(nodes);
    expect(result.edges).toEqual(edges);
  });

  it('nem módosítja a bemeneti listákat', () => {
    const nodesBefore = [...nodes];
    const edgesBefore = [...edges];
    deleteNodeWithEdges(nodes, edges, 'a');
    expect(nodes).toEqual(nodesBefore);
    expect(edges).toEqual(edgesBefore);
  });
});
