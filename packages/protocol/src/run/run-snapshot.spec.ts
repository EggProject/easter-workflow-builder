/* eslint-disable unicorn/no-null -- a SnapshotEdge és a workflow fejléc nullázható mezői (description, sourceHandle, targetHandle, branchKey) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { RunSnapshotResponseSchema, SnapshotEdgeSchema, SnapshotNodeSchema } from './run-snapshot.ts';

const VALID_NODE = {
  id: 'node-1',
  type: 'start',
  label: 'Start',
  position: { x: 0, y: 0 },
  config: {},
  effectiveProviderId: 'minimax',
};

const VALID_EDGE = {
  id: 'edge-1',
  sourceNodeId: 'node-1',
  targetNodeId: 'node-2',
  sourceHandle: null,
  targetHandle: null,
  branchKey: null,
};

describe('SnapshotNodeSchema', () => {
  it('elfogadja az érvényes pillanatkép node-ot', () => {
    expect(SnapshotNodeSchema.safeParse(VALID_NODE).success).toBe(true);
  });
});

describe('SnapshotEdgeSchema', () => {
  it('elfogadja az érvényes pillanatkép élet', () => {
    expect(SnapshotEdgeSchema.safeParse(VALID_EDGE).success).toBe(true);
  });
});

describe('RunSnapshotResponseSchema', () => {
  it('elfogadja az 1. verziójú dokumentumot', () => {
    const outcome = RunSnapshotResponseSchema.safeParse({
      version: 1,
      sdkVersionPin: '0.3.245',
      workflow: { id: 'wf-1', name: 'Első workflow', description: null },
      nodes: [VALID_NODE],
      edges: [VALID_EDGE],
    });
    expect(outcome.success).toBe(true);
  });

  it('elutasítja a nem 1-es verziószámot', () => {
    const outcome = RunSnapshotResponseSchema.safeParse({
      version: 2,
      sdkVersionPin: '0.3.245',
      workflow: { id: 'wf-1', name: 'Első workflow', description: null },
      nodes: [],
      edges: [],
    });
    expect(outcome.success).toBe(false);
  });
});
