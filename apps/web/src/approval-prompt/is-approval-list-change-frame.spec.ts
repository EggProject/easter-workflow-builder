/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { RunEventKind, RunEventRecord, StreamFrame } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { isApprovalListChangeFrame } from './is-approval-list-change-frame.ts';

const BASE_EVENT: RunEventRecord = {
  id: 7,
  runId: 'r-1',
  stepRunId: 's-1',
  origin: 'engine',
  kind: 'approval_requested',
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

describe('isApprovalListChangeFrame', () => {
  it.each<RunEventKind>(['approval_requested', 'approval_decided', 'step_finished', 'run_finished', 'run_interrupted'])(
    'a saját futás élő %s keretére igaz',
    (kind) => {
      expect(isApprovalListChangeFrame(liveFrame(kind), 'r-1')).toBe(true);
    },
  );

  it.each<RunEventKind>(['run_started', 'step_started', 'sub_workflow_started', 'sdk_assistant', 'sdk_result'])(
    'a függő jóváhagyásokat nem érintő %s keretre hamis',
    (kind) => {
      expect(isApprovalListChangeFrame(liveFrame(kind), 'r-1')).toBe(false);
    },
  );

  it('másik futás élő approval_requested keretére hamis', () => {
    expect(isApprovalListChangeFrame(liveFrame('approval_requested', 'r-2'), 'r-1')).toBe(false);
  });

  it('pótolt approval_requested keretre hamis: a pótlást a replay_complete zárja egyetlen jelzéssel', () => {
    const replayed: StreamFrame = { event: 'run_event', delivery: 'replayed', runEvent: BASE_EVENT };
    expect(isApprovalListChangeFrame(replayed, 'r-1')).toBe(false);
  });

  it('a saját futás replay_complete keretére igaz, másik futáséra hamis', () => {
    expect(isApprovalListChangeFrame({ event: 'replay_complete', runId: 'r-1', throughEventId: 7 }, 'r-1')).toBe(true);
    expect(isApprovalListChangeFrame({ event: 'replay_complete', runId: 'r-2', throughEventId: null }, 'r-1')).toBe(
      false,
    );
  });

  it('átmeneti, stream_ready és protocol_error keretre hamis', () => {
    const transient: StreamFrame = {
      event: 'run_event_transient',
      runId: 'r-1',
      stepRunId: 's-1',
      kind: 'approval_requested',
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

    expect(isApprovalListChangeFrame(transient, 'r-1')).toBe(false);
    expect(isApprovalListChangeFrame(streamReady, 'r-1')).toBe(false);
    expect(isApprovalListChangeFrame(protocolError, 'r-1')).toBe(false);
  });
});
