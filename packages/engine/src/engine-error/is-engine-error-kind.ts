import { isString } from '@easter-workflow-builder/typeguards';
import type { EngineErrorKind } from './engine-error-kind.ts';

/**
 * A negyvenhárom ág kulcsonként. A `Record<EngineErrorKind, true>` annotáció
 * miatt a fordító hibát ad, ha az `EngineErrorKind` unió bővül, de ez a lista
 * nem: a guard így nem tud csendben lemaradni egy hibaosztályról (ugyanaz a
 * minta, mint az `is-node-type.ts` `NODE_TYPE_KEYS`-e és az
 * `is-run-event-kind.ts` `RUN_EVENT_KIND_KEYS`-e).
 */
const ENGINE_ERROR_KIND_KEYS: Readonly<Record<EngineErrorKind, true>> = {
  graph_cycle_detected: true,
  loop_back_edge_outside_body: true,
  loop_missing_branch_edge: true,
  loop_max_iterations_reached: true,
  reserved_branch_key_misuse: true,
  unbalanced_fan_out_scope: true,
  invalid_start_node: true,
  dangling_edge: true,
  unreachable_node: true,
  unimplemented_node_type: true,
  branch_key_unknown: true,
  invalid_error_handler_edge: true,
  malformed_node_config: true,
  unhandled_error_policy_missing: true,
  unsupported_join_merge_setting: true,
  missing_required_input: true,
  expression_evaluation_failed: true,
  template_render_failed: true,
  agent_result_not_success: true,
  missing_structured_output: true,
  provider_call_failed: true,
  no_resumable_session: true,
  branch_no_matching_edge: true,
  fan_out_items_not_a_list: true,
  approval_timed_out: true,
  approval_rejected: true,
  retry_attempts_exhausted: true,
  unhandled_error_kind: true,
  insufficient_backoff_list: true,
  workflow_recursion_detected: true,
  sub_workflow_failed: true,
  unresolvable_step_reference: true,
  no_default_provider: true,
  structured_output_strategy_unsupported: true,
  insufficient_max_turns: true,
  forced_tool_choice_silently_dropped: true,
  model_not_selected: true,
  unknown_model_id: true,
  thinking_mode_unsupported: true,
  effort_unsupported: true,
  provider_descriptor_sdk_mismatch: true,
  expression_evaluator_unavailable: true,
  missing_provider_env: true,
};

/**
A negyvenhárom `EngineErrorKind` érték egyike-e a bemenet (SPEC-004, lásd `engine-error-kind.ts`).
*/
export function isEngineErrorKind(value: unknown): value is EngineErrorKind {
  return isString(value) && Object.hasOwn(ENGINE_ERROR_KIND_KEYS, value);
}
