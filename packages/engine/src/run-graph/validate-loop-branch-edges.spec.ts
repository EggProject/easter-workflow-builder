/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from './build-executable-graph.ts';
import type { ExecutableGraph } from './executable-graph.ts';
import { validateLoopBranchEdges } from './validate-loop-branch-edges.ts';

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

const loopNodes: readonly SnapshotNode[] = [
  node('start', 'start'),
  node('L', 'loop'),
  node('torzs', 'agent_step'),
  node('utan', 'agent_step'),
];

const missingBranchMessage =
  'A(z) L loop node kimenő élei közül hiányzik a continue vagy az exit ág (loop_missing_branch_edge).';

describe('validateLoopBranchEdges', () => {
  it('continue és exit ággal rendelkező loop node-ra zöld', () => {
    const graph = graphOf(loopNodes, [
      edge('belepo', 'start', 'L'),
      edge('continue', 'L', 'torzs', 'continue'),
      edge('exit', 'L', 'utan', 'exit'),
    ]);

    expect(validateLoopBranchEdges(graph)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('exit ág nélküli loop node-ra loop_missing_branch_edge hibát ad', () => {
    const graph = graphOf(loopNodes, [edge('belepo', 'start', 'L'), edge('continue', 'L', 'torzs', 'continue')]);

    expect(validateLoopBranchEdges(graph)).toStrictEqual({ kind: 'error', message: missingBranchMessage });
  });

  it('continue ág nélküli loop node-ra loop_missing_branch_edge hibát ad', () => {
    const graph = graphOf(loopNodes, [edge('belepo', 'start', 'L'), edge('exit', 'L', 'utan', 'exit')]);

    expect(validateLoopBranchEdges(graph)).toStrictEqual({ kind: 'error', message: missingBranchMessage });
  });

  it('kimenő él nélküli loop node-ra loop_missing_branch_edge hibát ad', () => {
    const graph = graphOf(loopNodes, [edge('belepo', 'start', 'L')]);

    expect(validateLoopBranchEdges(graph)).toStrictEqual({ kind: 'error', message: missingBranchMessage });
  });

  it('loop node nélküli gráfra zöld', () => {
    const graph = graphOf([node('start', 'start'), node('a', 'agent_step')], [edge('e1', 'start', 'a')]);

    expect(validateLoopBranchEdges(graph)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('több, helyesen felágazó loop node-ra zöld', () => {
    const graph = graphOf(
      [...loopNodes, node('L2', 'loop'), node('torzs2', 'agent_step'), node('vege', 'agent_step')],
      [
        edge('belepo', 'start', 'L'),
        edge('continue', 'L', 'torzs', 'continue'),
        edge('exit', 'L', 'utan', 'exit'),
        edge('belepo2', 'utan', 'L2'),
        edge('continue2', 'L2', 'torzs2', 'continue'),
        edge('exit2', 'L2', 'vege', 'exit'),
      ],
    );

    expect(validateLoopBranchEdges(graph)).toStrictEqual({ kind: 'ok', value: undefined });
  });
});
