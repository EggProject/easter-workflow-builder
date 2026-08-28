import { describe, expect, it } from 'vitest';
import type { EngineErrorKind } from './engine-error-kind.ts';
import { isEngineErrorKind } from './is-engine-error-kind.ts';

// Az `engine-error-kind.ts` mind a negyvenhárom értéke, ugyanabban a
// sorrendben. Az `EngineErrorKind[]` annotáció fordítási idejű állítás is: ha
// az unió bővül vagy szűkül, ez a lista nem maradhat érintetlenül.
const allEngineErrorKinds: readonly EngineErrorKind[] = [
  'graph_cycle_detected',
  'loop_back_edge_outside_body',
  'loop_missing_branch_edge',
  'loop_max_iterations_reached',
  'reserved_branch_key_misuse',
  'unbalanced_fan_out_scope',
  'invalid_start_node',
  'dangling_edge',
  'unreachable_node',
  'unimplemented_node_type',
  'branch_key_unknown',
  'invalid_error_handler_edge',
  'malformed_node_config',
  'unhandled_error_policy_missing',
  'unsupported_join_merge_setting',
  'missing_required_input',
  'expression_evaluation_failed',
  'template_render_failed',
  'agent_result_not_success',
  'missing_structured_output',
  'provider_call_failed',
  'no_resumable_session',
  'branch_no_matching_edge',
  'fan_out_items_not_a_list',
  'approval_timed_out',
  'approval_rejected',
  'retry_attempts_exhausted',
  'unhandled_error_kind',
  'insufficient_backoff_list',
  'workflow_recursion_detected',
  'sub_workflow_failed',
  'unresolvable_step_reference',
  'no_default_provider',
  'structured_output_strategy_unsupported',
  'insufficient_max_turns',
  'forced_tool_choice_silently_dropped',
  'model_not_selected',
  'unknown_model_id',
  'thinking_mode_unsupported',
  'effort_unsupported',
  'provider_descriptor_sdk_mismatch',
  'expression_evaluator_unavailable',
  'missing_provider_env',
];

describe('isEngineErrorKind', () => {
  it('mind a negyvenhárom ágra igazat ad', () => {
    expect(allEngineErrorKinds.every((kind) => isEngineErrorKind(kind))).toBe(true);
    expect(allEngineErrorKinds).toHaveLength(43);
  });

  it('hamisat ad ismeretlen szövegre', () => {
    expect(isEngineErrorKind('unknown_error')).toBe(false);
    expect(isEngineErrorKind('')).toBe(false);
    // A `Record` alapú keresés nem eshet át a prototípus láncra.
    expect(isEngineErrorKind('toString')).toBe(false);
    expect(isEngineErrorKind('constructor')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isEngineErrorKind(undefined)).toBe(false);
    expect(isEngineErrorKind(7)).toBe(false);
    expect(isEngineErrorKind({ kind: 'graph_cycle_detected' })).toBe(false);
    expect(isEngineErrorKind(['graph_cycle_detected'])).toBe(false);
  });
});
