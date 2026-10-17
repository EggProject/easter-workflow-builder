/* eslint-disable unicorn/no-null -- a RunEventRecord nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-003 6.2, SPEC-005 5.4) */
import type { RunEventRecord } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import type { RunTranscriptState } from '../transcript-panel/run-transcript-state.ts';
import type { TranscriptRow } from '../transcript-panel/transcript-row.ts';
import { filterTranscriptByStepRuns } from './filter-transcript-by-step-runs.ts';

function makeRecordWithoutId(stepRunId: string | null): Omit<RunEventRecord, 'id'> {
  return {
    runId: 'r-1',
    stepRunId,
    origin: 'engine',
    kind: 'step_started',
    occurredAtMs: 1,
    sdkMessageType: null,
    sdkMessageSubtype: null,
    sdkSessionId: null,
    sdkUuid: null,
    parentToolUseId: null,
    toolName: null,
    toolUseId: null,
    inputTokens: null,
    outputTokens: null,
    cacheReadInputTokens: null,
    cacheCreationInputTokens: null,
    numTurns: null,
    payload: {},
  };
}

function persistedRow(id: number, stepRunId: string | null): TranscriptRow {
  return { source: 'persisted', key: `event-${String(id)}`, record: { id, ...makeRecordWithoutId(stepRunId) } };
}

const TRANSIENT_ROW: TranscriptRow = { source: 'transient', key: 'transient-1', record: makeRecordWithoutId('s-a') };

const TRANSCRIPT: RunTranscriptState = {
  rows: [
    persistedRow(1, null),
    persistedRow(2, 's-a'),
    persistedRow(3, 's-b'),
    TRANSIENT_ROW,
    persistedRow(4, 's-other'),
  ],
  afterEventId: 4,
  transientSequence: 1,
  isReplayComplete: true,
};

describe('filterTranscriptByStepRuns', () => {
  it('csak a halmazban álló lépés futások sorait tartja meg, a tárolt és az átmeneti sort is, sorrendben', () => {
    const filtered = filterTranscriptByStepRuns(TRANSCRIPT, new Set(['s-a', 's-b']));
    expect(filtered.rows.map((row) => row.key)).toEqual(['event-2', 'event-3', 'transient-1']);
  });

  it('a lépéshez nem kötött sort (stepRunId: null) elhagyja', () => {
    const filtered = filterTranscriptByStepRuns(TRANSCRIPT, new Set(['s-other']));
    expect(filtered.rows.map((row) => row.key)).toEqual(['event-4']);
  });

  it('a kurzort, az átmeneti számlálót és a pótlás állapotát változatlanul átadja', () => {
    const filtered = filterTranscriptByStepRuns(TRANSCRIPT, new Set());
    expect(filtered).toEqual({ rows: [], afterEventId: 4, transientSequence: 1, isReplayComplete: true });
  });
});
