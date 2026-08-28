/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type { BranchContext } from '../branch-scope/branch-scope.ts';
import { validateScopeBalance } from '../branch-scope/validate-scope-balance.ts';
import type { ExecutedStepInstance } from '../run-context/executed-step-instance.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import { findLoopBackEdges } from '../run-graph/find-loop-back-edges.ts';
import type { EdgeMark } from './edge-mark.ts';
import type { FanOutExpansion } from './fan-out-expansion.ts';
import type { RunTopology } from './run-topology.ts';
import type { SchedulerState } from './scheduler-state.ts';
import { buildScopedKey } from './build-scoped-key.ts';
import { collectJoinInputs } from './collect-join-inputs.ts';
import { createSchedulerState } from './create-scheduler-state.ts';

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

// start -> f(fan_out) -> {a, b} -> j(join) -> vege: a `join` node két bejövő
// éllel áll, tehát látszik az elem sorrend és az élsorrend együtt.
const KET_AGGAL = topologyOf(
  [
    node('start', 'start'),
    node('f', 'fan_out'),
    node('a', 'agent_step'),
    node('b', 'agent_step'),
    node('j', 'join'),
    node('vege', 'agent_step'),
  ],
  [
    edge('e1', 'start', 'f'),
    edge('e2', 'f', 'a'),
    edge('e3', 'f', 'b'),
    edge('e4', 'a', 'j'),
    edge('e5', 'b', 'j'),
    edge('e6', 'j', 'vege'),
  ],
);

const ROOT: BranchContext = [];
const JOIN_INSTANCE = { nodeId: 'j', branchContext: ROOT };

function itemContext(itemIndex: number): BranchContext {
  return [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex }];
}

function stateWith(
  marks: readonly (readonly [string, EdgeMark])[],
  expansion: FanOutExpansion,
  fanOutNodeId = 'f',
): SchedulerState {
  return {
    ...createSchedulerState(),
    edgeMarks: new Map(marks),
    fanOutExpansions: new Map([[buildScopedKey(fanOutNodeId, ROOT), expansion]]),
  };
}

const KET_ELEM: FanOutExpansion = { kind: 'expanded', stepRunId: 'sr-f', items: ['p', 'q'] };

