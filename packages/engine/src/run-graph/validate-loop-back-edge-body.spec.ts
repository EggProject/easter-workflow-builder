/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from './build-executable-graph.ts';
import type { ExecutableGraph } from './executable-graph.ts';
import { findLoopBackEdges } from './find-loop-back-edges.ts';
import { validateLoopBackEdgeBody } from './validate-loop-back-edge-body.ts';

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

describe('validateLoopBackEdgeBody', () => {
  it('a törzsből visszatérő visszaélre zöld', () => {
    const graph = graphOf(
      [node('start', 'start'), node('L', 'loop'), node('torzs', 'agent_step'), node('utan', 'agent_step')],
      [
        edge('belepo', 'start', 'L'),
        edge('continue', 'L', 'torzs', 'continue'),
        edge('vissza', 'torzs', 'L'),
        edge('exit', 'L', 'utan', 'exit'),
      ],
    );

    expect(validateLoopBackEdgeBody(graph, findLoopBackEdges(graph))).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('a törzsön kívülről érkező visszaélre loop_back_edge_outside_body hibát ad', () => {
    // A `torzs` node zsákutca, tehát a ciklustörzs pontosan {torzs}. Az `exit`
    // ág node-jai (`utan`, `kivul`) elérhetők a `loop` node-ból, ezért a
    // `kivul -> L` él a 4.6 definíciója szerint visszaél, a forrása viszont
    // nincs a törzsben.
    const graph = graphOf(
      [
        node('start', 'start'),
        node('L', 'loop'),
        node('torzs', 'agent_step'),
        node('utan', 'agent_step'),
        node('kivul', 'agent_step'),
      ],
      [
        edge('belepo', 'start', 'L'),
        edge('continue', 'L', 'torzs', 'continue'),
        edge('exit', 'L', 'utan', 'exit'),
        edge('tovabb', 'utan', 'kivul'),
        edge('vissza', 'kivul', 'L'),
      ],
    );
    const loopBackEdgeIds = findLoopBackEdges(graph);

    expect(loopBackEdgeIds).toStrictEqual(new Set(['vissza']));
    expect(validateLoopBackEdgeBody(graph, loopBackEdgeIds)).toStrictEqual({
      kind: 'error',
      message:
        'A(z) L loop node vissza visszaélének forrása (kivul) nincs a ciklus törzsében (loop_back_edge_outside_body).',
    });
  });

  it('visszaél nélküli loop node-ra zöld', () => {
    const graph = graphOf(
      [node('start', 'start'), node('L', 'loop'), node('torzs', 'agent_step'), node('utan', 'agent_step')],
      [edge('belepo', 'start', 'L'), edge('continue', 'L', 'torzs', 'continue'), edge('exit', 'L', 'utan', 'exit')],
    );

    expect(validateLoopBackEdgeBody(graph, findLoopBackEdges(graph))).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('él nélküli, magányos loop node-ra zöld', () => {
    const graph = graphOf([node('start', 'start'), node('L', 'loop')], []);

    expect(validateLoopBackEdgeBody(graph, new Set())).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('loop node nélküli gráfra zöld', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'start')],
    );

    expect(validateLoopBackEdgeBody(graph, findLoopBackEdges(graph))).toStrictEqual({ kind: 'ok', value: undefined });
  });
});
