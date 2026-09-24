/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { RunEventKind, RunEventRecord, StreamFrame } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { isStepRunListChangeFrame } from './is-step-run-list-change-frame.ts';

const BASE_EVENT: RunEventRecord = {
  id: 7,
  runId: 'r-1',
  stepRunId: 's-1',
  origin: 'engine',
  kind: 'step_started',
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

function liveFrame(kind: RunEventKind, runId = 'r-1'): StreamFrame {
  return { event: 'run_event', delivery: 'live', runEvent: { ...BASE_EVENT, kind, runId } };
}

describe('isStepRunListChangeFrame', () => {
  it.each<RunEventKind>([
    'step_started',
    'step_finished',
    'approval_requested',
    'sub_workflow_started',
    'run_finished',
    'run_interrupted',
  ])('a saját futás élő %s keretére igaz', (kind) => {
    expect(isStepRunListChangeFrame(liveFrame(kind), 'r-1')).toBe(true);
  });

  it.each<RunEventKind>(['run_started', 'branch_taken', 'approval_decided', 'sdk_assistant', 'sdk_result'])(
    'a lépés futás sort nem érintő %s keretre hamis',
    (kind) => {
      expect(isStepRunListChangeFrame(liveFrame(kind), 'r-1')).toBe(false);
    },
  );

  it('másik futás élő step_started keretére hamis', () => {
    expect(isStepRunListChangeFrame(liveFrame('step_started', 'r-2'), 'r-1')).toBe(false);
  });

  it('pótolt step_started keretre hamis: a pótlást a replay_complete zárja egyetlen jelzéssel', () => {
    const replayed: StreamFrame = { event: 'run_event', delivery: 'replayed', runEvent: BASE_EVENT };
    expect(isStepRunListChangeFrame(replayed, 'r-1')).toBe(false);
  });

  it('a saját futás replay_complete keretére igaz, másik futáséra hamis', () => {
    expect(isStepRunListChangeFrame({ event: 'replay_complete', runId: 'r-1', throughEventId: 7 }, 'r-1')).toBe(true);
    expect(isStepRunListChangeFrame({ event: 'replay_complete', runId: 'r-2', throughEventId: null }, 'r-1')).toBe(
      false,
    );
  });

  it('átmeneti, stream_ready és protocol_error keretre hamis', () => {
    const transient: StreamFrame = {
      event: 'run_event_transient',
      runId: 'r-1',
      stepRunId: 's-1',
      kind: 'step_started',
      occurredAtMs: 100,
      payload: {},
    };
    const streamReady: StreamFrame = {
      event: 'stream_ready',
      streamId: 'stream-1',
      serverInstanceId: 'srv-1',
      subscriptions: [],
    };
    const protocolError: StreamFrame = { event: 'protocol_error', code: 'internal', message: 'hiba', runId: 'r-1' };

    expect(isStepRunListChangeFrame(transient, 'r-1')).toBe(false);
    expect(isStepRunListChangeFrame(streamReady, 'r-1')).toBe(false);
    expect(isStepRunListChangeFrame(protocolError, 'r-1')).toBe(false);
  });
});
