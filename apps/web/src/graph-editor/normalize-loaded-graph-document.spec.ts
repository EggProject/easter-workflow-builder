/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createGraphNode } from './create-graph-node.ts';
import { normalizeLoadedGraphDocument } from './normalize-loaded-graph-document.ts';

const START_NODE: WorkflowNodeInput = {
  id: 'n-start',
  type: 'start',
  label: 'Indítás',
  positionX: -300,
  positionY: 40,
  config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
};

const BRANCH_NODE: WorkflowNodeInput = {
  id: 'n-branch',
  type: 'branch',
  label: 'Döntés',
  positionX: 200,
  positionY: 0,
  config: {
    type: 'branch',
    expression: 'input.kind',
    branches: [{ key: 'igen', label: 'Igen' }],
    defaultBranchKey: 'igen',
    onUnhandledError: null,
  },
};

const SCRIPT_NODE = createGraphNode('script', { x: 500, y: 0 }, () => 'n-script');

function edge(id: string, sourceNodeId: string, branchKey: string | null): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId: 'n-script', sourceHandle: branchKey, targetHandle: null, branchKey };
}

const KEYLESS_BRANCH_EDGE = edge('e-regi', 'n-branch', null);
const KEYED_BRANCH_EDGE = edge('e-igen', 'n-branch', 'igen');
const START_EDGE = edge('e-start', 'n-start', null);

describe('normalizeLoadedGraphDocument', () => {
  it('a Startot tartalmazó gráfból csak a branch forrású, kulcs nélküli élt hagyja el, a csomópontokat nem változtatja', () => {
    const generateId = vi.fn(() => 'nem-hivhato');
    const nodes = [START_NODE, BRANCH_NODE, SCRIPT_NODE];
    const normalized = normalizeLoadedGraphDocument(
      { nodes, edges: [START_EDGE, KEYLESS_BRANCH_EDGE, KEYED_BRANCH_EDGE] },
      generateId,
    );
    expect(normalized.nodes).toBe(nodes);
    expect(normalized.edges).toEqual([START_EDGE, KEYED_BRANCH_EDGE]);
    expect(generateId).not.toHaveBeenCalled();
  });

  it('két Start mellett sem vesz fel harmadikat', () => {
    const nodes = [START_NODE, { ...START_NODE, id: 'n-start-2' }];
    expect(normalizeLoadedGraphDocument({ nodes, edges: [] }, () => 'nem-hivhato').nodes).toBe(nodes);
  });

  it('Start nélküli gráfba pontosan egy Startot vesz fel a lista végére, az 5.8 szerinti alakkal', () => {
    const generateId = vi.fn(() => 'generalt-start');
    const normalized = normalizeLoadedGraphDocument(
      { nodes: [BRANCH_NODE, SCRIPT_NODE], edges: [KEYLESS_BRANCH_EDGE, KEYED_BRANCH_EDGE] },
      generateId,
    );
    expect(normalized).toEqual({
      nodes: [
        BRANCH_NODE,
        SCRIPT_NODE,
        {
          id: 'generalt-start',
          type: 'start',
          label: '',
          positionX: 0,
          positionY: 0,
          config: { type: 'start', inputFields: [], onUnhandledError: null },
        },
      ],
      edges: [KEYED_BRANCH_EDGE],
    });
    expect(generateId).toHaveBeenCalledTimes(1);
  });

  it('üres gráfba is egy Startot vesz fel', () => {
    expect(normalizeLoadedGraphDocument({ nodes: [], edges: [] }, () => 's').nodes.map((node) => node.type)).toEqual([
      'start',
    ]);
  });
});
