/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type { BranchContext } from '../branch-scope/branch-scope.ts';
import { validateScopeBalance } from '../branch-scope/validate-scope-balance.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import { findLoopBackEdges } from '../run-graph/find-loop-back-edges.ts';
import type { EdgeMark } from './edge-mark.ts';
import type { FanOutExpansion } from './fan-out-expansion.ts';
import type { RunTopology } from './run-topology.ts';
import type { SchedulerState } from './scheduler-state.ts';
import { buildScopedKey } from './build-scoped-key.ts';
import { createSchedulerState } from './create-scheduler-state.ts';
import { resolveInstanceReadiness } from './resolve-instance-readiness.ts';

function node(id: string, type: NodeType): SnapshotNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config: {}, effectiveProviderId: 'minimax' };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string, branchKey: string | null = null): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey };
}

function topologyOf(nodes: readonly SnapshotNode[], edges: readonly SnapshotEdge[]): RunTopology {
  const graph = buildExecutableGraph({
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: 'wf', name: 'teszt', description: null },
    nodes,
    edges,
  });
  const loopBackEdgeIds = findLoopBackEdges(graph);
  const balance = validateScopeBalance(graph, 'start', loopBackEdgeIds);
  if (balance.kind === 'error') {
    throw new Error(balance.message);
  }
  return { graph, loopBackEdgeIds, fanOutJoinPairing: balance.value };
}

function stateWith(
  marks: readonly (readonly [string, EdgeMark])[],
  expansions: readonly (readonly [string, FanOutExpansion])[] = [],
): SchedulerState {
  return { ...createSchedulerState(), edgeMarks: new Map(marks), fanOutExpansions: new Map(expansions) };
}

// start -> b(branch) -> {x, y} -> z: a `z` node két bejövő éllel áll, tehát
// rajta látszik a SPEC-004 4.4 2. és 3. pontja.
const JOIN_NELKULI = topologyOf(
  [
    node('start', 'start'),
    node('b', 'branch'),
    node('x', 'agent_step'),
    node('y', 'agent_step'),
    node('z', 'agent_step'),
  ],
  [
    edge('e1', 'start', 'b'),
    edge('e2', 'b', 'x', 'bal'),
    edge('e3', 'b', 'y', 'jobb'),
    edge('e4', 'x', 'z'),
    edge('e5', 'y', 'z'),
  ],
);

// start -> f(fan_out) -> a -> j(join) -> vege
const FAN_OUT_JOIN = topologyOf(
  [
    node('start', 'start'),
    node('f', 'fan_out'),
    node('a', 'agent_step'),
    node('j', 'join'),
    node('vege', 'agent_step'),
  ],
  [edge('e1', 'start', 'f'), edge('e2', 'f', 'a'), edge('e3', 'a', 'j'), edge('e4', 'j', 'vege')],
);

// start -> l(loop); l -continue-> torzs -> l (visszaél); l -exit-> vege
const CIKLUS = topologyOf(
  [node('start', 'start'), node('l', 'loop'), node('torzs', 'agent_step'), node('vege', 'agent_step')],
  [
    edge('e1', 'start', 'l'),
    edge('e2', 'l', 'torzs', 'continue'),
    edge('e3', 'torzs', 'l'),
    edge('e4', 'l', 'vege', 'exit'),
  ],
);

const ROOT: BranchContext = [];

function itemContext(itemIndex: number): BranchContext {
  return [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex }];
}

