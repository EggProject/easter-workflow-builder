import { describe, expect, it } from 'vitest';
import type { RunEventKind } from './run-event-kind.ts';
import { isRunEventKind } from './is-run-event-kind.ts';

// A SPEC-003 6.4 szekció mind a huszonöt értéke, a szekció felsorolási
// sorrendjében (12 sdk eredetű, utána 13 engine eredetű). A `RunEventKind[]`
// annotáció fordítási idejű állítás is: ha az unió bővül vagy szűkül, ez a
// lista nem maradhat érintetlenül.
const allRunEventKinds: readonly RunEventKind[] = [
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

describe('isRunEventKind', () => {
  it('mind a huszonöt ágra igazat ad', () => {
    expect(allRunEventKinds.every((kind) => isRunEventKind(kind))).toBe(true);
    expect(allRunEventKinds).toHaveLength(25);
  });

  it('hamisat ad ismeretlen szövegre', () => {
    expect(isRunEventKind('content_block_delta')).toBe(false);
    expect(isRunEventKind('')).toBe(false);
    // A `Record` alapú keresés nem eshet át a prototípus láncra.
    expect(isRunEventKind('toString')).toBe(false);
    expect(isRunEventKind('constructor')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isRunEventKind(undefined)).toBe(false);
    expect(isRunEventKind(7)).toBe(false);
    expect(isRunEventKind({ kind: 'sdk_system' })).toBe(false);
    expect(isRunEventKind(['sdk_system'])).toBe(false);
  });
});
