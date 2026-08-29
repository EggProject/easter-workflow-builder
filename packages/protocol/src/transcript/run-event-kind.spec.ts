import { describe, expect, it } from 'vitest';
import { RunEventKindSchema, RunEventOriginSchema } from './run-event-kind.ts';

describe('RunEventOriginSchema', () => {
  it('elfogadja az sdk és engine értéket', () => {
    expect(RunEventOriginSchema.safeParse('sdk').success).toBe(true);
    expect(RunEventOriginSchema.safeParse('engine').success).toBe(true);
  });

  it('ismeretlen eredetet elutasít', () => {
    expect(RunEventOriginSchema.safeParse('other').success).toBe(false);
  });
});

describe('RunEventKindSchema', () => {
  it('a SPEC-003 6.4 szekció mind a 25 értékét elfogadja', () => {
    const kinds = [
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
    ];
    for (const kind of kinds) {
      expect(RunEventKindSchema.safeParse(kind).success).toBe(true);
    }
    expect(kinds).toHaveLength(25);
  });

  it('ismeretlen kind értéket elutasít', () => {
    expect(RunEventKindSchema.safeParse('unknown_kind').success).toBe(false);
  });
});
