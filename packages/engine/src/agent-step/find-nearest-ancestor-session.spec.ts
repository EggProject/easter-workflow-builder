/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type { BranchContext } from '../branch-scope/branch-scope.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { findNearestAncestorSession } from './find-nearest-ancestor-session.ts';
import type { SessionBearingInstance } from './session-bearing-instance.ts';

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

function fanOutContext(stepRunId: string, itemIndex: number): BranchContext {
  return [{ kind: 'fan_out', stepRunId, itemIndex }];
}

function sessionInstance(
  nodeId: string,
  sdkSessionId: string,
  branchContext: BranchContext = [],
): SessionBearingInstance {
  return { nodeId, branchContext, sdkSessionId };
}

// start -> a -> b -> c lánc, minden agent lépés.
const linearGraph = graphOf(
  [node('start', 'start'), node('a', 'agent_step'), node('b', 'agent_step'), node('c', 'agent_step')],
  [edge('e1', 'start', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'c')],
);

describe('findNearestAncestorSession', () => {
  it('a gráfban legközelebbi ős session azonosítóját adja, nem a legrégebbit', () => {
    const found = findNearestAncestorSession(
      linearGraph,
      [sessionInstance('a', 'session-a'), sessionInstance('b', 'session-b')],
      { nodeId: 'c', branchContext: [] },
    );

    expect(found).toBe('session-b');
  });

  it('a session nélküli közelebbi ős fölött továbblép a következő ősre', () => {
    const found = findNearestAncestorSession(linearGraph, [sessionInstance('a', 'session-a')], {
      nodeId: 'c',
      branchContext: [],
    });

    expect(found).toBe('session-a');
  });

  it('egyetlen ős példánynak sincs session azonosítója: undefined', () => {
    expect(findNearestAncestorSession(linearGraph, [], { nodeId: 'c', branchContext: [] })).toBeUndefined();
  });

  it('nem ős node session azonosítója nem látszik', () => {
    const graph = graphOf(
      [node('start', 'start'), node('bal', 'agent_step'), node('jobb', 'agent_step')],
      [edge('e1', 'start', 'bal'), edge('e2', 'start', 'jobb')],
    );

    const found = findNearestAncestorSession(graph, [sessionInstance('bal', 'session-bal')], {
      nodeId: 'jobb',
      branchContext: [],
    });

    expect(found).toBeUndefined();
  });

  it('másik fan_out ág kontextusában futott ős példány nem látszik', () => {
    const found = findNearestAncestorSession(
      linearGraph,
      [sessionInstance('b', 'session-b', fanOutContext('sr-f', 1))],
      { nodeId: 'c', branchContext: fanOutContext('sr-f', 0) },
    );

    expect(found).toBeUndefined();
  });

  it('az azonos fan_out ág kontextusában futott ős példány látszik', () => {
    const found = findNearestAncestorSession(
      linearGraph,
      [sessionInstance('b', 'session-b', fanOutContext('sr-f', 0))],
      { nodeId: 'c', branchContext: fanOutContext('sr-f', 0) },
    );

    expect(found).toBe('session-b');
  });
});
