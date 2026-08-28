/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from './build-executable-graph.ts';
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

describe('findLoopBackEdges', () => {
  it('a loop node törzséből visszatérő élt visszaélnek jelöli, a belépő élt nem', () => {
    const graph = graphOf(
      [node('start', 'start'), node('L', 'loop'), node('torzs', 'agent_step'), node('utan', 'agent_step')],
      [
        edge('belepo', 'start', 'L'),
        edge('continue', 'L', 'torzs', 'continue'),
        edge('vissza', 'torzs', 'L'),
        edge('exit', 'L', 'utan', 'exit'),
      ],
    );

    expect(findLoopBackEdges(graph)).toStrictEqual(new Set(['vissza']));
  });

  it('loop node nélküli kör egyetlen élét sem jelöli visszaélnek', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step'), node('b', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'a')],
    );

    expect(findLoopBackEdges(graph)).toStrictEqual(new Set());
  });

  it('bejövő él nélküli loop node-ra üres halmazt ad', () => {
    const graph = graphOf(
      [node('start', 'start'), node('L', 'loop'), node('utan', 'agent_step')],
      [edge('exit', 'L', 'utan', 'exit')],
    );

    expect(findLoopBackEdges(graph)).toStrictEqual(new Set());
  });

  it('a loop node önmagára mutató élét visszaélnek jelöli', () => {
    const graph = graphOf(
      [node('start', 'start'), node('L', 'loop'), node('utan', 'agent_step')],
      [edge('belepo', 'start', 'L'), edge('onmaga', 'L', 'L', 'continue'), edge('exit', 'L', 'utan', 'exit')],
    );

    expect(findLoopBackEdges(graph)).toStrictEqual(new Set(['onmaga']));
  });

  it('két loop node mindegyikének megtalálja a saját visszaélét', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('L1', 'loop'),
        node('torzs1', 'agent_step'),
        node('L2', 'loop'),
        node('torzs2', 'agent_step'),
        node('utan', 'agent_step'),
      ],
      [
        edge('belepo1', 'start', 'L1'),
        edge('continue1', 'L1', 'torzs1', 'continue'),
        edge('vissza1', 'torzs1', 'L1'),
        edge('exit1', 'L1', 'L2', 'exit'),
        edge('continue2', 'L2', 'torzs2', 'continue'),
        edge('vissza2', 'torzs2', 'L2'),
        edge('exit2', 'L2', 'utan', 'exit'),
      ],
    );

    expect(findLoopBackEdges(graph)).toStrictEqual(new Set(['vissza1', 'vissza2']));
  });
});
