/* eslint-disable unicorn/no-null -- az EngineEvent.stepRunId mezője valódi string | null, futás szintű eseményre null */
import { describe, expect, it } from 'vitest';
import { classifyPublishedEvent } from './classify-published-event.ts';

describe('classifyPublishedEvent', () => {
  it('EngineEvent alakú kiadott értékre transientFrame nélküli jelzést ad', () => {
    const signal = classifyPublishedEvent({ kind: 'run_started', runId: 'run-1', stepRunId: null, payload: {} }, 1000);
    expect(signal).toStrictEqual({ runId: 'run-1', transientFrame: undefined });
  });

  it('AgentStreamMessage alakú kiadott értékre run_event_transient jelöltet épít', () => {
    const signal = classifyPublishedEvent(
      { runId: 'run-1', stepRunId: 'step-1', message: { type: 'stream_event', data: 'x' } },
      1234,
    );
    expect(signal).toStrictEqual({
      runId: 'run-1',
      transientFrame: {
        event: 'run_event_transient',
        runId: 'run-1',
        stepRunId: 'step-1',
        kind: 'sdk_stream_event',
        occurredAtMs: 1234,
        payload: { type: 'stream_event', data: 'x' },
      },
    });
  });

  it('nem rekord alakú értékre undefined-et ad', () => {
    expect(classifyPublishedEvent('nem objektum', 0)).toBeUndefined();
    expect(classifyPublishedEvent(null, 0)).toBeUndefined();
    expect(classifyPublishedEvent([1, 2, 3], 0)).toBeUndefined();
  });

  it('hiányzó vagy nem string runId esetén undefined-et ad', () => {
    expect(classifyPublishedEvent({ stepRunId: 'step-1', message: {} }, 0)).toBeUndefined();
    expect(classifyPublishedEvent({ runId: 42, stepRunId: 'step-1', message: {} }, 0)).toBeUndefined();
  });

  it('sem payload, sem message mezőt nem hordozó rekordra undefined-et ad', () => {
    expect(classifyPublishedEvent({ runId: 'run-1' }, 0)).toBeUndefined();
  });

  it('message mezővel, de nem string stepRunId-vel undefined-et ad', () => {
    expect(classifyPublishedEvent({ runId: 'run-1', stepRunId: 42, message: {} }, 0)).toBeUndefined();
  });
});
