/* eslint-disable unicorn/no-null -- a node config nullázható mezői és a `SnapshotWorkflow.description` a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 4.3, 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { NodeType, SnapshotNode } from '@easter-workflow-builder/db';
import { buildExecutableGraph } from '../run-graph/build-executable-graph.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import { validateNodeConfigs } from './validate-node-configs.ts';

function node(id: string, type: NodeType, config: unknown): SnapshotNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config, effectiveProviderId: 'minimax' };
}

function graphOf(nodes: readonly SnapshotNode[]): ExecutableGraph {
  return buildExecutableGraph({
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: 'wf', name: 'teszt', description: null },
    nodes,
    edges: [],
  });
}

const startConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
const branchConfig = {
  type: 'branch',
  expression: 'ertek',
  branches: [{ key: 'bal', label: 'Bal' }],
  defaultBranchKey: null,
  onUnhandledError: 'fail_run',
};

describe('validateNodeConfigs', () => {
  it('érvényes configokat node azonosító szerint adja vissza', () => {
    const graph = graphOf([node('start', 'start', startConfig), node('b', 'branch', branchConfig)]);

    expect(validateNodeConfigs(graph)).toStrictEqual({
      kind: 'ok',
      value: new Map<string, unknown>([
        ['start', startConfig],
        ['b', branchConfig],
      ]),
    });
  });

  it('nem node config alakú értékre malformed_node_config hibát ad', () => {
    const graph = graphOf([node('start', 'start', { type: 'start' })]);

    expect(validateNodeConfigs(graph)).toStrictEqual({
      kind: 'error',
      message: 'A(z) start node configja nem érvényes node config (malformed_node_config).',
    });
  });

  it('a node típusától eltérő configra malformed_node_config hibát ad', () => {
    const graph = graphOf([node('b', 'branch', startConfig)]);

    expect(validateNodeConfigs(graph)).toStrictEqual({
      kind: 'error',
      message: 'A(z) b node típusa branch, a configjáé viszont start (malformed_node_config).',
    });
  });

  it('node nélküli gráfra üres térképet ad', () => {
    expect(validateNodeConfigs(graphOf([]))).toStrictEqual({ kind: 'ok', value: new Map() });
  });
});
