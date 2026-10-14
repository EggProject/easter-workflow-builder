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
  config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
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
  it('elfogadja az érvényes node bemenetet, a mentési séma szerint érvényes config alakkal', () => {
    expect(WorkflowNodeInputSchema.safeParse(VALID_NODE).success).toBe(true);
  });

  it('elutasítja az érvénytelen node típust', () => {
    expect(WorkflowNodeInputSchema.safeParse({ ...VALID_NODE, type: 'unknown' }).success).toBe(false);
  });

  it('elutasítja az ismeretlen kulcsot (15. kritérium)', () => {
    expect(WorkflowNodeInputSchema.safeParse({ ...VALID_NODE, extra: 1 }).success).toBe(false);
  });
});

/**
 * Egy üres kötelező szöveg mezőt hordozó csomópont (SPEC-008 5.4, O-21): a
 * `branch` első ágának kulcsa üres. A mentési sémán elbukik, az olvasó
 * sémákon átmegy.
 */
const NODE_WITH_BLANK_REQUIRED_FIELD = {
  id: 'node-branch',
  type: 'branch',
  label: 'Elágazás',
  positionX: 0,
  positionY: 0,
  config: {
    type: 'branch',
    expression: 'x > 0',
    branches: [{ key: '', label: 'Pozitív' }],
    defaultBranchKey: null,
    onUnhandledError: 'fail_run',
  },
};

describe('WorkflowNodeInputSchema a mentési sémán áll (SPEC-008 5.4, O-21)', () => {
  it('üres kötelező szöveg mezőre a config mezőútvonalán bukik', () => {
    const outcome = WorkflowNodeInputSchema.safeParse(NODE_WITH_BLANK_REQUIRED_FIELD);

    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.error.issues.map((issue) => issue.path.join('.'))).toEqual(['config.branches.0.key']);
    }
  });
});

describe('WorkflowNodeSchema', () => {
  it('elfogadja az időbélyeggel kiegészített rekordot', () => {
    const outcome = WorkflowNodeSchema.safeParse({ ...VALID_NODE, createdAtMs: 1, updatedAtMs: 2 });
    expect(outcome.success).toBe(true);
  });

  it('az üres kötelező szöveg mezőt elfogadja (az olvasó séma nem szigorodik)', () => {
    const outcome = WorkflowNodeSchema.safeParse({ ...NODE_WITH_BLANK_REQUIRED_FIELD, createdAtMs: 1, updatedAtMs: 2 });
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

  it('egy üres kötelező szöveg mezőt hordozó régi gráfot elfogad (az olvasó séma nem szigorodik)', () => {
    const outcome = WorkflowGraphDocumentSchema.safeParse({
      nodes: [{ ...NODE_WITH_BLANK_REQUIRED_FIELD, createdAtMs: 1, updatedAtMs: 2 }],
      edges: [],
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

  it('elutasítja, ha két csomópont azonosítója egyezik, a második előfordulás mező útvonalával (user döntés 2026-09-27)', () => {
    const outcome = ReplaceGraphRequestSchema.safeParse({
      nodes: [VALID_NODE, { ...VALID_NODE, label: 'Másik' }],
      edges: [],
    });
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.error.issues.some((issue) => issue.path.join('.') === 'nodes.1.id')).toBe(true);
    }
  });

  it('elutasítja, ha két él azonosítója egyezik, a második előfordulás mező útvonalával', () => {
    const outcome = ReplaceGraphRequestSchema.safeParse({
      nodes: [],
      edges: [VALID_EDGE, { ...VALID_EDGE, targetNodeId: 'node-3' }],
    });
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.error.issues.some((issue) => issue.path.join('.') === 'edges.1.id')).toBe(true);
    }
  });

  it('üres kötelező szöveg mezőre a teljes mezőútvonalon bukik (SPEC-008 5.4, O-21)', () => {
    const outcome = ReplaceGraphRequestSchema.safeParse({
      nodes: [VALID_NODE, NODE_WITH_BLANK_REQUIRED_FIELD],
      edges: [],
    });
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.error.issues.map((issue) => issue.path.join('.'))).toEqual(['nodes.1.config.branches.0.key']);
    }
  });

  it('egy csomópont és egy él azonos azonosítója nem ütközés (külön névtér)', () => {
    const outcome = ReplaceGraphRequestSchema.safeParse({
      nodes: [{ ...VALID_NODE, id: 'shared-id' }],
      edges: [{ ...VALID_EDGE, id: 'shared-id' }],
    });
    expect(outcome.success).toBe(true);
  });
});
