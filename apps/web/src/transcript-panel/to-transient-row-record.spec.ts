/* eslint-disable unicorn/no-null -- a RunEventRecord nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-003 6.2, SPEC-005 5.4) */
import type { RunEventKind, RunEventTransientFrame } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { toTransientRowRecord } from './to-transient-row-record.ts';

function transientFrame(kind: RunEventKind): RunEventTransientFrame {
  return {
    event: 'run_event_transient',
    runId: 'run-1',
    stepRunId: 'step-1',
    kind,
    occurredAtMs: 1234,
    payload: { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'x' } } },
  };
}

describe('toTransientRowRecord', () => {
  it('a keret mezőit átviszi, a keret által nem hordozott normalizált mezők null értéket kapnak, azonosító nincs', () => {
    const frame = transientFrame('sdk_stream_event');
    const record = toTransientRowRecord(frame);

    expect(record).toEqual({
      runId: 'run-1',
      stepRunId: 'step-1',
      origin: 'sdk',
      kind: 'sdk_stream_event',
      occurredAtMs: 1234,
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
      payload: frame.payload,
    });
    expect(record.payload).toBe(frame.payload);
    expect('id' in record).toBe(false);
  });

  it.each<RunEventKind>([
    'sdk_system',
    'sdk_assistant',
    'sdk_user',
    'sdk_stream_event',
    'sdk_result',
    'sdk_hook_started',
    'sdk_hook_progress',
    'sdk_hook_response',
    'sdk_informational',
    'sdk_commands_changed',
    'sdk_rate_limit',
    'sdk_context_usage',
  ])('a(z) %s kind eredete sdk (SPEC-003 6.4)', (kind) => {
    expect(toTransientRowRecord(transientFrame(kind)).origin).toBe('sdk');
  });

  it.each<RunEventKind>([
    'run_started',
    'run_finished',
    'run_interrupted',
    'step_started',
    'step_finished',
    'branch_taken',
    'fan_out_expanded',
    'join_resolved',
    'loop_iteration_started',
    'approval_requested',
    'approval_decided',
    'sub_workflow_started',
    'sub_workflow_finished',
  ])('a(z) %s kind eredete engine (SPEC-003 6.4)', (kind) => {
    expect(toTransientRowRecord(transientFrame(kind)).origin).toBe('engine');
  });
});
