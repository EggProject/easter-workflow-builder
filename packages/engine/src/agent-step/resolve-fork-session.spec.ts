/* eslint-disable unicorn/no-null -- a `SnapshotEdge` nullázható mezői (`sourceHandle`, `targetHandle`, `branchKey`) és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { resolveForkSession } from './resolve-fork-session.ts';
import type { SessionSourceNodes } from './session-source-nodes.ts';

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

function sources(sourceNodeIds: readonly string[], continuedNodeIds: readonly string[]): SessionSourceNodes {
  return { sourceNodeIds: new Set(sourceNodeIds), continuedNodeIds: new Set(continuedNodeIds) };
}

describe('resolveForkSession', () => {
  it('nincs session forrás ős: nincs mit forkolni', () => {
    const graph = graphOf([node('start', 'start'), node('a', 'agent_step')], [edge('e1', 'start', 'a')]);

    expect(resolveForkSession(graph, sources(['a'], ['a']), 'a')).toBe(false);
  });

  it('lineáris lánc egyetlen folytatóval: nincs fork', () => {
    const graph = graphOf(
      [node('start', 'start'), node('s', 'agent_step'), node('a', 'agent_step')],
      [edge('e1', 'start', 's'), edge('e2', 's', 'a')],
    );

    expect(resolveForkSession(graph, sources(['s', 'a'], ['a']), 'a')).toBe(false);
  });

  it('1. feltétel: a continued lépés a forráshoz képest fan_out hatókörön belül van', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('s', 'agent_step'),
        node('f', 'fan_out'),
        node('a', 'agent_step'),
        node('j', 'join'),
      ],
      [edge('e1', 'start', 's'), edge('e2', 's', 'f'), edge('e3', 'f', 'a'), edge('e4', 'a', 'j')],
    );

    expect(resolveForkSession(graph, sources(['s', 'a'], ['a']), 'a')).toBe(true);
  });

  it('1. feltétel a forráshoz képest mérendő: a fan_out hatókörön belüli forrás után nincs fork', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('s', 'agent_step'),
        node('f', 'fan_out'),
        node('m', 'agent_step'),
        node('a', 'agent_step'),
        node('j', 'join'),
      ],
      [
        edge('e1', 'start', 's'),
        edge('e2', 's', 'f'),
        edge('e3', 'f', 'm'),
        edge('e4', 'm', 'a'),
        edge('e5', 'a', 'j'),
      ],
    );

    expect(resolveForkSession(graph, sources(['s', 'm', 'a'], ['a']), 'a')).toBe(false);
  });

  it('a fan_out on_error éle nem nyit hatókört, tehát nem okoz forkot', () => {
    const graph = graphOf(
      [node('start', 'start'), node('s', 'agent_step'), node('f', 'fan_out'), node('a', 'agent_step')],
      [edge('e1', 'start', 's'), edge('e2', 's', 'f'), edge('e3', 'f', 'a', 'on_error')],
    );

    expect(resolveForkSession(graph, sources(['s', 'a'], ['a']), 'a')).toBe(false);
  });

  it('a join a hatókört lezárja, tehát a join utáni continued lépés nem forkol', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('s', 'agent_step'),
        node('f', 'fan_out'),
        node('k', 'human_approval'),
        node('j', 'join'),
        node('a', 'agent_step'),
      ],
      [
        edge('e1', 'start', 's'),
        edge('e2', 's', 'f'),
        edge('e3', 'f', 'k'),
        edge('e4', 'k', 'j'),
        edge('e5', 'j', 'a'),
      ],
    );

    expect(resolveForkSession(graph, sources(['s', 'a'], ['a']), 'a')).toBe(false);
  });

  it('2. feltétel: a forrásból két különböző continued lépés érhető el', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('s', 'agent_step'),
        node('b', 'branch'),
        node('x', 'agent_step'),
        node('y', 'agent_step'),
      ],
      [edge('e1', 'start', 's'), edge('e2', 's', 'b'), edge('e3', 'b', 'x', 'bal'), edge('e4', 'b', 'y', 'jobb')],
    );

    expect(resolveForkSession(graph, sources(['s', 'x', 'y'], ['x', 'y']), 'x')).toBe(true);
  });

  it('2. feltétel: két út ugyanahhoz az egy continued lépéshez nem forkol', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('s', 'agent_step'),
        node('p', 'human_approval'),
        node('q', 'human_approval'),
        node('a', 'agent_step'),
      ],
      [
        edge('e1', 'start', 's'),
        edge('e2', 's', 'p'),
        edge('e3', 's', 'q'),
        edge('e4', 'p', 'a'),
        edge('e5', 'q', 'a'),
      ],
    );

    expect(resolveForkSession(graph, sources(['s', 'a'], ['a']), 'a')).toBe(false);
  });

  it('2. feltétel: a forrásból elért isolated lépés nem számít folytatónak', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('s', 'agent_step'),
        node('b', 'branch'),
        node('m', 'agent_step'),
        node('a', 'agent_step'),
      ],
      [edge('e1', 'start', 's'), edge('e2', 's', 'b'), edge('e3', 'b', 'm', 'bal'), edge('e4', 'b', 'a', 'jobb')],
    );

    expect(resolveForkSession(graph, sources(['s', 'm', 'a'], ['a']), 'a')).toBe(false);
  });

  it('több legközelebbi forrás esetén bármelyik elég a forkhoz', () => {
    const graph = graphOf(
      [
        node('start', 'start'),
        node('b', 'branch'),
        node('s1', 'agent_step'),
        node('s2', 'agent_step'),
        node('z', 'agent_step'),
        node('a', 'agent_step'),
      ],
      [
        edge('e1', 'start', 'b'),
        edge('e2', 'b', 's1', 'bal'),
        edge('e3', 'b', 's2', 'jobb'),
        edge('e4', 's1', 'a'),
        edge('e5', 's2', 'a'),
        edge('e6', 's2', 'z'),
      ],
    );

    expect(resolveForkSession(graph, sources(['s1', 's2', 'z', 'a'], ['z', 'a']), 'a')).toBe(true);
  });

  it('a loop visszaéle nem okoz végtelen bejárást', () => {
    const graph = graphOf(
      [node('start', 'start'), node('s', 'agent_step'), node('l', 'loop'), node('a', 'agent_step')],
      [edge('e1', 'start', 's'), edge('e2', 's', 'l'), edge('e3', 'l', 'a', 'continue'), edge('e4', 'a', 'l')],
    );

    expect(resolveForkSession(graph, sources(['s', 'a'], ['a']), 'a')).toBe(false);
  });

  it('nem létező node-ra mutató él nem akasztja meg a bejárást', () => {
    const graph = graphOf(
      [node('start', 'start'), node('s', 'agent_step'), node('a', 'agent_step')],
      [edge('e1', 'start', 's'), edge('e2', 's', 'nincs-ilyen'), edge('e3', 's', 'a')],
    );

    expect(resolveForkSession(graph, sources(['s', 'a'], ['a']), 'a')).toBe(false);
  });
});
