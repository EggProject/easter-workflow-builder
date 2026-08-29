/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type { BranchContext } from '../branch-scope/branch-scope.ts';
import { validateScopeBalance } from '../branch-scope/validate-scope-balance.ts';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import { findLoopBackEdges } from '../run-graph/find-loop-back-edges.ts';
import type { RunTopology } from './run-topology.ts';
import type { SchedulerState } from './scheduler-state.ts';
import type { SchedulingEvent } from './scheduling-event.ts';
import { advanceScheduler } from './advance-scheduler.ts';
import { buildScopedKey } from './build-scoped-key.ts';
import { collectJoinInputs } from './collect-join-inputs.ts';
import { createSchedulerState } from './create-scheduler-state.ts';
import { enqueueStartInstance } from './enqueue-start-instance.ts';
import { isRunTerminal } from './is-run-terminal.ts';
import { resolveFanOutItem } from './resolve-fan-out-item.ts';
import { resolveLoopIteration } from './resolve-loop-iteration.ts';
import { takeNextReadyInstance } from './take-next-ready-instance.ts';

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

// A lefutott példány olvasható jelölése: a node azonosítója, és mögötte a
// hatókör verem (`f<elem sorszám>`, illetve `l<iteráció>`), a gyökértől befelé.
function label(instance: StepInstanceReference): string {
  const scopes = instance.branchContext.map((scope) =>
    scope.kind === 'fan_out' ? `f${String(scope.itemIndex)}` : `l${String(scope.iteration)}`,
  );

  return scopes.length === 0 ? instance.nodeId : `${instance.nodeId}@${scopes.join('/')}`;
}

// A kimenő élek azonosítói `branch_key` szerint szűrve. Ebből áll össze a
// `node_completed` esemény `liveEdgeIds` halmaza.
function edgeIdsWhere(
  topology: RunTopology,
  nodeId: string,
  isAccepted: (branchKey: string | null) => boolean,
): ReadonlySet<string> {
  return new Set(
    (topology.graph.outgoingEdges.get(nodeId) ?? [])
      .filter((candidate) => isAccepted(candidate.branchKey))
      .map((candidate) => candidate.id),
  );
}

// A "sikeres lefutás, minden nem hiba ág él" alapeset (SPEC-004 4.4 4. pont:
// "a legtöbb típusnál minden kimenő él `live`").
function completeAll(topology: RunTopology, instance: StepInstanceReference): SchedulingEvent {
  return {
    kind: 'node_completed',
    instance,
    liveEdgeIds: edgeIdsWhere(topology, instance.nodeId, (branchKey) => branchKey !== 'on_error'),
  };
}

function completeWithBranchKey(
  topology: RunTopology,
  instance: StepInstanceReference,
  branchKey: string,
): SchedulingEvent {
  return {
    kind: 'node_completed',
    instance,
    liveEdgeIds: edgeIdsWhere(topology, instance.nodeId, (key) => key === branchKey),
  };
}

// Egy teljes futás lejátszása: a sor elejéről vett példányt a `decide` zárja le
// egy ütemezési eseménnyel. A visszaadott lista maga az érkezési sorrend. A
// számláló csak arra való, hogy egy hibás állapotgép ne fagyassza be a tesztet.
function playRun(
  topology: RunTopology,
  decide: (instance: StepInstanceReference, state: SchedulerState) => SchedulingEvent,
): { readonly executed: readonly string[]; readonly state: SchedulerState } {
  let state = enqueueStartInstance(createSchedulerState(), 'start');
  const executed: string[] = [];

  for (let guard = 0; guard < 100; guard += 1) {
    const taken = takeNextReadyInstance(state);
    if (taken === undefined) {
      break;
    }
    executed.push(label(taken.ready.instance));
    state = advanceScheduler(taken.state, topology, decide(taken.ready.instance, taken.state));
  }

  return { executed, state };
}

const ROOT: BranchContext = [];

function rootInstance(nodeId: string): StepInstanceReference {
  return { nodeId, branchContext: ROOT };
}

