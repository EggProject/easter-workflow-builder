/* eslint-disable unicorn/no-null -- a `SnapshotEdge` `sourceHandle`/`targetHandle`/`branchKey` mezője a tárolt alak valódi hiány értéke (SPEC-003 5.1), nem helyőrző */
import { describe, expect, it } from 'vitest';
import type { SnapshotEdge } from '@easter-workflow-builder/db';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { resolveErrorRoute } from './resolve-error-route.ts';

function edge(id: string, sourceNodeId: string, targetNodeId: string, branchKey: string | null): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey };
}

function graphOf(edges: readonly SnapshotEdge[]): ExecutableGraph {
  const outgoingEdges = new Map<string, readonly SnapshotEdge[]>();
  for (const item of edges) {
    outgoingEdges.set(item.sourceNodeId, [...(outgoingEdges.get(item.sourceNodeId) ?? []), item]);
  }
  return { nodesById: new Map(), outgoingEdges, incomingEdges: new Map() };
}

describe('resolveErrorRoute', () => {
  it('on_error él esetén kezelt, és csak az on_error él azonosítója live', () => {
    const graph = graphOf([edge('e1', 'a', 'next', null), edge('e2', 'a', 'handler', 'on_error')]);

    expect(
      resolveErrorRoute({ graph, nodeId: 'a', escapeKey: 'on_error', onUnhandledError: 'fail_run' }),
    ).toStrictEqual({
      kind: 'handled',
      liveEdgeIds: new Set(['e2']),
    });
  });

  it('több on_error él esetén mindegyik live', () => {
    const graph = graphOf([edge('e1', 'a', 'h1', 'on_error'), edge('e2', 'a', 'h2', 'on_error')]);

    expect(
      resolveErrorRoute({ graph, nodeId: 'a', escapeKey: 'on_error', onUnhandledError: 'fail_branch' }),
    ).toStrictEqual({ kind: 'handled', liveEdgeIds: new Set(['e1', 'e2']) });
  });

  it('exhausted kulcsra az error_handler exhausted élét választja, az on_error élt nem', () => {
    const graph = graphOf([edge('e1', 'eh', 'vege', 'exhausted'), edge('e2', 'eh', 'masik', 'on_error')]);

    expect(
      resolveErrorRoute({ graph, nodeId: 'eh', escapeKey: 'exhausted', onUnhandledError: 'fail_run' }),
    ).toStrictEqual({ kind: 'handled', liveEdgeIds: new Set(['e1']) });
  });

  it('menekülő él nélkül a fail_run politikát adja vissza', () => {
    const graph = graphOf([edge('e1', 'a', 'next', null)]);

    expect(
      resolveErrorRoute({ graph, nodeId: 'a', escapeKey: 'on_error', onUnhandledError: 'fail_run' }),
    ).toStrictEqual({ kind: 'fail_run' });
  });

  it('menekülő él nélkül a fail_branch politikát adja vissza', () => {
    const graph = graphOf([edge('e1', 'a', 'next', null)]);

    expect(
      resolveErrorRoute({ graph, nodeId: 'a', escapeKey: 'on_error', onUnhandledError: 'fail_branch' }),
    ).toStrictEqual({ kind: 'fail_branch' });
  });

  it('kimenő él nélküli node-ra is a politika dönt', () => {
    const graph = graphOf([]);

    expect(
      resolveErrorRoute({ graph, nodeId: 'magaban', escapeKey: 'on_error', onUnhandledError: 'fail_branch' }),
    ).toStrictEqual({ kind: 'fail_branch' });
  });
});
