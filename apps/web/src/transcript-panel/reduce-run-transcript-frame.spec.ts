/* eslint-disable unicorn/no-null -- a RunEventRecord nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-003 6.2, SPEC-005 5.4) */
import type { RunEventRecord, RunEventTransientFrame, StreamFrame } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { reduceRunTranscriptFrame } from './reduce-run-transcript-frame.ts';
import type { RunTranscriptState } from './run-transcript-state.ts';

const EMPTY: RunTranscriptState = { rows: [], afterEventId: 0, transientSequence: 0, isReplayComplete: false };

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

/**
 * Egy élő szöveg delta, pontosan abban az alakban, ahogy a szerver a
 * kikapcsolt delta kapcsolójú futásnál kiküldi
 * (`apps/server/src/engine-assembly/classify-published-event.ts`).
 */
function transientFrame(text: string, runId = 'run-1'): RunEventTransientFrame {
  return {
    event: 'run_event_transient',
    runId,
    stepRunId: 'step-1',
    kind: 'sdk_stream_event',
    occurredAtMs: 42,
    payload: { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } },
  };
}

function reduceAll(frames: readonly StreamFrame[], initial: RunTranscriptState = EMPTY): RunTranscriptState {
  let state = initial;
  for (const frame of frames) {
    state = reduceRunTranscriptFrame(state, frame, 'run-1');
  }
  return state;
}

describe('reduceRunTranscriptFrame', () => {
  it('a nézett futás run_event keretét a lista végére fűzi, és a kurzort az azonosítójára lépteti', () => {
    const afterSecond = reduceAll([runEventFrame(makeRecord(3)), runEventFrame(makeRecord(7))]);

    expect(afterSecond.rows.map((row) => row.source)).toEqual(['persisted', 'persisted']);
    expect(afterSecond.rows.map((row) => row.key)).toEqual(['event-3', 'event-7']);
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

  it('a nézett futás átmeneti keretét átmeneti sorként fűzi a végére, a keret tartalmával', () => {
    const frame = transientFrame('Helló');
    const state = reduceAll([runEventFrame(makeRecord(1)), frame]);

    const lastRow = state.rows.at(-1);
    expect(lastRow?.source).toBe('transient');
    expect(lastRow?.record.kind).toBe('sdk_stream_event');
    expect(lastRow?.record.stepRunId).toBe('step-1');
    expect(lastRow?.record.payload).toBe(frame.payload);
    expect(state.transientSequence).toBe(1);
  });

  it('az átmeneti sor kulcsa kliens oldali monoton számláló: két azonos tartalmú keret két külön kulcsot kap', () => {
    const frame = transientFrame('ugyanaz');
    const state = reduceAll([frame, frame, frame]);

    expect(state.rows.map((row) => row.key)).toEqual(['transient-1', 'transient-2', 'transient-3']);
    expect(new Set(state.rows.map((row) => row.key)).size).toBe(3);
    expect(state.transientSequence).toBe(3);
  });

  it('az átmeneti és a perzisztált sor kulcsa akkor sem ütközik, ha a számláló és az azonosító azonos', () => {
    const state = reduceAll([transientFrame('a'), runEventFrame(makeRecord(1))]);

    expect(state.rows.map((row) => row.key)).toEqual(['transient-1', 'event-1']);
  });

  it('KURZOR: átmeneti sor után az afterEventId az utolsó TÁROLT esemény azonosítója marad', () => {
    const afterPersisted = reduceAll([runEventFrame(makeRecord(1)), runEventFrame(makeRecord(2))]);
    const afterTransients = reduceAll(
      [transientFrame('a'), transientFrame('b'), transientFrame('c'), transientFrame('d')],
      afterPersisted,
    );

    expect(afterTransients.afterEventId).toBe(2);
    expect(afterTransients.rows).toHaveLength(6);
  });

  it('KURZOR: átmeneti sorok után az újracsatlakozás pótlása a tárolt ismétlést eldobja, a következő tárolt sort felveszi', () => {
    // Négy átmeneti sor: egy, a számlálóra vagy a sorok számára lépő kurzor
    // a 3-as és 4-es azonosítójú tárolt sort csendben eldobná.
    const beforeReconnect = reduceAll([
      runEventFrame(makeRecord(1)),
      runEventFrame(makeRecord(2)),
      transientFrame('a'),
      transientFrame('b'),
      transientFrame('c'),
      transientFrame('d'),
    ]);
    // Az újracsatlakozás pótlása az 1-es és a 2-es sort megismétli, majd új,
    // tárolt sorokat hoz.
    const afterReconnect = reduceAll(
      [runEventFrame(makeRecord(1)), runEventFrame(makeRecord(2)), runEventFrame(makeRecord(3))],
      beforeReconnect,
    );
    const afterLive = reduceAll([runEventFrame(makeRecord(4))], afterReconnect);

    expect(afterLive.rows.map((row) => row.key)).toEqual([
      'event-1',
      'event-2',
      'transient-1',
      'transient-2',
      'transient-3',
      'transient-4',
      'event-3',
      'event-4',
    ]);
    expect(afterLive.afterEventId).toBe(4);
  });

  it('másik futás átmeneti keretére a kapott állapotot adja vissza, a számláló sem lép', () => {
    expect(reduceRunTranscriptFrame(EMPTY, transientFrame('x', 'run-2'), 'run-1')).toBe(EMPTY);
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
  ])('a(z) $event keret a transcriptet nem érinti', (frame) => {
    expect(reduceRunTranscriptFrame(EMPTY, frame, 'run-1')).toBe(EMPTY);
  });
});
