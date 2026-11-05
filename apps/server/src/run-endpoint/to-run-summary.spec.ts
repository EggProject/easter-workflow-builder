/* eslint-disable unicorn/no-null -- a WorkflowRunRecord mezői valódi Date | null és string | null típusúak */
import { describe, expect, it } from 'vitest';
import { isGraphSnapshotHash, type GraphSnapshotHash, type WorkflowRunRecord } from '@easter-workflow-builder/db';
import { toRunSummary } from './to-run-summary.ts';

// Egy tetszőleges, de érvényes alakú pillanatkép lenyomat a rekord fixtúrához: a
// `GraphSnapshotHash` névleges típus, tehát `as` nélkül csak a guard adhatja.
function snapshotHashOf(text: string): GraphSnapshotHash {
  if (!isGraphSnapshotHash(text)) {
    throw new Error(`a teszt lenyomata érvénytelen alakú: ${text}`);
  }
  return text;
}

const BASE_RECORD: WorkflowRunRecord = {
  id: 'run-1',
  workflowId: 'wf-1',
  status: 'running',
  input: { a: 1 },
  providerId: 'claude-subscription',
  rootRunId: 'run-1',
  depth: 0,
  workflowAncestry: [],
  graphSnapshotHash: snapshotHashOf('a'.repeat(64)),
  persistedStreamDeltas: false,
  restartedFromRunId: null,
  createdAtMs: new Date(1000),
  startedAtMs: new Date(2000),
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

describe('toRunSummary', () => {
  it('a Date mezőket egész milliszekundummá alakítja', () => {
    expect(toRunSummary(BASE_RECORD)).toStrictEqual({
      id: 'run-1',
      workflowId: 'wf-1',
      status: 'running',
      providerId: 'claude-subscription',
      createdAtMs: 1000,
      startedAtMs: 2000,
      finishedAtMs: null,
      errorKind: null,
      errorMessage: null,
    });
  });

  it('a null Date mezőt null egészként adja vissza, nem dob kivételt', () => {
    const summary = toRunSummary({ ...BASE_RECORD, startedAtMs: null, finishedAtMs: new Date(3000) });
    expect(summary.startedAtMs).toBeNull();
    expect(summary.finishedAtMs).toBe(3000);
  });
});
