/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { findLoopBackEdges } from '../run-graph/find-loop-back-edges.ts';
import { validateScopeBalance } from './validate-scope-balance.ts';

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

// A visszaél halmazt a hívó adja át (SPEC-004 4.6, a validációs sorrend első
// lépése), ezért a ciklus nélküli eseteknél az üres halmaz a bemenet.
const NO_BACK_EDGES: ReadonlySet<string> = new Set();

describe('validateScopeBalance', () => {
  it('lineáris gráfon minden node a gyökér kontextusban áll, a párosítás üres', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step'), node('vege', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'vege')],
    );

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'ok',
      value: { joinToFanOut: new Map() },
    });
  });

  it('azonos veremmel visszatalálkozó két ág rendben van', () => {
    const graph = graphOf(
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

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'ok',
      value: { joinToFanOut: new Map() },
    });
  });

  it('a join node párját a bejárás mellékterméke adja', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('f', 'fan_out'),
        node('a', 'agent_step'),
        node('j', 'join'),
        node('vege', 'agent_step'),
      ],
      [edge('e1', 'start', 'f'), edge('e2', 'f', 'a'), edge('e3', 'a', 'j'), edge('e4', 'j', 'vege')],
    );

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'ok',
      value: { joinToFanOut: new Map([['j', 'f']]) },
    });
  });

  it('egymásba ágyazott fan_out hatókörök mindegyik join párját megnevezi', () => {
    const graph = graphOf(
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

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'ok',
      value: {
        joinToFanOut: new Map([
          ['j-belso', 'belso'],
          ['j-kulso', 'kulso'],
        ]),
      },
    });
  });

  it('a fan_out on_error éle a külső veremben marad, ezért a hibaág visszatalálkozhat', () => {
    const graph = graphOf(
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

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'ok',
      value: { joinToFanOut: new Map([['j', 'f']]) },
    });
  });

  it('nem létező node-ra mutató él nem borítja fel a bejárást', () => {
    const graph = graphOf(
      [node('start', 'start'), node('a', 'agent_step')],
      [edge('e1', 'start', 'a'), edge('e2', 'a', 'nincs-ilyen-node')],
    );

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'ok',
      value: { joinToFanOut: new Map() },
    });
  });

  it('egymásba ágyazott fan_out és loop hatókör szabályos zárását elfogadja', () => {
    const graph = graphOf(
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

    // A `torzs` node egyetlen kimenő éle a visszaél, tehát a visszaél nélküli
    // gráfban terminálisnak látszik, nyitott `fan_out` kerettel. Mégsem
    // kiegyensúlyozatlan: a visszaél futásidőben valódi folytatás.
    expect(validateScopeBalance(graph, 'start', findLoopBackEdges(graph))).toStrictEqual({
      kind: 'ok',
      value: { joinToFanOut: new Map([['j', 'f']]) },
    });
  });

  it('nyitott fan_out hatókör nélkül elért join node kiegyensúlyozatlan', () => {
    const graph = graphOf(
      [node('start', 'start'), node('b', 'branch'), node('j', 'join')],
      [edge('e1', 'start', 'b'), edge('e2', 'b', 'j', 'bal')],
    );

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'error',
      message: 'A(z) j join node hatókör vermének tetején nem fan_out bejegyzés áll (unbalanced_fan_out_scope).',
    });
  });

  it('loop hatókörben álló join node kiegyensúlyozatlan', () => {
    const graph = graphOf(
      [node('start', 'start'), node('l', 'loop'), node('j', 'join'), node('vege', 'agent_step')],
      [edge('e1', 'start', 'l'), edge('e2', 'l', 'j', 'continue'), edge('e3', 'l', 'vege', 'exit')],
    );

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'error',
      message: 'A(z) j join node hatókör vermének tetején nem fan_out bejegyzés áll (unbalanced_fan_out_scope).',
    });
  });

  it('két különböző mélységű út ugyanahhoz a node-hoz kiegyensúlyozatlan', () => {
    const graph = graphOf(
      [node('start', 'start'), node('b', 'branch'), node('f', 'fan_out'), node('x', 'agent_step')],
      [edge('e1', 'start', 'b'), edge('e2', 'b', 'x', 'bal'), edge('e3', 'b', 'f', 'jobb'), edge('e4', 'f', 'x')],
    );

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'error',
      message: 'A(z) x node két különböző hatókör veremmel érhető el a start node-ból (unbalanced_fan_out_scope).',
    });
  });

  it('azonos mély, de más fan_out node-tól származó két út kiegyensúlyozatlan', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('b', 'branch'),
        node('f1', 'fan_out'),
        node('f2', 'fan_out'),
        node('x', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'b'),
        edge('e2', 'b', 'f1', 'bal'),
        edge('e3', 'b', 'f2', 'jobb'),
        edge('e4', 'f1', 'x'),
        edge('e5', 'f2', 'x'),
      ],
    );

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'error',
      message: 'A(z) x node két különböző hatókör veremmel érhető el a start node-ból (unbalanced_fan_out_scope).',
    });
  });

  it('terminális node-ig nyitva maradó fan_out hatókör kiegyensúlyozatlan', () => {
    const graph = graphOf(
      [node('start', 'start'), node('f', 'fan_out'), node('a', 'agent_step')],
      [edge('e1', 'start', 'f'), edge('e2', 'f', 'a')],
    );

    expect(validateScopeBalance(graph, 'start', NO_BACK_EDGES)).toStrictEqual({
      kind: 'error',
      message: 'A(z) a terminális node-ig nyitva marad egy fan_out hatókör (unbalanced_fan_out_scope).',
    });
  });
});
