/* eslint-disable unicorn/no-null -- a WorkflowEdge nullázható mezői (sourceHandle, targetHandle, branchKey) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import {
  ReplaceGraphRequestSchema,
  WorkflowEdgeInputSchema,
  WorkflowEdgeSchema,
  WorkflowGraphDocumentSchema,
  WorkflowNodeInputSchema,
  WorkflowNodeSchema,
} from './workflow-graph-document.ts';

const VALID_NODE = {
  id: 'node-1',
  type: 'start',
  label: 'Start',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: null },
};

const VALID_EDGE = {
  id: 'edge-1',
  sourceNodeId: 'node-1',
  targetNodeId: 'node-2',
  sourceHandle: null,
  targetHandle: null,
  branchKey: null,
};

describe('WorkflowNodeInputSchema', () => {
  it('elfogadja az érvényes node bemenetet, a NodeConfigSchema szerint érvényes config alakkal', () => {
    expect(WorkflowNodeInputSchema.safeParse(VALID_NODE).success).toBe(true);
  });

  it('elutasítja az érvénytelen node típust', () => {
    expect(WorkflowNodeInputSchema.safeParse({ ...VALID_NODE, type: 'unknown' }).success).toBe(false);
  });

  it('elutasítja az ismeretlen kulcsot (15. kritérium)', () => {
    expect(WorkflowNodeInputSchema.safeParse({ ...VALID_NODE, extra: 1 }).success).toBe(false);
  });
});

describe('WorkflowNodeSchema', () => {
  it('elfogadja az időbélyeggel kiegészített rekordot', () => {
    const outcome = WorkflowNodeSchema.safeParse({ ...VALID_NODE, createdAtMs: 1, updatedAtMs: 2 });
    expect(outcome.success).toBe(true);
  });
});

describe('WorkflowEdgeInputSchema és WorkflowEdgeSchema', () => {
  it('elfogadja az érvényes él bemenetet', () => {
    expect(WorkflowEdgeInputSchema.safeParse(VALID_EDGE).success).toBe(true);
  });

  it('elutasítja az ismeretlen kulcsot (15. kritérium)', () => {
    expect(WorkflowEdgeInputSchema.safeParse({ ...VALID_EDGE, extra: 1 }).success).toBe(false);
  });

  it('elfogadja az időbélyeggel kiegészített él rekordot', () => {
    expect(WorkflowEdgeSchema.safeParse({ ...VALID_EDGE, createdAtMs: 1 }).success).toBe(true);
  });
});

describe('WorkflowGraphDocumentSchema', () => {
  it('elfogadja a node és él listát', () => {
    const outcome = WorkflowGraphDocumentSchema.safeParse({
      nodes: [{ ...VALID_NODE, createdAtMs: 1, updatedAtMs: 2 }],
      edges: [{ ...VALID_EDGE, createdAtMs: 1 }],
    });
    expect(outcome.success).toBe(true);
  });
});

describe('ReplaceGraphRequestSchema', () => {
  it('elfogadja a teljes node és él listát', () => {
    const outcome = ReplaceGraphRequestSchema.safeParse({ nodes: [VALID_NODE], edges: [VALID_EDGE] });
    expect(outcome.success).toBe(true);
  });

  it('elfogadja az üres listákat is (teljes csere, nulla elem)', () => {
    expect(ReplaceGraphRequestSchema.safeParse({ nodes: [], edges: [] }).success).toBe(true);
  });

  it('elutasítja az ismeretlen kulcsot (15. kritérium)', () => {
    expect(ReplaceGraphRequestSchema.safeParse({ nodes: [], edges: [], extra: 1 }).success).toBe(false);
  });
});
