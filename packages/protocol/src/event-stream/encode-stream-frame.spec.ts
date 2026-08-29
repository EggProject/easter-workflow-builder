/* eslint-disable unicorn/no-null -- a `stepRunId`/`throughEventId`/`runId` nullable drótszintű mezők, valódi SQL NULL-t hordoznak (SPEC-003 6.2, SPEC-005 5.4 táblázat) */
import { describe, expect, it } from 'vitest';
import type { StreamFrame } from './stream-frame.ts';
import { encodeStreamFrame } from './encode-stream-frame.ts';

const validRunEventRecord = {
  id: 4711,
  runId: 'run-1',
  stepRunId: null,
  origin: 'sdk' as const,
  kind: 'sdk_assistant' as const,
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

describe('encodeStreamFrame', () => {
  it('a stream_ready keretnek nincs id: sora', () => {
    const frame: StreamFrame = {
      event: 'stream_ready',
      streamId: 's1',
      serverInstanceId: 'i1',
      subscriptions: [],
    };
    const encoded = encodeStreamFrame(frame);
    expect(encoded).toBe(`event: stream_ready\ndata: ${JSON.stringify(frame)}\n\n`);
  });

  it('kizárólag a run_event keret kap id: sort, a runEvent.id decimális alakjával', () => {
    const frame: StreamFrame = {
      event: 'run_event',
      delivery: 'live',
      runEvent: validRunEventRecord,
    };
    const encoded = encodeStreamFrame(frame);
    expect(encoded).toBe(`event: run_event\nid: 4711\ndata: ${JSON.stringify(frame)}\n\n`);
  });

  it('a run_event_transient keretnek nincs id: sora', () => {
    const frame: StreamFrame = {
      event: 'run_event_transient',
      runId: 'run-1',
      stepRunId: null,
      kind: 'sdk_stream_event',
      occurredAtMs: 1,
      payload: {},
    };
    const encoded = encodeStreamFrame(frame);
    expect(encoded).toBe(`event: run_event_transient\ndata: ${JSON.stringify(frame)}\n\n`);
  });

  it('a replay_complete keretnek nincs id: sora', () => {
    const frame: StreamFrame = {
      event: 'replay_complete',
      runId: 'run-1',
      throughEventId: null,
    };
    const encoded = encodeStreamFrame(frame);
    expect(encoded).toBe(`event: replay_complete\ndata: ${JSON.stringify(frame)}\n\n`);
  });

  it('a protocol_error keretnek nincs id: sora', () => {
    const frame: StreamFrame = {
      event: 'protocol_error',
      code: 'internal',
      message: 'hiba',
      runId: null,
    };
    const encoded = encodeStreamFrame(frame);
    expect(encoded).toBe(`event: protocol_error\ndata: ${JSON.stringify(frame)}\n\n`);
  });

  it('a törzs sortörést tartalmazó payloaddal is pontosan egy data: sorban fér el', () => {
    const frame: StreamFrame = {
      event: 'run_event_transient',
      runId: 'run-1',
      stepRunId: null,
      kind: 'sdk_stream_event',
      occurredAtMs: 1,
      payload: { text: 'első sor\nmásodik sor\r\nharmadik sor' },
    };
    const encoded = encodeStreamFrame(frame);
    const lines = encoded.split('\n');
    // Pontosan egy "data:" kezdetű sor van, a sortörést tartalmazó payload
    // mellett is (SPEC-005 5.4, F-24: a JSON.stringify escape-eli a
    // sortörést, tehát az nem hoz létre új sort a kódolt szövegben).
    const dataLines = lines.filter((line) => line.startsWith('data: '));
    expect(dataLines).toHaveLength(1);
    expect(encoded.endsWith('\n\n')).toBe(true);
  });
});
