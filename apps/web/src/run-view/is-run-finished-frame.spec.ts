/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { RunEventRecord, StreamFrame } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { isRunFinishedFrame } from './is-run-finished-frame.ts';

const BASE_EVENT: RunEventRecord = {
  id: 7,
  runId: 'r-1',
  stepRunId: null,
  origin: 'engine',
  kind: 'run_finished',
  occurredAtMs: 100,
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

function runEventFrame(runEvent: RunEventRecord): StreamFrame {
  return { event: 'run_event', delivery: 'live', runEvent };
}

describe('isRunFinishedFrame', () => {
  it('a saját futás run_finished eseményére igaz', () => {
    expect(isRunFinishedFrame(runEventFrame(BASE_EVENT), 'r-1')).toBe(true);
  });

  it('másik futás run_finished eseményére hamis', () => {
    expect(isRunFinishedFrame(runEventFrame({ ...BASE_EVENT, runId: 'r-2' }), 'r-1')).toBe(false);
  });

  it('másik esemény típusra hamis', () => {
    expect(isRunFinishedFrame(runEventFrame({ ...BASE_EVENT, kind: 'step_started' }), 'r-1')).toBe(false);
  });

  it('átmeneti keretre hamis, mert a futás lezárása mindig perzisztált esemény', () => {
    const transient: StreamFrame = {
      event: 'run_event_transient',
      runId: 'r-1',
      stepRunId: null,
      kind: 'run_finished',
      occurredAtMs: 100,
      payload: {},
    };
    expect(isRunFinishedFrame(transient, 'r-1')).toBe(false);
  });
});
