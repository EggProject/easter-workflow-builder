/* eslint-disable unicorn/no-null -- a RunSummary/RunDetail nullázható mezői (startedAtMs, finishedAtMs, errorKind, errorMessage, restartedFromRunId) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { ListRunsQuerySchema, RunDetailSchema, RunSummarySchema } from './run-record.ts';

const VALID_SUMMARY = {
  id: 'run-1',
  workflowId: 'wf-1',
  status: 'running',
  providerId: 'minimax',
  createdAtMs: 1,
  startedAtMs: 2,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

describe('RunSummarySchema', () => {
  it('elfogadja az érvényes rekordot', () => {
    expect(RunSummarySchema.safeParse(VALID_SUMMARY).success).toBe(true);
  });

  it('elutasítja az ismeretlen állapotot', () => {
    expect(RunSummarySchema.safeParse({ ...VALID_SUMMARY, status: 'unknown' }).success).toBe(false);
  });
});

describe('RunDetailSchema', () => {
  it('elfogadja a persistedStreamDeltas mezőt (14. kritérium)', () => {
    const outcome = RunDetailSchema.safeParse({
      ...VALID_SUMMARY,
      input: { field: 'value' },
      rootRunId: 'run-1',
      depth: 0,
      workflowAncestry: ['wf-1'],
      graphSnapshotHash: 'a'.repeat(64),
      persistedStreamDeltas: false,
      restartedFromRunId: null,
    });
    expect(outcome.success).toBe(true);
  });

  it('elutasítja, ha a persistedStreamDeltas mező hiányzik', () => {
    const outcome = RunDetailSchema.safeParse({
      ...VALID_SUMMARY,
      input: {},
      rootRunId: 'run-1',
      depth: 0,
      workflowAncestry: ['wf-1'],
      graphSnapshotHash: 'a'.repeat(64),
      restartedFromRunId: null,
    });
    expect(outcome.success).toBe(false);
  });
});

describe('ListRunsQuerySchema', () => {
  it('elfogadja a kötelező limitet, workflowId nélkül', () => {
    expect(ListRunsQuerySchema.safeParse({ limit: 10 }).success).toBe(true);
  });

  it('elfogadja a workflowId szűrést is', () => {
    expect(ListRunsQuerySchema.safeParse({ limit: 10, workflowId: 'wf-1' }).success).toBe(true);
  });

  it('elutasítja a hiányzó limitet', () => {
    expect(ListRunsQuerySchema.safeParse({ workflowId: 'wf-1' }).success).toBe(false);
  });

  it('elutasítja az ismeretlen kulcsot (15. kritérium)', () => {
    expect(ListRunsQuerySchema.safeParse({ limit: 10, extra: 1 }).success).toBe(false);
  });
});
