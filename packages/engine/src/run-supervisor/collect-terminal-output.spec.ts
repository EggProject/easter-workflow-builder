/* eslint-disable unicorn/no-null -- a `SnapshotNode` és a `SnapshotEdge` nullázható mezői (SPEC-003 5.1) valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type { ExecutedStepInstance } from '../run-context/executed-step-instance.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { collectTerminalOutput } from './collect-terminal-output.ts';

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

const LINEAR = graphOf([node('start', 'start'), node('veg', 'branch')], [edge('e1', 'start', 'veg')]);
const TWO_TERMINALS = graphOf(
  [node('start', 'start'), node('a', 'branch'), node('b', 'branch')],
  [edge('e1', 'start', 'a'), edge('e2', 'start', 'b')],
);

describe('collectTerminalOutput', () => {
  it('egyetlen terminális node esetén maga a kimenet, közbenső szint nélkül', () => {
    const executed: readonly ExecutedStepInstance[] = [
      { nodeId: 'start', branchContext: [], output: { be: 1 } },
      { nodeId: 'veg', branchContext: [], output: { ki: 2 } },
    ];

    expect(collectTerminalOutput(LINEAR, executed)).toStrictEqual({ ki: 2 });
  });

  it('egyetlen, le nem futott terminális node esetén undefined', () => {
    const executed: readonly ExecutedStepInstance[] = [{ nodeId: 'start', branchContext: [], output: { be: 1 } }];

    expect(collectTerminalOutput(LINEAR, executed)).toBeUndefined();
  });

  it('több terminális node esetén rekord, node azonosító szerint', () => {
    const executed: readonly ExecutedStepInstance[] = [
      { nodeId: 'start', branchContext: [], output: null },
      { nodeId: 'a', branchContext: [], output: 'a-kimenet' },
      { nodeId: 'b', branchContext: [], output: 'b-kimenet' },
    ];

    expect(collectTerminalOutput(TWO_TERMINALS, executed)).toStrictEqual({ a: 'a-kimenet', b: 'b-kimenet' });
  });

  it('több terminális node közül a le nem futott kimarad a rekordból', () => {
    const executed: readonly ExecutedStepInstance[] = [{ nodeId: 'a', branchContext: [], output: 'a-kimenet' }];

    expect(collectTerminalOutput(TWO_TERMINALS, executed)).toStrictEqual({ a: 'a-kimenet' });
  });

  it('ugyanannak a terminális node-nak több lefutásából az UTOLSÓ marad', () => {
    const executed: readonly ExecutedStepInstance[] = [
      { nodeId: 'veg', branchContext: [], output: 'elso' },
      { nodeId: 'veg', branchContext: [], output: 'masodik' },
    ];

    expect(collectTerminalOutput(LINEAR, executed)).toBe('masodik');
  });

  it('terminális node nélküli gráfra üres rekord', () => {
    const cyclic = graphOf([node('a', 'branch')], [edge('e1', 'a', 'a')]);

    expect(collectTerminalOutput(cyclic, [])).toStrictEqual({});
  });
});
