/* eslint-disable unicorn/no-null -- a `WorkflowRecord`, a `WorkflowEdgeRecord` és a node configok nullázható mezői (SPEC-003 4.1, 4.3, 4.7) valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { WorkflowGraph, WorkflowRecord } from '@easter-workflow-builder/db';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import { buildSnapshotDocument } from './build-snapshot-document.ts';

const WORKFLOW: WorkflowRecord = {
  id: 'wf-1',
  name: 'Teszt workflow',
  description: 'leírás',
  providerId: null,
  createdAtMs: new Date(0),
  updatedAtMs: new Date(0),
};

const GRAPH: WorkflowGraph = {
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'Indulás',
      positionX: 10,
      positionY: 20,
      config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
      createdAtMs: new Date(0),
      updatedAtMs: new Date(0),
    },
    {
      id: 'ag',
      type: 'agent_step',
      label: 'Agent',
      positionX: 30,
      positionY: 40,
      config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
      createdAtMs: new Date(0),
      updatedAtMs: new Date(0),
    },
  ],
  edges: [
    {
      id: 'e1',
      sourceNodeId: 'start',
      targetNodeId: 'ag',
      sourceHandle: 'ki',
      targetHandle: null,
      branchKey: null,
      createdAtMs: new Date(0),
    },
  ],
};

const FALLBACK: ProviderId = 'minimax';

describe('buildSnapshotDocument', () => {
  it('a workflow fejlécét, a node-okat és az éleket mezőnként másolja', () => {
    const document = buildSnapshotDocument({
      workflow: WORKFLOW,
      graph: GRAPH,
      sdkVersionPin: '0.0.0-teszt',
      providerByNodeId: new Map(),
      fallbackProviderId: FALLBACK,
    });

    expect(document.version).toBe(1);
    expect(document.sdkVersionPin).toBe('0.0.0-teszt');
    expect(document.workflow).toStrictEqual({ id: 'wf-1', name: 'Teszt workflow', description: 'leírás' });
    expect(document.nodes[0]?.position).toStrictEqual({ x: 10, y: 20 });
    expect(document.nodes[0]?.label).toBe('Indulás');
    expect(document.edges).toStrictEqual([
      { id: 'e1', sourceNodeId: 'start', targetNodeId: 'ag', sourceHandle: 'ki', targetHandle: null, branchKey: null },
    ]);
  });

  it('a térképben nem szereplő node a visszaesés providerét kapja, a többi a sajátját', () => {
    const document = buildSnapshotDocument({
      workflow: WORKFLOW,
      graph: GRAPH,
      sdkVersionPin: '0.0.0-teszt',
      providerByNodeId: new Map<string, ProviderId>([['ag', 'claude-subscription']]),
      fallbackProviderId: FALLBACK,
    });

    expect(document.nodes.map((node) => node.effectiveProviderId)).toStrictEqual(['minimax', 'claude-subscription']);
  });

  it('a node configot változatlanul viszi át (a SnapshotNode.config unknown marad)', () => {
    const document = buildSnapshotDocument({
      workflow: WORKFLOW,
      graph: GRAPH,
      sdkVersionPin: '0.0.0-teszt',
      providerByNodeId: new Map(),
      fallbackProviderId: FALLBACK,
    });

    expect(document.nodes[0]?.config).toBe(GRAPH.nodes[0]?.config);
  });

  it('nem vesz fel futásonként változó mezőt: a kimenet mezőkészlete rögzített', () => {
    const document = buildSnapshotDocument({
      workflow: WORKFLOW,
      graph: GRAPH,
      sdkVersionPin: '0.0.0-teszt',
      providerByNodeId: new Map(),
      fallbackProviderId: FALLBACK,
    });

    expect(Object.keys(document)).toStrictEqual(['version', 'sdkVersionPin', 'workflow', 'nodes', 'edges']);
  });
});
