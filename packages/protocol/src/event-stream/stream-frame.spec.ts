/* eslint-disable unicorn/no-null -- a `stepRunId`/`throughEventId`/`runId` mezők valódi SQL NULL-t hordozó, nullable drótszintű mezők, nem helyőrző `undefined` (SPEC-003 6.2, SPEC-005 5.4 táblázat) */
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ProtocolErrorBody } from '../protocol-error/protocol-error-body.ts';
import {
  ProtocolErrorFrameSchema,
  ReplayCompleteFrameSchema,
  RunEventFrameSchema,
  RunEventTransientFrameSchema,
  StreamFrameSchema,
  StreamReadyFrameSchema,
  type ProtocolErrorFrame,
} from './stream-frame.ts';

const validRunEventRecord = {
  id: 4711,
  runId: 'run-1',
  stepRunId: null,
  origin: 'sdk',
  kind: 'sdk_assistant',
  occurredAtMs: 1000,
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
  payload: { text: 'szia' },
};

describe('StreamReadyFrameSchema', () => {
  it('elfogadja az üres feliratkozású keretet', () => {
    const result = StreamReadyFrameSchema.safeParse({
      event: 'stream_ready',
      streamId: 'stream-1',
      serverInstanceId: 'server-1',
      subscriptions: [],
    });
    expect(result.success).toBe(true);
  });

  it('elfogadja a padlót hordozó feliratkozás listát', () => {
    const result = StreamReadyFrameSchema.safeParse({
      event: 'stream_ready',
      streamId: 'stream-1',
      serverInstanceId: 'server-1',
      subscriptions: [{ runId: 'run-1', fromEventId: 40, replayLimit: 100 }],
    });
    expect(result.success).toBe(true);
  });

  it('elutasítja az ismeretlen kulcsot', () => {
    const result = StreamReadyFrameSchema.safeParse({
      event: 'stream_ready',
      streamId: 'stream-1',
      serverInstanceId: 'server-1',
      subscriptions: [],
      extra: 'x',
    });
    expect(result.success).toBe(false);
  });
});

describe('RunEventFrameSchema', () => {
  it('elfogadja a pótolt keretet', () => {
    const result = RunEventFrameSchema.safeParse({
      event: 'run_event',
      delivery: 'replayed',
      runEvent: validRunEventRecord,
    });
    expect(result.success).toBe(true);
  });

  it('elfogadja az élő keretet', () => {
    const result = RunEventFrameSchema.safeParse({
      event: 'run_event',
      delivery: 'live',
      runEvent: validRunEventRecord,
    });
    expect(result.success).toBe(true);
  });

  it('elutasítja az ismeretlen delivery értéket', () => {
    const result = RunEventFrameSchema.safeParse({
      event: 'run_event',
      delivery: 'buffered',
      runEvent: validRunEventRecord,
    });
    expect(result.success).toBe(false);
  });
});

describe('RunEventTransientFrameSchema', () => {
  it('elfogadja a transiens keretet', () => {
    const result = RunEventTransientFrameSchema.safeParse({
      event: 'run_event_transient',
      runId: 'run-1',
      stepRunId: 'step-1',
      kind: 'sdk_stream_event',
      occurredAtMs: 1000,
      payload: { delta: 'sz' },
    });
    expect(result.success).toBe(true);
  });

  it('elutasítja a delivery mezőt, mert a transiens keretnek nincs ilyen mezője', () => {
    const result = RunEventTransientFrameSchema.safeParse({
      event: 'run_event_transient',
      runId: 'run-1',
      stepRunId: null,
      kind: 'sdk_stream_event',
      occurredAtMs: 1000,
      payload: {},
      delivery: 'live',
    });
    expect(result.success).toBe(false);
  });
});

describe('ReplayCompleteFrameSchema', () => {
  it('elfogadja a null throughEventId-t, ha nem volt mit pótolni', () => {
    const result = ReplayCompleteFrameSchema.safeParse({
      event: 'replay_complete',
      runId: 'run-1',
      throughEventId: null,
    });
    expect(result.success).toBe(true);
  });

  it('elfogadja a kitöltött throughEventId-t', () => {
    const result = ReplayCompleteFrameSchema.safeParse({
      event: 'replay_complete',
      runId: 'run-1',
      throughEventId: 140,
    });
    expect(result.success).toBe(true);
  });
});

describe('ProtocolErrorFrameSchema', () => {
  it('elfogadja a null runId-t kapcsolat szintű hibánál', () => {
    const result = ProtocolErrorFrameSchema.safeParse({
      event: 'protocol_error',
      code: 'invalid_request',
      message: 'Érvénytelen Last-Event-ID fejléc.',
      runId: null,
    });
    expect(result.success).toBe(true);
  });

  it('elfogadja a kitöltött runId-t futásra vonatkozó hibánál', () => {
    const result = ProtocolErrorFrameSchema.safeParse({
      event: 'protocol_error',
      code: 'not_found',
      message: 'Ismeretlen futás.',
      runId: 'run-1',
    });
    expect(result.success).toBe(true);
  });

  it('a code és message mezője pontosan a ProtocolErrorBody alakját hordozza, két külön hiba alak nélkül (38. kritérium)', () => {
    expectTypeOf<Pick<ProtocolErrorFrame, 'code' | 'message'>>().toEqualTypeOf<ProtocolErrorBody>();
  });
});

describe('StreamFrameSchema', () => {
  it('mind az öt keret típust elfogadja a diszkriminátor alapján', () => {
    const frames: readonly unknown[] = [
      { event: 'stream_ready', streamId: 's1', serverInstanceId: 'i1', subscriptions: [] },
      { event: 'run_event', delivery: 'live', runEvent: validRunEventRecord },
      {
        event: 'run_event_transient',
        runId: 'run-1',
        stepRunId: null,
        kind: 'sdk_stream_event',
        occurredAtMs: 1,
        payload: {},
      },
      { event: 'replay_complete', runId: 'run-1', throughEventId: null },
      { event: 'protocol_error', code: 'internal', message: 'hiba', runId: null },
    ];
    for (const frame of frames) {
      expect(StreamFrameSchema.safeParse(frame).success).toBe(true);
    }
  });

  it('elutasítja az ismeretlen event értéket', () => {
    const result = StreamFrameSchema.safeParse({ event: 'unknown_event', foo: 'bar' });
    expect(result.success).toBe(false);
  });
});