describe('resolveInstanceReadiness', () => {
  it('bejövő él nélküli példány vár, nem halott', () => {
    expect(
      resolveInstanceReadiness(createSchedulerState(), JOIN_NELKULI, { nodeId: 'start', branchContext: ROOT }),
    ).toBe('waiting');
  });

  it('hiányzó jelölésre vár', () => {
    const state = stateWith([[buildScopedKey('e4', ROOT), 'live']]);

    expect(resolveInstanceReadiness(state, JOIN_NELKULI, { nodeId: 'z', branchContext: ROOT })).toBe('waiting');
  });

  it('minden jelölés megvan és van live: futtatható', () => {
    const state = stateWith([
      [buildScopedKey('e4', ROOT), 'live'],
      [buildScopedKey('e5', ROOT), 'dead'],
    ]);

    expect(resolveInstanceReadiness(state, JOIN_NELKULI, { nodeId: 'z', branchContext: ROOT })).toBe('live');
  });

  it('csupa dead jelölésre a példány maga is halott', () => {
    const state = stateWith([
      [buildScopedKey('e4', ROOT), 'dead'],
      [buildScopedKey('e5', ROOT), 'dead'],
    ]);

    expect(resolveInstanceReadiness(state, JOIN_NELKULI, { nodeId: 'z', branchContext: ROOT })).toBe('dead');
  });

  it('a jelölés az ág kontextushoz tartozik, más kontextusban nem látszik', () => {
    const state = stateWith([[buildScopedKey('e2', itemContext(0)), 'live']]);

    expect(resolveInstanceReadiness(state, FAN_OUT_JOIN, { nodeId: 'a', branchContext: itemContext(0) })).toBe('live');
    expect(resolveInstanceReadiness(state, FAN_OUT_JOIN, { nodeId: 'a', branchContext: itemContext(1) })).toBe(
      'waiting',
    );
  });

  it('a loop node csak a belépő éleire vár, a visszaélre nem', () => {
    const state = stateWith([[buildScopedKey('e1', ROOT), 'live']]);

    expect(resolveInstanceReadiness(state, CIKLUS, { nodeId: 'l', branchContext: ROOT })).toBe('live');
  });

  it('a join a kibontás bejegyzés hiányában vár', () => {
    expect(resolveInstanceReadiness(createSchedulerState(), FAN_OUT_JOIN, { nodeId: 'j', branchContext: ROOT })).toBe(
      'waiting',
    );
  });

  it('párosítás nélküli join node vár, mert a várt jelölésszám ismeretlen', () => {
    const parositasNelkul: RunTopology = {
      ...FAN_OUT_JOIN,
      fanOutJoinPairing: { joinToFanOut: new Map() },
    };

    expect(
      resolveInstanceReadiness(createSchedulerState(), parositasNelkul, { nodeId: 'j', branchContext: ROOT }),
    ).toBe('waiting');
  });

  it('halott fan_out példány mellett a join példány is halott', () => {
    const state = stateWith([], [[buildScopedKey('f', ROOT), { kind: 'dead' }]]);

    expect(resolveInstanceReadiness(state, FAN_OUT_JOIN, { nodeId: 'j', branchContext: ROOT })).toBe('dead');
  });

  it('N = 0 esetén a join azonnal futtatható', () => {
    const state = stateWith([], [[buildScopedKey('f', ROOT), { kind: 'expanded', stepRunId: 'sr-f', items: [] }]]);

    expect(resolveInstanceReadiness(state, FAN_OUT_JOIN, { nodeId: 'j', branchContext: ROOT })).toBe('live');
  });

  it('a join bejövő élenként N jelölést vár', () => {
    const expansions: readonly (readonly [string, FanOutExpansion])[] = [
      [buildScopedKey('f', ROOT), { kind: 'expanded', stepRunId: 'sr-f', items: ['a', 'b'] }],
    ];
    const felig = stateWith([[buildScopedKey('e3', itemContext(0)), 'live']], expansions);
    const teljes = stateWith(
      [
        [buildScopedKey('e3', itemContext(0)), 'live'],
        [buildScopedKey('e3', itemContext(1)), 'dead'],
      ],
      expansions,
    );

    expect(resolveInstanceReadiness(felig, FAN_OUT_JOIN, { nodeId: 'j', branchContext: ROOT })).toBe('waiting');
    expect(resolveInstanceReadiness(teljes, FAN_OUT_JOIN, { nodeId: 'j', branchContext: ROOT })).toBe('live');
  });

  it('minden fan-out ág halott jelölése a join példányt is halottá teszi', () => {
    const state = stateWith(
      [
        [buildScopedKey('e3', itemContext(0)), 'dead'],
        [buildScopedKey('e3', itemContext(1)), 'dead'],
      ],
      [[buildScopedKey('f', ROOT), { kind: 'expanded', stepRunId: 'sr-f', items: ['a', 'b'] }]],
    );

    expect(resolveInstanceReadiness(state, FAN_OUT_JOIN, { nodeId: 'j', branchContext: ROOT })).toBe('dead');
  });
});
