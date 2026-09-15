/* eslint-disable unicorn/no-null -- a WorkflowEdgeInput nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import type { Edge } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { flowEdgeToWorkflowEdge, workflowEdgeToFlowEdge } from './graph-editor-edge-mapping.ts';

describe('workflowEdgeToFlowEdge', () => {
  it('a mezőket egy az egyben a vászon Edge alakjára viszi', () => {
    expect(
      workflowEdgeToFlowEdge({
        id: 'e-1',
        sourceNodeId: 'a',
        targetNodeId: 'b',
        sourceHandle: 'continue',
        targetHandle: null,
        branchKey: 'continue',
      }),
    ).toEqual({ id: 'e-1', source: 'a', target: 'b', sourceHandle: 'continue', targetHandle: null });
  });
});

describe('flowEdgeToWorkflowEdge', () => {
  // A hat fenntartott branchKey érték (SPEC-003 7.2, SPEC-004 4.2, M-88):
  // az onConnect a Connection.sourceHandle értékéből tölti ki a branchKey-t,
  // és ez a leképezés a mentés előtti utolsó lépés, ahol ez ténylegesen
  // megtörténik (AC10).
  const RESERVED_BRANCH_KEYS = ['continue', 'exit', 'approved', 'rejected', 'exhausted', 'on_error'] as const;

  it.each(RESERVED_BRANCH_KEYS)('a "%s" sourceHandle a branchKey mezőt is ugyanerre tölti', (branchKey) => {
    const flowEdge: Edge = { id: 'e-1', source: 'a', target: 'b', sourceHandle: branchKey, targetHandle: null };
    const workflowEdge = flowEdgeToWorkflowEdge(flowEdge);
    expect(workflowEdge.sourceHandle).toBe(branchKey);
    expect(workflowEdge.branchKey).toBe(branchKey);
  });

  it('a hiányzó (undefined) sourceHandle a dróton null branchKey-t ad', () => {
    const flowEdge: Edge = { id: 'e-1', source: 'a', target: 'b' };
    const workflowEdge = flowEdgeToWorkflowEdge(flowEdge);
    expect(workflowEdge.sourceHandle).toBeNull();
    expect(workflowEdge.branchKey).toBeNull();
    expect(workflowEdge.targetHandle).toBeNull();
  });

  it('a workflowEdgeToFlowEdge majd flowEdgeToWorkflowEdge kör-út megőrzi a branchKey-t', () => {
    const original = {
      id: 'e-2',
      sourceNodeId: 'x',
      targetNodeId: 'y',
      sourceHandle: 'exit',
      targetHandle: null,
      branchKey: 'exit',
    };
    expect(flowEdgeToWorkflowEdge(workflowEdgeToFlowEdge(original))).toEqual(original);
  });
});
