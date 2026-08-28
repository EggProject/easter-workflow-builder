/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { resolveSessionBinding } from './resolve-session-binding.ts';
import type { SessionSourceNodes } from './session-source-nodes.ts';

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

// start -> s (agent) -> a (agent): az `a` node folytathatja az `s` sessionjét.
const linearGraph = graphOf(
  [node('start', 'start'), node('s', 'agent_step'), node('a', 'agent_step')],
  [edge('e1', 'start', 's'), edge('e2', 's', 'a')],
);

// start -> s (agent) -> f (fan_out) -> a (agent) -> j (join): az `a` node a
// forráshoz képest fan_out hatókörön belül van.
const fanOutGraph = graphOf(
  [node('start', 'start'), node('s', 'agent_step'), node('f', 'fan_out'), node('a', 'agent_step'), node('j', 'join')],
  [edge('e1', 'start', 's'), edge('e2', 's', 'f'), edge('e3', 'f', 'a'), edge('e4', 'a', 'j')],
);

const sessionSourceNodes: SessionSourceNodes = {
  sourceNodeIds: new Set(['s', 'a']),
  continuedNodeIds: new Set(['a']),
};

describe('resolveSessionBinding', () => {
  it('isolated módban nincs resume és nincs forkSession', () => {
    const binding = resolveSessionBinding({
      graph: linearGraph,
      sessionSourceNodes,
      instance: { nodeId: 'a', branchContext: [] },
      sessionMode: 'isolated',
      sessionInstances: [{ nodeId: 's', branchContext: [], sdkSessionId: 'session-s' }],
    });

    expect(binding).toStrictEqual({ kind: 'ok', value: { mode: 'isolated' } });
  });

  it('continued módban a legközelebbi ős session azonosítója megy ki', () => {
    const binding = resolveSessionBinding({
      graph: linearGraph,
      sessionSourceNodes,
      instance: { nodeId: 'a', branchContext: [] },
      sessionMode: 'continued',
      sessionInstances: [{ nodeId: 's', branchContext: [], sdkSessionId: 'session-s' }],
    });

    expect(binding).toStrictEqual({
      kind: 'ok',
      value: { mode: 'continued', resume: 'session-s', forkSession: false },
    });
  });

  it('continued módban fan_out hatókörben forkSession: true', () => {
    const binding = resolveSessionBinding({
      graph: fanOutGraph,
      sessionSourceNodes,
      instance: { nodeId: 'a', branchContext: [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 0 }] },
      sessionMode: 'continued',
      sessionInstances: [{ nodeId: 's', branchContext: [], sdkSessionId: 'session-s' }],
    });

    expect(binding).toStrictEqual({
      kind: 'ok',
      value: { mode: 'continued', resume: 'session-s', forkSession: true },
    });
  });

  it('continued módban folytatható ős nélkül no_resumable_session hibát ad', () => {
    const binding = resolveSessionBinding({
      graph: linearGraph,
      sessionSourceNodes,
      instance: { nodeId: 'a', branchContext: [] },
      sessionMode: 'continued',
      sessionInstances: [],
    });

    expect(binding).toStrictEqual({
      kind: 'error',
      message:
        'A(z) a node continued session módban fut, de az ág kontextusában egyetlen ős lépésnek sincs SDK session azonosítója (no_resumable_session).',
    });
  });
});
