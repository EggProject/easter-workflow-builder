/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput/WorkflowEdgeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordozzák (SPEC-005). */
import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { layoutGraph } from './layout-graph.ts';

function makeNode(id: string): WorkflowNodeInput {
  return {
    id,
    type: 'start',
    label: id,
    positionX: 0,
    positionY: 0,
    config: { type: 'start', inputFields: [], onUnhandledError: null },
  };
}

function makeEdge(id: string, sourceNodeId: string, targetNodeId: string): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey: null };
}

describe('layoutGraph', () => {
  it('üres node és él listára üres listát ad (N = 0)', () => {
    const result = layoutGraph([], []);
    expect(result).toEqual([]);
  });

  it('egyetlen node esetén, él nélkül is pozíciót ad (N = 1)', () => {
    const [result] = layoutGraph([makeNode('a')], []);
    expect(result).toBeDefined();
    expect(Number.isFinite(result?.positionX)).toBe(true);
    expect(Number.isFinite(result?.positionY)).toBe(true);
  });

  it('balról jobbra rendez: az él forrása kisebb positionX-et kap, mint a célja (rankdir: LR)', () => {
    const [nodeA, nodeB] = layoutGraph([makeNode('a'), makeNode('b')], [makeEdge('e1', 'a', 'b')]);
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    expect(nodeA?.positionX).toBeLessThan(nodeB?.positionX ?? 0);
  });

  it('minden bemeneti node-ra pontosan egy, azonosítóval megőrzött bejegyzést ad, ugyanabban a sorrendben', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];
    const result = layoutGraph(nodes, edges);
    expect(result.map((node) => node.id)).toEqual(['a', 'b', 'c']);
  });

  it('a node egyéb mezőit (label, type, config) változatlanul megőrzi', () => {
    const [result] = layoutGraph([makeNode('a')], []);
    expect(result).toMatchObject({ id: 'a', type: 'start', label: 'a' });
  });
});
