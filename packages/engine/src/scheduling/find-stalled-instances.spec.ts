/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import { buildScopedKey } from './build-scoped-key.ts';
import { createSchedulerState } from './create-scheduler-state.ts';
import type { EdgeMark } from './edge-mark.ts';
import { findStalledInstances } from './find-stalled-instances.ts';
import type { RunTopology } from './run-topology.ts';
import type { SchedulerState } from './scheduler-state.ts';

function node(id: string, type: NodeType): SnapshotNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config: {}, effectiveProviderId: 'minimax' };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string, branchKey: string | null = null): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey };
}

// start -> b(branch) -> {x, y} -> z: a `z` két bejövő élre vár (SPEC-004 4.4 2. pont).
const TOPOLOGY: RunTopology = {
  graph: buildExecutableGraph({
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: 'wf', name: 'teszt', description: null },
    nodes: [
      node('start', 'start'),
      node('b', 'branch'),
      node('x', 'agent_step'),
      node('y', 'agent_step'),
      node('z', 'agent_step'),
    ],
    edges: [
      edge('e1', 'start', 'b'),
      edge('e2', 'b', 'x', 'bal'),
      edge('e3', 'b', 'y', 'jobb'),
      edge('e4', 'x', 'z'),
      edge('e5', 'y', 'z'),
    ],
  }),
  loopBackEdgeIds: new Set(),
  fanOutJoinPairing: { joinToFanOut: new Map() },
};

const Z: StepInstanceReference = { nodeId: 'z', branchContext: [] };

function stateWith(marks: readonly (readonly [string, EdgeMark])[]): SchedulerState {
  return {
    ...createSchedulerState(),
    edgeMarks: new Map(marks.map(([edgeId, mark]) => [buildScopedKey(edgeId, []), mark])),
    markedInstances: new Map([[buildScopedKey('z', []), Z]]),
  };
}

describe('findStalledInstances', () => {
  it('a fel nem használt live jelöléssel, hiányzó társjelöléssel várakozó példányt elakadtnak adja', () => {
    expect(findStalledInstances(stateWith([['e4', 'live']]), TOPOLOGY)).toStrictEqual([Z]);
  });

  it('a csak dead jelöléssel, hiányzó társjelöléssel várakozó példányt is elakadtnak adja', () => {
    expect(findStalledInstances(stateWith([['e4', 'dead']]), TOPOLOGY)).toStrictEqual([Z]);
  });

  it('a minden bejövő élén jelölt példány nem elakadt, akár futott, akár halott', () => {
    expect(
      findStalledInstances(
        stateWith([
          ['e4', 'live'],
          ['e5', 'dead'],
        ]),
        TOPOLOGY,
      ),
    ).toStrictEqual([]);
    expect(
      findStalledInstances(
        stateWith([
          ['e4', 'dead'],
          ['e5', 'dead'],
        ]),
        TOPOLOGY,
      ),
    ).toStrictEqual([]);
  });

  it('jelölés nélküli állapotban nincs elakadt példány', () => {
    expect(findStalledInstances(createSchedulerState(), TOPOLOGY)).toStrictEqual([]);
  });
});
