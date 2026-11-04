import { describe, expect, it } from 'vitest';
import type { EngineErrorKind } from './engine-error-kind.ts';
import { formatEngineErrorMessage } from './format-engine-error-message.ts';

// Az `engine-error-kind.ts` mind a hatvan értéke, ugyanabban a
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
  'missing_required_input',
  'invalid_input_type',
  'expression_evaluation_failed',
  'template_render_failed',
  'agent_result_not_success',
  'missing_structured_output',
  'structured_output_schema_mismatch',
  'invalid_structured_output_schema',
  'provider_call_failed',
  'no_resumable_session',
  'branch_no_matching_edge',
  'fan_out_items_not_a_list',
  'step_output_not_storable',
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
  'missing_provider_env',
  'skill_not_found',
  'mcp_server_not_found',
  'mcp_server_connection_failed',
  'agent_skill_not_in_step',
  'agent_mcp_server_override_conflict',
  'missing_mcp_server_env',
  'unknown_concurrency_slot',
  'run_execution_failed',
  'malformed_restart_source_input',
  'engine_shutting_down',
  'run_stalled',
  'script_compile_failed',
  'script_evaluation_failed',
  'script_timed_out',
  'script_output_not_json',
];

describe('formatEngineErrorMessage', () => {
  it('mind a hatvan hibaosztályra a "detail (kind)." alakot adja', () => {
    for (const kind of allEngineErrorKinds) {
      expect(formatEngineErrorMessage(kind, 'A lépés nem futtatható')).toBe(`A lépés nem futtatható (${kind}).`);
    }
  });

  it('a detail szöveget változatlanul, a végére fűzve adja vissza', () => {
    expect(formatEngineErrorMessage('graph_cycle_detected', 'Kör található a gráfban')).toBe(
      'Kör található a gráfban (graph_cycle_detected).',
    );
  });
});
