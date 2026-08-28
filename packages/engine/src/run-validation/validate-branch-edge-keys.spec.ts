/* eslint-disable unicorn/no-null -- a node config és a `SnapshotEdge` nullázható mezői a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 4.3, 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';
import { validateBranchEdgeKeys } from './validate-branch-edge-keys.ts';

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

const BRANCH: ExecutableNodeConfig = {
  type: 'branch',
  expression: 'ertek',
  branches: [
    { key: 'bal', label: 'Bal' },
    { key: 'jobb', label: 'Jobb' },
  ],
  defaultBranchKey: null,
  onUnhandledError: 'fail_run',
};

const START: ExecutableNodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };

const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
  ['start', START],
  ['b', BRANCH],
]);

const nodes: readonly SnapshotNode[] = [
  node('start', 'start'),
  node('b', 'branch'),
  node('x', 'agent_step'),
  node('y', 'agent_step'),
  node('h', 'error_handler'),
];

describe('validateBranchEdgeKeys', () => {
  it('a branches listában szereplő kulcsokra zöld', () => {
    const graph = graphOf(nodes, [edge('e1', 'start', 'b'), edge('e2', 'b', 'x', 'bal'), edge('e3', 'b', 'y', 'jobb')]);

    expect(validateBranchEdgeKeys(graph, configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('a branch node on_error élét nem a branches lista ellen méri', () => {
    const graph = graphOf(nodes, [edge('e2', 'b', 'x', 'bal'), edge('e3', 'b', 'h', 'on_error')]);

    expect(validateBranchEdgeKeys(graph, configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('kimenő él nélküli branch node-ra zöld', () => {
    expect(validateBranchEdgeKeys(graphOf(nodes, []), configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('ismeretlen branch_key értékre branch_key_unknown hibát ad', () => {
    const graph = graphOf(nodes, [edge('e2', 'b', 'x', 'kozepe')]);

    expect(validateBranchEdgeKeys(graph, configsById)).toStrictEqual({
      kind: 'error',
      message:
        'A(z) b branch node e2 élének branch_key értékét (kozepe) a branches lista nem tartalmazza (branch_key_unknown).',
    });
  });

  it('kulcs nélküli branch élre branch_key_unknown hibát ad', () => {
    const graph = graphOf(nodes, [edge('e2', 'b', 'x')]);

    expect(validateBranchEdgeKeys(graph, configsById)).toStrictEqual({
      kind: 'error',
      message:
        'A(z) b branch node e2 élének branch_key értékét (nincs kulcs) a branches lista nem tartalmazza (branch_key_unknown).',
    });
  });
});
