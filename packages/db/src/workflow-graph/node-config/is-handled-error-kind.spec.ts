import { describe, expect, it } from 'vitest';
import type { HandledErrorKind } from './handled-error-kind.ts';
import { isHandledErrorKind } from './is-handled-error-kind.ts';

// Az unió mind a huszonnégy értéke. A `HandledErrorKind[]` annotáció fordítási
// idejű állítás is: egy elírt vagy az unión kívüli elem nem fordul le.
const allHandledErrorKinds: readonly HandledErrorKind[] = [
  'provider_call_failed',
  'agent_result_not_success',
  'missing_structured_output',
  'structured_output_schema_mismatch',
  'no_resumable_session',
  'missing_provider_env',
  'mcp_server_not_found',
  'missing_mcp_server_env',
  'mcp_server_connection_failed',
  'agent_skill_not_in_step',
  'template_render_failed',
  'expression_evaluation_failed',
  'step_output_not_storable',
  'branch_no_matching_edge',
  'fan_out_items_not_a_list',
  'loop_max_iterations_reached',
  'approval_timed_out',
  'sub_workflow_failed',
  'workflow_recursion_detected',
  'unresolvable_step_reference',
  'script_evaluation_failed',
  'script_timed_out',
  'script_output_not_json',
  'unhandled_error_kind',
];

describe('isHandledErrorKind', () => {
  it('mind a huszonnégy értékre igazat ad', () => {
    expect(allHandledErrorKinds.every((kind) => isHandledErrorKind(kind))).toBe(true);
    expect(new Set(allHandledErrorKinds).size).toBe(24);
  });

  it('hamisat ad a lista kívüli motor hibaosztályra és a régi szabad szöveges értékre', () => {
    // A futás indításának validációs osztálya és a másik két menekülő él osztálya
    // nem juthat el a kezelőig (SPEC-004 8.2).
    expect(isHandledErrorKind('graph_cycle_detected')).toBe(false);
    expect(isHandledErrorKind('approval_rejected')).toBe(false);
    expect(isHandledErrorKind('retry_attempts_exhausted')).toBe(false);
    expect(isHandledErrorKind('timeout')).toBe(false);
    expect(isHandledErrorKind('')).toBe(false);
    expect(isHandledErrorKind('Provider_call_failed')).toBe(false);
    // A `Record` alapú keresés nem eshet át a prototípus láncra.
    expect(isHandledErrorKind('toString')).toBe(false);
    expect(isHandledErrorKind('constructor')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isHandledErrorKind(undefined)).toBe(false);
    expect(isHandledErrorKind(7)).toBe(false);
    expect(isHandledErrorKind(['provider_call_failed'])).toBe(false);
  });
});
