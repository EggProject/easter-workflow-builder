/* eslint-disable unicorn/no-null -- a WorkflowNodeRecord/WorkflowEdgeRecord több mezője valódi `T | null`, a tesztfixtúrák ezt a tárolt null értéket adják, nem helyőrzőt (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import type { WorkflowGraph } from '@easter-workflow-builder/db';
import { toWorkflowGraphDocument } from './to-workflow-graph-document.ts';

describe('toWorkflowGraphDocument', () => {
  it('a node és él Date mezőit egész milliszekundummá alakítja', () => {
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: 'n1',
          type: 'start',
          label: 'Start',
          positionX: 10,
          positionY: 20,
          config: { type: 'start', inputFields: [], onUnhandledError: null },
          createdAtMs: new Date(100),
          updatedAtMs: new Date(200),
        },
      ],
      edges: [
        {
          id: 'e1',
          sourceNodeId: 'n1',
          targetNodeId: 'n2',
          sourceHandle: null,
          targetHandle: null,
          branchKey: null,
          createdAtMs: new Date(300),
        },
      ],
    };

    expect(toWorkflowGraphDocument(graph)).toStrictEqual({
      nodes: [
        {
          id: 'n1',
          type: 'start',
          label: 'Start',
          positionX: 10,
          positionY: 20,
          config: { type: 'start', inputFields: [], onUnhandledError: null },
          createdAtMs: 100,
          updatedAtMs: 200,
        },
      ],
      edges: [
        {
          id: 'e1',
          sourceNodeId: 'n1',
          targetNodeId: 'n2',
          sourceHandle: null,
          targetHandle: null,
          branchKey: null,
          createdAtMs: 300,
        },
      ],
    });
  });

  it('üres gráfra üres listákat ad', () => {
    expect(toWorkflowGraphDocument({ nodes: [], edges: [] })).toStrictEqual({ nodes: [], edges: [] });
  });
});
