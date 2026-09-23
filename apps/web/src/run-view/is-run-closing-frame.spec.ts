/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import { RunEventKindSchema, type RunEventRecord, type StreamFrame } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { isRunClosingFrame } from './is-run-closing-frame.ts';

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

describe('isRunClosingFrame', () => {
  it('a futás állapotgépének lezáró fajtái pontosan a run_finished és a run_interrupted', () => {
    // A lista magából a drótszintű felsorolásból jön, nem kézzel írt
    // másolatból: egy új `RunEventKind` érték itt is megjelenik, és a
    // besorolása a megvalósítás kimerítő `switch` szerkezetén dől el.
    expect(RunEventKindSchema.options).toHaveLength(25);
    const closingKinds = RunEventKindSchema.options.filter((kind) =>
      isRunClosingFrame(runEventFrame({ ...BASE_EVENT, kind }), 'r-1'),
    );
    expect(closingKinds).toEqual(['run_finished', 'run_interrupted']);
  });

  it('a saját futás run_interrupted eseményére igaz, a pótolt keretre is', () => {
    const frame: StreamFrame = {
      event: 'run_event',
      delivery: 'replayed',
      runEvent: { ...BASE_EVENT, kind: 'run_interrupted' },
    };
    expect(isRunClosingFrame(frame, 'r-1')).toBe(true);
  });

  it('másik futás lezáró eseményére hamis', () => {
    expect(isRunClosingFrame(runEventFrame({ ...BASE_EVENT, runId: 'r-2' }), 'r-1')).toBe(false);
    expect(isRunClosingFrame(runEventFrame({ ...BASE_EVENT, runId: 'r-2', kind: 'run_interrupted' }), 'r-1')).toBe(
      false,
    );
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
    expect(isRunClosingFrame(transient, 'r-1')).toBe(false);
  });
});
