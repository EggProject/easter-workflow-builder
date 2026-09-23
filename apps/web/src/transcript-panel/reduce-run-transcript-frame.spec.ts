/* eslint-disable unicorn/no-null -- a RunEventRecord nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-003 6.2, SPEC-005 5.4) */
import type { RunEventRecord, StreamFrame } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { reduceRunTranscriptFrame } from './reduce-run-transcript-frame.ts';
import type { RunTranscriptState } from './run-transcript-state.ts';

const EMPTY: RunTranscriptState = { records: [], afterEventId: 0, isReplayComplete: false };

function makeRecord(id: number, runId = 'run-1'): RunEventRecord {
  return {
    id,
    runId,
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
}

function runEventFrame(record: RunEventRecord): StreamFrame {
  return { event: 'run_event', delivery: 'replayed', runEvent: record };
}

describe('reduceRunTranscriptFrame', () => {
  it('a nézett futás run_event keretét a lista végére fűzi, és a kurzort az azonosítójára lépteti', () => {
    const firstFrame = runEventFrame(makeRecord(3));
    const secondFrame = runEventFrame(makeRecord(7));
    const afterFirst = reduceRunTranscriptFrame(EMPTY, firstFrame, 'run-1');
    const afterSecond = reduceRunTranscriptFrame(afterFirst, secondFrame, 'run-1');

    expect(afterSecond.records.map((record) => record.id)).toEqual([3, 7]);
    expect(afterSecond.afterEventId).toBe(7);
  });

  it('másik futás run_event keretére a kapott állapotot adja vissza', () => {
    const otherRunFrame = runEventFrame(makeRecord(3, 'run-2'));
    expect(reduceRunTranscriptFrame(EMPTY, otherRunFrame, 'run-1')).toBe(EMPTY);
  });

  it('a kurzornál nem nagyobb azonosítójú keretet ismétlésként eldobja (újracsatlakozás utáni pótlás)', () => {
    const state = reduceRunTranscriptFrame(EMPTY, runEventFrame(makeRecord(5)), 'run-1');
    const repeatedFrame = runEventFrame(makeRecord(5));
    const olderFrame = runEventFrame(makeRecord(4));

    expect(reduceRunTranscriptFrame(state, repeatedFrame, 'run-1')).toBe(state);
    expect(reduceRunTranscriptFrame(state, olderFrame, 'run-1')).toBe(state);
  });

  it('a nézett futás replay_complete keretére lezárja a pótlást, egy ismételt keret már nem változtat', () => {
    const frame: StreamFrame = { event: 'replay_complete', runId: 'run-1', throughEventId: null };
    const completed = reduceRunTranscriptFrame(EMPTY, frame, 'run-1');

    expect(completed.isReplayComplete).toBe(true);
    expect(reduceRunTranscriptFrame(completed, frame, 'run-1')).toBe(completed);
  });

  it('másik futás replay_complete keretére nem zárja le a pótlást', () => {
    const frame: StreamFrame = { event: 'replay_complete', runId: 'run-2', throughEventId: 9 };
    expect(reduceRunTranscriptFrame(EMPTY, frame, 'run-1')).toBe(EMPTY);
  });

  it.each<StreamFrame>([
    { event: 'stream_ready', streamId: 's', serverInstanceId: 'i', subscriptions: [] },
    { event: 'protocol_error', code: 'internal', message: 'hiba', runId: 'run-1' },
    {
      event: 'run_event_transient',
      runId: 'run-1',
      stepRunId: null,
      kind: 'sdk_stream_event',
      occurredAtMs: 1,
      payload: {},
    },
  ])('a(z) $event keret a transcriptet nem érinti', (frame) => {
    expect(reduceRunTranscriptFrame(EMPTY, frame, 'run-1')).toBe(EMPTY);
  });
});