describe('collectJoinInputs', () => {
  it('párosítás nélküli join node bemenete üres', () => {
    const parositasNelkul: RunTopology = { ...KET_AGGAL, fanOutJoinPairing: { joinToFanOut: new Map() } };

    expect(collectJoinInputs(createSchedulerState(), parositasNelkul, [], JOIN_INSTANCE)).toStrictEqual([]);
  });

  it('kibontás bejegyzés nélkül üres', () => {
    expect(collectJoinInputs(createSchedulerState(), KET_AGGAL, [], JOIN_INSTANCE)).toStrictEqual([]);
  });

  it('halott fan_out példány mellett üres', () => {
    const state = stateWith([], { kind: 'dead' });

    expect(collectJoinInputs(state, KET_AGGAL, [], JOIN_INSTANCE)).toStrictEqual([]);
  });

  it('bejövő él nélküli join példány bemenete üres', () => {
    // A futás indítási validáció ezt a gráfot `unreachable_node` hibával
    // elutasítaná, de a függvény önállóan is hívható, ezért a szerződése
    // rögzítve áll: bejövő él híján nincs beérkezett ág kimenet sem.
    const graph = buildExecutableGraph({
      version: 1,
      sdkVersionPin: '0.0.0-teszt',
      workflow: { id: 'wf', name: 'teszt', description: null },
      nodes: [node('start', 'start'), node('f', 'fan_out'), node('j', 'join')],
      edges: [edge('e1', 'start', 'f')],
    });
    const topology: RunTopology = {
      graph,
      loopBackEdgeIds: new Set(),
      fanOutJoinPairing: { joinToFanOut: new Map([['j', 'f']]) },
    };

    expect(collectJoinInputs(stateWith([], KET_ELEM), topology, [], JOIN_INSTANCE)).toStrictEqual([]);
  });

  it('N = 0 esetén üres a bemeneti lista', () => {
    const state = stateWith([], { kind: 'expanded', stepRunId: 'sr-f', items: [] });

    expect(collectJoinInputs(state, KET_AGGAL, [], JOIN_INSTANCE)).toStrictEqual([]);
  });

  it('a kimeneteket elem sorrendben, azon belül élsorrendben adja', () => {
    const state = stateWith(
      [
        [buildScopedKey('e4', itemContext(0)), 'live'],
        [buildScopedKey('e5', itemContext(0)), 'live'],
        [buildScopedKey('e4', itemContext(1)), 'live'],
        [buildScopedKey('e5', itemContext(1)), 'live'],
      ],
      KET_ELEM,
    );
    const executed: readonly ExecutedStepInstance[] = [
      { nodeId: 'a', branchContext: itemContext(0), output: 'a0' },
      { nodeId: 'b', branchContext: itemContext(0), output: 'b0' },
      { nodeId: 'a', branchContext: itemContext(1), output: 'a1' },
      { nodeId: 'b', branchContext: itemContext(1), output: 'b1' },
    ];

    expect(collectJoinInputs(state, KET_AGGAL, executed, JOIN_INSTANCE)).toStrictEqual(['a0', 'b0', 'a1', 'b1']);
  });

  it('a halott ág kimenete nem kerül a listába', () => {
    const state = stateWith(
      [
        [buildScopedKey('e4', itemContext(0)), 'live'],
        [buildScopedKey('e5', itemContext(0)), 'dead'],
        [buildScopedKey('e4', itemContext(1)), 'dead'],
        [buildScopedKey('e5', itemContext(1)), 'live'],
      ],
      KET_ELEM,
    );
    const executed: readonly ExecutedStepInstance[] = [
      { nodeId: 'a', branchContext: itemContext(0), output: 'a0' },
      { nodeId: 'b', branchContext: itemContext(1), output: 'b1' },
    ];

    expect(collectJoinInputs(state, KET_AGGAL, executed, JOIN_INSTANCE)).toStrictEqual(['a0', 'b1']);
  });

  it('a lefutott példányok között nem szereplő ág kimarad', () => {
    const state = stateWith(
      [
        [buildScopedKey('e4', itemContext(0)), 'live'],
        [buildScopedKey('e5', itemContext(0)), 'live'],
        [buildScopedKey('e4', itemContext(1)), 'live'],
        [buildScopedKey('e5', itemContext(1)), 'live'],
      ],
      KET_ELEM,
    );
    const executed: readonly ExecutedStepInstance[] = [{ nodeId: 'a', branchContext: itemContext(0), output: 'a0' }];

    expect(collectJoinInputs(state, KET_AGGAL, executed, JOIN_INSTANCE)).toStrictEqual(['a0']);
  });

  it('a közvetlenül a join-ba kötött fan_out kimenete a külső veremből is látszik', () => {
    const kozvetlen = topologyOf(
      [node('start', 'start'), node('f', 'fan_out'), node('j', 'join'), node('vege', 'agent_step')],
      [edge('e1', 'start', 'f'), edge('e2', 'f', 'j'), edge('e3', 'j', 'vege')],
    );
    const state = stateWith(
      [
        [buildScopedKey('e2', itemContext(0)), 'live'],
        [buildScopedKey('e2', itemContext(1)), 'live'],
      ],
      KET_ELEM,
    );
    const executed: readonly ExecutedStepInstance[] = [{ nodeId: 'f', branchContext: ROOT, output: 'f-kimenet' }];

    expect(collectJoinInputs(state, kozvetlen, executed, JOIN_INSTANCE)).toStrictEqual(['f-kimenet', 'f-kimenet']);
  });
});