// REGRESSZIÓS gráf a halasztott jelöléshez: a `le` node-nak KÉT bejövő éle van,
// az egyik a hibára futó `br` node felől. Amíg a `br` hibája újrapróbálkozás
// alatt áll, a `br -> le` élre nem kerülhet `dead` jelölés, mert a 4.4 2. pontja
// szerint egyetlen `live` jelölés (itt az `ok -> le` él) már futtathatóvá tenné
// a `le` példányt - az pedig lefutna, majd a sikeres újrapróbálkozás után
// MÁSODSZOR is (`scheduling-event.ts` "Miért kell a halasztás").
function deferralTopology(): RunTopology {
  return topologyOf(
    [
      node('start', 'start'),
      node('br', 'branch'),
      node('ok', 'branch'),
      node('eh', 'error_handler'),
      node('le', 'agent_step'),
    ],
    [
      edge('e1', 'start', 'br'),
      edge('e2', 'start', 'ok'),
      edge('e3', 'br', 'le', 'a'),
      edge('e4', 'ok', 'le', 'a'),
      edge('e5', 'br', 'eh', 'on_error'),
    ],
  );
}

function onErrorEdgeIds(topology: RunTopology): ReadonlySet<string> {
  return edgeIdsWhere(topology, 'br', (branchKey) => branchKey === 'on_error');
}

// Az az állapot, amiben a `start` és az `ok` lefutott, a `br` pedig kezelt
// hibával zárt: az `on_error` éle `live`, a `br -> le` éle jelöletlen.
function stateAfterHandledFailure(topology: RunTopology): SchedulerState {
  let state = enqueueStartInstance(createSchedulerState(), 'start');
  state = advanceScheduler(state, topology, completeAll(topology, rootInstance('start')));
  state = advanceScheduler(state, topology, completeWithBranchKey(topology, rootInstance('ok'), 'a'));
  return advanceScheduler(state, topology, {
    kind: 'outgoing_marks_deferred',
    instance: rootInstance('br'),
    liveEdgeIds: onErrorEdgeIds(topology),
  });
}

function readyNodeIds(state: SchedulerState): readonly string[] {
  return state.readyInstances.map((ready) => ready.instance.nodeId);
}

