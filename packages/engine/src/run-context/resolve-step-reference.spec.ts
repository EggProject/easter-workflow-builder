/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type { BranchContext } from '../branch-scope/branch-scope.ts';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { resolveStepReference } from './resolve-step-reference.ts';

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

const ROOT: BranchContext = [];

// start -> a -> b, egyetlen ág, gyökér kontextusban.
const LINEARIS = graphOf(
  [node('start', 'start'), node('a', 'agent_step'), node('b', 'agent_step')],
  [edge('e1', 'start', 'a'), edge('e2', 'a', 'b')],
);

// start -> elag -> { x, y }: az `x` és az `y` egymást kizáró ágon áll, de a
// `branch` node nem nyit hatókört, tehát mindkettő gyökér kontextusban fut.
const KETAGU = graphOf(
  [node('start', 'start'), node('elag', 'branch'), node('x', 'agent_step'), node('y', 'agent_step')],
  [edge('e1', 'start', 'elag'), edge('e2', 'elag', 'x', 'bal'), edge('e3', 'elag', 'y', 'jobb')],
);

// start -> f -> a -> b -> j -> vege: az `a` és a `b` ugyanannak a fan-out
// hatókörnek az elemenkénti ágában fut.
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

describe('resolveStepReference', () => {
  it('ős node lefutott példányának kimenetét adja', () => {
    const instances = [{ nodeId: 'a', branchContext: ROOT, output: { valasz: 42 } }];

    expect(resolveStepReference(LINEARIS, instances, { nodeId: 'b', branchContext: ROOT }, 'a')).toStrictEqual({
      kind: 'ok',
      value: { valasz: 42 },
    });
  });

  it('nem ős node hivatkozása akkor is hiba, ha a node létezik és lefutott', () => {
    const instances = [{ nodeId: 'y', branchContext: ROOT, output: 'y kimenete' }];

    expect(resolveStepReference(KETAGU, instances, { nodeId: 'x', branchContext: ROOT }, 'y')).toStrictEqual({
      kind: 'error',
      message: 'A(z) y node nem gráfbeli őse a(z) x node-nak (unresolvable_step_reference).',
    });
  });

  it('a gráfban nem is létező node hivatkozása ugyanezt a hibát adja', () => {
    expect(resolveStepReference(LINEARIS, [], { nodeId: 'b', branchContext: ROOT }, 'nincs-ilyen')).toStrictEqual({
      kind: 'error',
      message: 'A(z) nincs-ilyen node nem gráfbeli őse a(z) b node-nak (unresolvable_step_reference).',
    });
  });

  it('a még le nem futott ős hivatkozása hiba', () => {
    expect(resolveStepReference(LINEARIS, [], { nodeId: 'b', branchContext: ROOT }, 'a')).toStrictEqual({
      kind: 'error',
      message:
        'A(z) a node-nak nincs látható lefutott példánya a(z) b node ág kontextusából nézve (unresolvable_step_reference).',
    });
  });

  it('a fan-out testvér ág kimenetére hivatkozás ugyanezt a hibát adja', () => {
    const elsoAg: BranchContext = [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 0 }];
    const masodikAg: BranchContext = [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 1 }];
    const instances = [{ nodeId: 'a', branchContext: elsoAg, output: 'nulladik elem' }];

    expect(resolveStepReference(FAN_OUT, instances, { nodeId: 'b', branchContext: masodikAg }, 'a')).toStrictEqual({
      kind: 'error',
      message:
        'A(z) a node-nak nincs látható lefutott példánya a(z) b node ág kontextusából nézve (unresolvable_step_reference).',
    });
  });

  it('a saját ágban futott ős példány feloldható', () => {
    const sajatAg: BranchContext = [{ kind: 'fan_out', stepRunId: 'sr-f', itemIndex: 1 }];
    const instances = [{ nodeId: 'a', branchContext: sajatAg, output: 'első elem' }];

    expect(resolveStepReference(FAN_OUT, instances, { nodeId: 'b', branchContext: sajatAg }, 'a')).toStrictEqual({
      kind: 'ok',
      value: 'első elem',
    });
  });
});
