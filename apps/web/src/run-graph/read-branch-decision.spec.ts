/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { RunEventKind, RunEventRecord, StreamFrame } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { readBranchDecision } from './read-branch-decision.ts';

const RUN_ID = 'r-1';

function runEventRecord(overrides: Partial<RunEventRecord> = {}): RunEventRecord {
  return {
    id: 7,
    runId: RUN_ID,
    stepRunId: 's-branch',
    origin: 'engine',
    kind: 'branch_taken',
    occurredAtMs: 7,
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
    payload: { branchKey: 'igen', usedDefault: false },
    ...overrides,
  };
}

function runEventFrame(overrides: Partial<RunEventRecord> = {}, delivery: 'live' | 'replayed' = 'live'): StreamFrame {
  return { event: 'run_event', delivery, runEvent: runEventRecord(overrides) };
}

describe('readBranchDecision', () => {
  it('a választott kulcsú döntést olvassa ki, az esemény és a lépés futás azonosítójával', () => {
    expect(readBranchDecision(runEventFrame(), RUN_ID)).toEqual({
      eventId: 7,
      stepRunId: 's-branch',
      branchKey: 'igen',
      usedDefault: false,
    });
  });

  it('az alapértelmezett ágra lépett döntés null kulcsát is elfogadja', () => {
    const frame = runEventFrame({ payload: { branchKey: null, usedDefault: true } });

    expect(readBranchDecision(frame, RUN_ID)).toEqual({
      eventId: 7,
      stepRunId: 's-branch',
      branchKey: null,
      usedDefault: true,
    });
  });

  it('a pótolt keret is döntés, nem csak az élő', () => {
    expect(readBranchDecision(runEventFrame({}, 'replayed'), RUN_ID)?.eventId).toBe(7);
  });

  it.each<StreamFrame>([
    { event: 'stream_ready', streamId: 'stream-1', serverInstanceId: 'server-1', subscriptions: [] },
    { event: 'replay_complete', runId: RUN_ID, throughEventId: 7 },
    { event: 'protocol_error', code: 'invalid_request', message: 'hiba', runId: RUN_ID },
    {
      event: 'run_event_transient',
      runId: RUN_ID,
      stepRunId: 's-branch',
      kind: 'branch_taken',
      occurredAtMs: 7,
      payload: { branchKey: 'igen', usedDefault: false },
    },
  ])('a nem run_event keret nem döntés (%o)', (frame) => {
    expect(readBranchDecision(frame, RUN_ID)).toBeUndefined();
  });

  it('egy másik futás kerete nem döntés', () => {
    expect(readBranchDecision(runEventFrame({ runId: 'r-masik' }), RUN_ID)).toBeUndefined();
  });

  it.each<RunEventKind>(['step_started', 'step_finished', 'sdk_assistant', 'run_finished'])(
    'a %s keret nem döntés',
    (kind) => {
      expect(readBranchDecision(runEventFrame({ kind }), RUN_ID)).toBeUndefined();
    },
  );

  it('lépés futás nélküli branch_taken keret nem döntés, mert csomóponthoz soha nem képezhető le', () => {
    expect(readBranchDecision(runEventFrame({ stepRunId: null }), RUN_ID)).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ['null payload', null],
    ['szöveg payload', 'igen'],
    ['tömb payload', [{ branchKey: 'igen', usedDefault: false }]],
    ['hiányzó branchKey', { usedDefault: false }],
    ['szám branchKey', { branchKey: 3, usedDefault: false }],
    ['hiányzó usedDefault', { branchKey: 'igen' }],
    ['szöveg usedDefault', { branchKey: 'igen', usedDefault: 'false' }],
    ['null usedDefault', { branchKey: null, usedDefault: null }],
  ])('a hibás alakú payload kimarad: %s', (_title, payload) => {
    expect(readBranchDecision(runEventFrame({ payload }), RUN_ID)).toBeUndefined();
  });
});
