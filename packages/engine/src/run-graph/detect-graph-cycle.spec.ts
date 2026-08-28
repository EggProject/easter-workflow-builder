/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from './build-executable-graph.ts';
import { detectGraphCycle } from './detect-graph-cycle.ts';
import type { ExecutableGraph } from './executable-graph.ts';
import { findLoopBackEdges } from './find-loop-back-edges.ts';

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

// A SPEC-004 4.6 szerinti, helyesen megrajzolt ciklus: a `loop` node törzse a
// `continue` élen indul, és a `vissza` él a `loop` node-ra tér vissza.
function loopGraph(): ExecutableGraph {
  return graphOf(
    [node('start', 'start'), node('L', 'loop'), node('torzs', 'agent_step'), node('utan', 'agent_step')],
    [
      edge('belepo', 'start', 'L'),
      edge('continue', 'L', 'torzs', 'continue'),
      edge('vissza', 'torzs', 'L'),
      edge('exit', 'L', 'utan', 'exit'),
    ],
  );
}

describe('detectGraphCycle', () => {
  it('üres gráfra zöld', () => {
    expect(detectGraphCycle(graphOf([], []), new Set())).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('elágazás nélküli láncra zöld', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step'), node('b', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'b')],
    );

    expect(detectGraphCycle(graph, new Set())).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('két úton visszatalálkozó ágakra zöld, mert az nem kör', () => {
    const graph = graphOf(
      [node('start', 'branch'), node('a', 'agent_step'), node('b', 'agent_step'), node('c', 'join')],
      [edge('e1', 'start', 'a'), edge('e2', 'start', 'b'), edge('e3', 'a', 'c'), edge('e4', 'b', 'c')],
    );

    expect(detectGraphCycle(graph, new Set())).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('loop node nélküli kört graph_cycle_detected hibával jelez, a körben álló node azonosítókkal', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step'), node('b', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'a')],
    );

    expect(detectGraphCycle(graph, findLoopBackEdges(graph))).toStrictEqual({
      kind: 'error',
      message: 'A gráf kört tartalmaz a következő node-okon át: a, b (graph_cycle_detected).',
    });
  });

  it('a loop node visszaélének elhagyása után az egyébként ciklikus gráf átmegy', () => {
    const graph = loopGraph();

    expect(detectGraphCycle(graph, findLoopBackEdges(graph))).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('ugyanaz a loop gráf visszaél jelölés nélkül kört jelez', () => {
    expect(detectGraphCycle(loopGraph(), new Set())).toStrictEqual({
      kind: 'error',
      message: 'A gráf kört tartalmaz a következő node-okon át: L, torzs (graph_cycle_detected).',
    });
  });
});
