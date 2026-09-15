/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNode/WorkflowEdge fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import type { WorkflowEdge, WorkflowNode } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { workflowEdgeToEdgeInput, workflowNodeToNodeInput } from './graph-editor-document-projection.ts';

describe('workflowNodeToNodeInput', () => {
  it('levágja a createdAtMs és updatedAtMs mezőt, a többit megőrzi', () => {
    const node: WorkflowNode = {
      id: 'n-1',
      type: 'start',
      label: 'Indítás',
      positionX: 1,
      positionY: 2,
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      createdAtMs: 1000,
      updatedAtMs: 2000,
    };
    expect(workflowNodeToNodeInput(node)).toEqual({
      id: 'n-1',
      type: 'start',
      label: 'Indítás',
      positionX: 1,
      positionY: 2,
      config: { type: 'start', inputFields: [], onUnhandledError: null },
    });
  });
});

describe('workflowEdgeToEdgeInput', () => {
  it('levágja a createdAtMs mezőt, a többit megőrzi', () => {
    const edge: WorkflowEdge = {
      id: 'e-1',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceHandle: 'continue',
      targetHandle: null,
      branchKey: 'continue',
      createdAtMs: 1000,
    };
    expect(workflowEdgeToEdgeInput(edge)).toEqual({
      id: 'e-1',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceHandle: 'continue',
      targetHandle: null,
      branchKey: 'continue',
    });
  });
});