describe('advanceScheduler', () => {
  it('lineáris láncon minden node egyszer fut le, és a futás terminális lesz', () => {
    const topology = topologyOf(
      [node('start', 'start'), node('a', 'agent_step'), node('vege', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'vege')],
    );

    const { executed, state } = playRun(topology, (instance) => completeAll(topology, instance));

    expect(executed).toStrictEqual(['start', 'a', 'vege']);
    expect(isRunTerminal(state)).toBe(true);
  });

  it('a kapott állapotot érintetlenül hagyja', () => {
    const topology = topologyOf([node('start', 'start'), node('a', 'agent_step')], [edge('e1', 'start', 'a')]);
    const initial = enqueueStartInstance(createSchedulerState(), 'start');

    advanceScheduler(initial, topology, completeAll(topology, { nodeId: 'start', branchContext: ROOT }));

    expect(initial.edgeMarks.size).toBe(0);
    expect(initial.readyInstances).toHaveLength(1);
  });

  it('a nem választott branch ág node-jai nem futnak le, a lentebbi több bejövő élű node mégis', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('b', 'branch'),
        node('x', 'agent_step'),
        node('y', 'agent_step'),
        node('z', 'agent_step'),
        node('vege', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'b'),
        edge('e2', 'b', 'x', 'bal'),
        edge('e3', 'b', 'y', 'jobb'),
        edge('e4', 'x', 'z'),
        edge('e5', 'y', 'z'),
        edge('e6', 'z', 'vege'),
      ],
    );

    const { executed } = playRun(topology, (instance) =>
      instance.nodeId === 'b' ? completeWithBranchKey(topology, instance, 'bal') : completeAll(topology, instance),
    );

    expect(executed).toStrictEqual(['start', 'b', 'x', 'z', 'vege']);
  });

  // Regresszió (T-005-30). A `branch` halott ága (`b -> z`) és élő ága
  // (`b -> y`) ugyanabba a node-ba (`y`) talál vissza, és a HALOTT él áll elöl
  // az él listában. A jelölések a menet elején mind kiíródnak, ezért a halott
  // `z` példány terjesztése a beágyazott menetben már futtathatónak látja az
  // `y` példányt és sorba állítja, majd a külső menet ugyanazt a példányt még
  // egyszer kiértékeli - `y` kétszer került a sorba, tehát kétszer futott le. A
  // `step_run` sor a példány azonosságához kötött (SPEC-004 4.3), és a
  // futtathatóság a jelöléseken áll, nem az élek pillanatképbeli sorrendjén
  // (4.4 2. pont), tehát ez sorrendtől független kell legyen.
  it('a halott ág terjesztése akkor sem futtatja kétszer a visszatalálkozó node-ot, ha a halott él áll elöl', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('b', 'branch'),
        node('y', 'agent_step'),
        node('z', 'agent_step'),
        node('vege', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'b'),
        edge('e2', 'b', 'z', 'jobb'),
        edge('e3', 'b', 'y', 'bal'),
        edge('e4', 'z', 'y'),
        edge('e5', 'y', 'vege'),
      ],
    );

    const { executed } = playRun(topology, (instance) =>
      instance.nodeId === 'b' ? completeWithBranchKey(topology, instance, 'bal') : completeAll(topology, instance),
    );

    expect(executed).toStrictEqual(['start', 'b', 'y', 'vege']);
  });

  it('N elemű fan_out N példányt ad, és a join egyszer fut a külső kontextusban', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('f', 'fan_out'),
        node('a', 'agent_step'),
        node('j', 'join'),
        node('vege', 'agent_step'),
      ],
      [edge('e1', 'start', 'f'), edge('e2', 'f', 'a'), edge('e3', 'a', 'j'), edge('e4', 'j', 'vege')],
    );

    const { executed, state } = playRun(topology, (instance) =>
      instance.nodeId === 'f'
        ? { kind: 'fan_out_expanded', instance, stepRunId: 'sr-f', items: ['p', 'q', 'r'] }
        : completeAll(topology, instance),
    );

    expect(executed).toStrictEqual(['start', 'f', 'a@f0', 'a@f1', 'a@f2', 'j', 'vege']);
    expect(resolveFanOutItem(state, [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 1 }])).toBe('q');
  });

  it('N = 0 esetén a törzs egyetlen példánya sem fut, a join viszont üres bemenettel lefut', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('f', 'fan_out'),
        node('a', 'agent_step'),
        node('j', 'join'),
        node('vege', 'agent_step'),
      ],
      [edge('e1', 'start', 'f'), edge('e2', 'f', 'a'), edge('e3', 'a', 'j'), edge('e4', 'j', 'vege')],
    );

    const { executed, state } = playRun(topology, (instance) =>
      instance.nodeId === 'f'
        ? { kind: 'fan_out_expanded', instance, stepRunId: 'sr-f', items: [] }
        : completeAll(topology, instance),
    );

    expect(executed).toStrictEqual(['start', 'f', 'j', 'vege']);
    expect(collectJoinInputs(state, topology, [], { nodeId: 'j', branchContext: ROOT })).toStrictEqual([]);
  });

  it('a fan_out hibaága a join példányt is halottá teszi, és a hibaút átjut', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('f', 'fan_out'),
        node('a', 'agent_step'),
        node('j', 'join'),
        node('eh', 'error_handler'),
        node('vege', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'f'),
        edge('e2', 'f', 'a'),
        edge('e3', 'a', 'j'),
        edge('e4', 'j', 'vege'),
        edge('e5', 'f', 'eh', 'on_error'),
        edge('e6', 'eh', 'vege', 'exhausted'),
      ],
    );

    const { executed } = playRun(topology, (instance) =>
      instance.nodeId === 'f' ? completeWithBranchKey(topology, instance, 'on_error') : completeAll(topology, instance),
    );

    expect(executed).toStrictEqual(['start', 'f', 'eh', 'vege']);
  });

  it('a sikeres kibontásnál a fan_out on_error éle halott jelölést kap', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('f', 'fan_out'),
        node('a', 'agent_step'),
        node('j', 'join'),
        node('eh', 'error_handler'),
        node('vege', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'f'),
        edge('e2', 'f', 'a'),
        edge('e3', 'a', 'j'),
        edge('e4', 'j', 'vege'),
        edge('e5', 'f', 'eh', 'on_error'),
        edge('e6', 'eh', 'vege', 'exhausted'),
      ],
    );

    const { executed } = playRun(topology, (instance) =>
      instance.nodeId === 'f'
        ? { kind: 'fan_out_expanded', instance, stepRunId: 'sr-f', items: ['p'] }
        : completeAll(topology, instance),
    );

    expect(executed).toStrictEqual(['start', 'f', 'a@f0', 'j', 'vege']);
  });

  it('egymásba ágyazott fan_out hatókörök mindegyik join példánya a saját külső veremben fut', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('kulso', 'fan_out'),
        node('belso', 'fan_out'),
        node('a', 'agent_step'),
        node('j-belso', 'join'),
        node('j-kulso', 'join'),
        node('vege', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'kulso'),
        edge('e2', 'kulso', 'belso'),
        edge('e3', 'belso', 'a'),
        edge('e4', 'a', 'j-belso'),
        edge('e5', 'j-belso', 'j-kulso'),
        edge('e6', 'j-kulso', 'vege'),
      ],
    );

    const { executed } = playRun(topology, (instance) => {
      if (instance.nodeId === 'kulso') {
        return { kind: 'fan_out_expanded', instance, stepRunId: 'sr-kulso', items: ['k'] };
      }
      if (instance.nodeId === 'belso') {
        return { kind: 'fan_out_expanded', instance, stepRunId: 'sr-belso', items: ['b0', 'b1'] };
      }
      return completeAll(topology, instance);
    });

    expect(executed).toStrictEqual([
      'start',
      'kulso',
      'belso@f0',
      'a@f0/f0',
      'a@f0/f1',
      'j-belso@f0',
      'j-kulso',
      'vege',
    ]);
  });

  it('a loop visszaéle külön lefutást indít, iterációnként új hatókörrel', () => {
    const topology = topologyOf(
      [node('start', 'start'), node('l', 'loop'), node('torzs', 'agent_step'), node('vege', 'agent_step')],
      [
        edge('e1', 'start', 'l'),
        edge('e2', 'l', 'torzs', 'continue'),
        edge('e3', 'torzs', 'l'),
        edge('e4', 'l', 'vege', 'exit'),
      ],
    );

    const iteraciok: number[] = [];
    const { executed, state } = playRun(topology, (instance, current) => {
      if (instance.nodeId !== 'l') {
        return completeAll(topology, instance);
      }
      const iteration = resolveLoopIteration(current, instance);
      iteraciok.push(iteration);
      return { kind: 'loop_advanced', instance, stepRunId: `sr-l-${String(iteration)}`, shouldContinue: iteration < 2 };
    });

    expect(executed).toStrictEqual(['start', 'l', 'torzs@l0', 'l', 'torzs@l1', 'l', 'vege']);
    expect(iteraciok).toStrictEqual([0, 1, 2]);
    expect(resolveLoopIteration(state, { nodeId: 'l', branchContext: ROOT })).toBe(3);
  });

  it('a törzs halott ágából érkező visszaél nem indít újabb lefutást', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('l', 'loop'),
        node('elagazas', 'branch'),
        node('vissza', 'agent_step'),
        node('mellek', 'agent_step'),
        node('vege', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'l'),
        edge('e2', 'l', 'elagazas', 'continue'),
        edge('e3', 'elagazas', 'vissza', 'bal'),
        edge('e4', 'vissza', 'l'),
        edge('e5', 'elagazas', 'mellek', 'jobb'),
        edge('e6', 'l', 'vege', 'exit'),
      ],
    );

    const { executed, state } = playRun(topology, (instance) => {
      if (instance.nodeId === 'l') {
        return { kind: 'loop_advanced', instance, stepRunId: 'sr-l-0', shouldContinue: true };
      }
      if (instance.nodeId === 'elagazas') {
        return completeWithBranchKey(topology, instance, 'jobb');
      }
      return completeAll(topology, instance);
    });

    expect(executed).toStrictEqual(['start', 'l', 'elagazas@l0', 'mellek@l0']);
    expect(isRunTerminal(state)).toBe(true);
  });

  it('a loop hibaága a törzset meg sem nyitja, a hibaút viszont átjut', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('l', 'loop'),
        node('torzs', 'agent_step'),
        node('eh', 'error_handler'),
        node('vege', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'l'),
        edge('e2', 'l', 'torzs', 'continue'),
        edge('e3', 'torzs', 'l'),
        edge('e4', 'l', 'vege', 'exit'),
        edge('e5', 'l', 'eh', 'on_error'),
        edge('e6', 'eh', 'vege', 'exhausted'),
      ],
    );

    const { executed } = playRun(topology, (instance) =>
      instance.nodeId === 'l' ? completeWithBranchKey(topology, instance, 'on_error') : completeAll(topology, instance),
    );

    expect(executed).toStrictEqual(['start', 'l', 'eh', 'vege']);
  });

  it('a kilépő loop lefutás az on_error élére halott jelölést tesz', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('l', 'loop'),
        node('torzs', 'agent_step'),
        node('eh', 'error_handler'),
        node('vege', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'l'),
        edge('e2', 'l', 'torzs', 'continue'),
        edge('e3', 'torzs', 'l'),
        edge('e4', 'l', 'vege', 'exit'),
        edge('e5', 'l', 'eh', 'on_error'),
        edge('e6', 'eh', 'vege', 'exhausted'),
      ],
    );

    const { executed } = playRun(topology, (instance) =>
      instance.nodeId === 'l'
        ? { kind: 'loop_advanced', instance, stepRunId: 'sr-l-0', shouldContinue: false }
        : completeAll(topology, instance),
    );

    expect(executed).toStrictEqual(['start', 'l', 'vege']);
  });

  it('fan_out hatókörben álló ciklus ágonként külön iterációt futtat', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('f', 'fan_out'),
        node('l', 'loop'),
        node('torzs', 'agent_step'),
        node('j', 'join'),
        node('vege', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'f'),
        edge('e2', 'f', 'l'),
        edge('e3', 'l', 'torzs', 'continue'),
        edge('e4', 'torzs', 'l'),
        edge('e5', 'l', 'j', 'exit'),
        edge('e6', 'j', 'vege'),
      ],
    );

    const { executed } = playRun(topology, (instance, current) => {
      if (instance.nodeId === 'f') {
        return { kind: 'fan_out_expanded', instance, stepRunId: 'sr-f', items: ['p', 'q'] };
      }
      if (instance.nodeId === 'l') {
        const iteration = resolveLoopIteration(current, instance);
        return {
          kind: 'loop_advanced',
          instance,
          stepRunId: `sr-l-${label(instance)}-${String(iteration)}`,
          shouldContinue: iteration < 1,
        };
      }
      return completeAll(topology, instance);
    });

    expect(executed).toStrictEqual([
      'start',
      'f',
      'l@f0',
      'l@f1',
      'torzs@f0/l0',
      'torzs@f1/l0',
      'l@f0',
      'l@f1',
      'j',
      'vege',
    ]);
  });

  it('egymásba ágyazott ciklusok visszaéle a saját loop node kontextusára vág vissza', () => {
    const topology = topologyOf(
      [
        node('start', 'start'),
        node('lo', 'loop'),
        node('li', 'loop'),
        node('ib', 'agent_step'),
        node('lifin', 'agent_step'),
        node('other', 'agent_step'),
        node('vege', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'lo'),
        edge('e2', 'lo', 'li', 'continue'),
        edge('e3', 'lo', 'other', 'continue'),
        edge('e4', 'li', 'ib', 'continue'),
        edge('e5', 'ib', 'li'),
        edge('e6', 'li', 'lifin', 'exit'),
        edge('e7', 'other', 'lo'),
        edge('e8', 'lo', 'vege', 'exit'),
      ],
    );

    const { executed } = playRun(topology, (instance, current) => {
      if (instance.nodeId !== 'lo' && instance.nodeId !== 'li') {
        return completeAll(topology, instance);
      }
      const iteration = resolveLoopIteration(current, instance);
      return {
        kind: 'loop_advanced',
        instance,
        stepRunId: `sr-${instance.nodeId}-${String(iteration)}`,
        shouldContinue: iteration === 0,
      };
    });

    expect(executed).toStrictEqual(['start', 'lo', 'li@l0', 'other@l0', 'ib@l0/l0', 'lo', 'li@l0', 'vege', 'lifin@l0']);
  });

  it('outgoing_marks_deferred esetén a jelöletlen élen álló leszármazott vár, akkor is, ha másik éle live', () => {
    const topology = deferralTopology();

    const state = stateAfterHandledFailure(topology);

    expect(state.edgeMarks.get(buildScopedKey('e5', ROOT))).toBe('live');
    expect(state.edgeMarks.get(buildScopedKey('e3', ROOT))).toBeUndefined();
    expect(readyNodeIds(state)).toStrictEqual(['start', 'br', 'ok', 'eh']);
  });

  it('deferred_marks_settled a menekülő élt kihagyva jelöl dead-et, és felszabadítja a várakozó leszármazottat', () => {
    const topology = deferralTopology();

    const state = advanceScheduler(stateAfterHandledFailure(topology), topology, {
      kind: 'deferred_marks_settled',
      instance: rootInstance('br'),
      keptEdgeIds: onErrorEdgeIds(topology),
    });

    expect(state.edgeMarks.get(buildScopedKey('e3', ROOT))).toBe('dead');
    // A menekülő él jelölése változatlan: a felülírása visszamenőleg tenné
    // halottá a már elindult kezelőt, és a kezelőt újra sorba is állítaná.
    expect(state.edgeMarks.get(buildScopedKey('e5', ROOT))).toBe('live');
    expect(readyNodeIds(state)).toStrictEqual(['start', 'br', 'ok', 'eh', 'le']);
  });
});
