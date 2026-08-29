/* eslint-disable unicorn/no-null -- a `stepRunId` nullable drótszintű mező, valódi SQL NULL-t hordoz (SPEC-003 6.2) */
import { describe, expect, it } from 'vitest';
import { decodeStreamFrame } from './decode-stream-frame.ts';

describe('decodeStreamFrame', () => {
  it('érvényes keretre a validált értéket adja', () => {
    const result = decodeStreamFrame({
      event: 'replay_complete',
      runId: 'run-1',
      throughEventId: 140,
    });
    expect(result).toStrictEqual({
      kind: 'ok',
      value: { event: 'replay_complete', runId: 'run-1', throughEventId: 140 },
    });
  });

  it('hiányzó mezőre Outcome hibaágat ad', () => {
    const result = decodeStreamFrame({
      event: 'replay_complete',
      runId: 'run-1',
      // throughEventId hiányzik
    });
    expect(result.kind).toBe('error');
  });

  it('rossz típusú mezőre Outcome hibaágat ad', () => {
    const result = decodeStreamFrame({
      event: 'replay_complete',
      runId: 'run-1',
      throughEventId: 'nem szám',
    });
    expect(result.kind).toBe('error');
  });

  it('ismeretlen event értékre Outcome hibaágat ad', () => {
    const result = decodeStreamFrame({
      event: 'not_a_real_event',
      runId: 'run-1',
    });
    expect(result.kind).toBe('error');
  });

  it('ismeretlen kulcsra Outcome hibaágat ad', () => {
    const result = decodeStreamFrame({
      event: 'replay_complete',
      runId: 'run-1',
      throughEventId: null,
      extraKulcs: 'nem várt',
    });
    expect(result.kind).toBe('error');
  });

  it('a hibaüzenet megnevezi a hibás mező útvonalát', () => {
    const result = decodeStreamFrame({
      event: 'replay_complete',
      runId: 'run-1',
      throughEventId: 'nem szám',
    });
    if (result.kind !== 'error') {
      throw new Error('a tesztnek hibaágat kellett kapnia');
    }
    expect(result.message).toContain('throughEventId');
  });
});
