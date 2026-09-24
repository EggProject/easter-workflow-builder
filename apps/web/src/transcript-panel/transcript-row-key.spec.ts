/* eslint-disable unicorn/no-null -- a RunEventRecord nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-003 6.2) */
import type { RunEventRecord } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { toTransientRowRecord } from './to-transient-row-record.ts';
import type { TranscriptRow } from './transcript-row.ts';
import { transcriptRowKey } from './transcript-row-key.ts';

function persistedRow(id: number): TranscriptRow {
  const record: RunEventRecord = {
    id,
    runId: 'run-1',
    stepRunId: null,
    origin: 'engine',
    kind: 'step_started',
    occurredAtMs: id,
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
  return { source: 'persisted', key: `event-${String(id)}`, record };
}

function transientRow(sequence: number): TranscriptRow {
  return {
    source: 'transient',
    key: `transient-${String(sequence)}`,
    record: toTransientRowRecord({
      event: 'run_event_transient',
      runId: 'run-1',
      stepRunId: null,
      kind: 'sdk_stream_event',
      occurredAtMs: 1,
      payload: {},
    }),
  };
}

describe('transcriptRowKey', () => {
  const rows = [persistedRow(41), transientRow(1), persistedRow(42)];

  it('a sorszámhoz tartozó sor saját kulcsát adja, nem a sorszámot', () => {
    expect(transcriptRowKey(0, { rows })).toBe('event-41');
    expect(transcriptRowKey(1, { rows })).toBe('transient-1');
    expect(transcriptRowKey(2, { rows })).toBe('event-42');
  });

  it('ugyanaz a sor más sorszámon is ugyanazt a kulcsot kapja', () => {
    const shifted = [persistedRow(7), ...rows];
    expect(transcriptRowKey(1, { rows: shifted })).toBe(transcriptRowKey(0, { rows }));
  });
});
