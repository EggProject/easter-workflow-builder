/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type { BranchContext, BranchScope } from '../branch-scope/branch-scope.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { buildRunContext } from './build-run-context.ts';
import type { ExecutedStepInstance } from './executed-step-instance.ts';

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

function fanOut(stepRunId: string, itemIndex: number): BranchScope {
  return { kind: 'fan_out', stepRunId, itemIndex };
}

function loop(stepRunId: string, iteration: number): BranchScope {
  return { kind: 'loop', stepRunId, iteration };
}

const ROOT: BranchContext = [];

// start -> f -> a -> b -> j -> vege. A `b` node ősei három különböző
// mélységben állnak: a `start` és az `f` a gyökér kontextusban futott, az `a`
// a fan-out ág kontextusában; a `j` viszont leszármazott, nem ős.
const FAN_OUT = graphOf(
  [
    node('start', 'start'),
    node('f', 'fan_out'),
    node('a', 'agent_step'),
    node('b', 'agent_step'),
    node('j', 'join'),
    node('vege', 'agent_step'),
  ],
  [edge('e1', 'start', 'f'), edge('e2', 'f', 'a'), edge('e3', 'a', 'b'), edge('e4', 'b', 'j'), edge('e5', 'j', 'vege')],
);

const MASODIK_AG: BranchContext = [fanOut('sr-f', 1)];

const FAN_OUT_INSTANCES: readonly ExecutedStepInstance[] = [
  { nodeId: 'start', branchContext: ROOT, output: { kerdes: 'mi a helyzet' } },
  { nodeId: 'f', branchContext: ROOT, output: ['nulladik', 'elso'] },
  { nodeId: 'a', branchContext: [fanOut('sr-f', 0)], output: 'a nulladik ágból' },
  { nodeId: 'a', branchContext: MASODIK_AG, output: 'az első ágból' },
  { nodeId: 'j', branchContext: ROOT, output: ['osszefuzve'] },
];

describe('buildRunContext', () => {
  it('a futás bemenetét változatlanul adja tovább', () => {
    const context = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [],
      instance: { nodeId: 'b', branchContext: ROOT },
      input: { kerdes: 'mi a helyzet' },
    });

    expect(context.input).toStrictEqual({ kerdes: 'mi a helyzet' });
  });

  it('a steps rekord csak az ősöket tartalmazza, és mindegyikre a legbelső látható példányt', () => {
    const context = buildRunContext({
      graph: FAN_OUT,
      executedInstances: FAN_OUT_INSTANCES,
      instance: { nodeId: 'b', branchContext: MASODIK_AG },
      input: undefined,
    });

    expect(context.steps).toStrictEqual({
      start: { kerdes: 'mi a helyzet' },
      f: ['nulladik', 'elso'],
      a: 'az első ágból',
    });
  });

  it('a le nem futott ős egyszerűen hiányzik a steps rekordból, nem hiba', () => {
    const context = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [{ nodeId: 'start', branchContext: ROOT, output: 'a bemenet' }],
      instance: { nodeId: 'b', branchContext: MASODIK_AG },
      input: undefined,
    });

    expect(context.steps).toStrictEqual({ start: 'a bemenet' });
  });

  it('az item a hívótól érkezik, változatlanul', () => {
    const context = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [],
      instance: { nodeId: 'a', branchContext: MASODIK_AG },
      input: undefined,
      item: { nev: 'elso' },
    });

    expect(context.item).toStrictEqual({ nev: 'elso' });
  });

  it('az itemIndex a legbelső fan_out keretből jön', () => {
    const context = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [],
      instance: { nodeId: 'a', branchContext: [fanOut('sr-kulso', 3), fanOut('sr-belso', 7)] },
      input: undefined,
    });

    expect(context.itemIndex).toBe(7);
  });

  it('az iteration a legbelső loop keretből jön', () => {
    const context = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [],
      instance: { nodeId: 'a', branchContext: [loop('sr-kulso', 1), loop('sr-belso', 5)] },
      input: undefined,
    });

    expect(context.iteration).toBe(5);
  });

  it('a verem tetején álló loop keret nem takarja el az alatta nyitott fan_out elemsorszámot', () => {
    const context = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [],
      instance: { nodeId: 'a', branchContext: [fanOut('sr-f', 2), loop('sr-l', 4)] },
      input: undefined,
    });

    expect(context.itemIndex).toBe(2);
    expect(context.iteration).toBe(4);
  });

  it('hatókör keret nélkül az itemIndex és az iteration is undefined', () => {
    const context = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [],
      instance: { nodeId: 'b', branchContext: ROOT },
      input: undefined,
    });

    expect(context.itemIndex).toBeUndefined();
    expect(context.iteration).toBeUndefined();
  });

  it('a joinInputs csak akkor van kitöltve, ha a hívó átadja', () => {
    const nelkule = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [],
      instance: { nodeId: 'j', branchContext: ROOT },
      input: undefined,
    });
    const vele = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [],
      instance: { nodeId: 'j', branchContext: ROOT },
      input: undefined,
      joinInputs: ['nulladik ág', 'első ág'],
    });

    expect(nelkule.joinInputs).toBeUndefined();
    expect(vele.joinInputs).toStrictEqual(['nulladik ág', 'első ág']);
  });

  it('az error csak akkor van kitöltve, ha a hívó átadja', () => {
    const nelkule = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [],
      instance: { nodeId: 'b', branchContext: ROOT },
      input: undefined,
    });
    const vele = buildRunContext({
      graph: FAN_OUT,
      executedInstances: [],
      instance: { nodeId: 'b', branchContext: ROOT },
      input: undefined,
      error: { kind: 'provider_call_failed', message: 'a hívás elszállt (provider_call_failed).' },
    });

    expect(nelkule.error).toBeUndefined();
    expect(vele.error).toStrictEqual({
      kind: 'provider_call_failed',
      message: 'a hívás elszállt (provider_call_failed).',
    });
  });
});
