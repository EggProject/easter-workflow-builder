import { isString } from '@easter-workflow-builder/typeguards';
import type { HandledErrorKind } from './handled-error-kind.ts';

/**
 * Az unió értékei kulcsonként. A `Record<HandledErrorKind, true>` annotáció miatt
 * a fordító hibát ad, ha az unió bővül, de ez a lista nem (ugyanaz a minta, mint
 * az `is-start-input-value-kind.ts` kulcslistája).
 */
const HANDLED_ERROR_KIND_KEYS: Readonly<Record<HandledErrorKind, true>> = {
  provider_call_failed: true,
  agent_result_not_success: true,
  missing_structured_output: true,
  structured_output_schema_mismatch: true,
  no_resumable_session: true,
  missing_provider_env: true,
  mcp_server_not_found: true,
  missing_mcp_server_env: true,
  mcp_server_connection_failed: true,
  agent_skill_not_in_step: true,
  template_render_failed: true,
  expression_evaluation_failed: true,
  step_output_not_storable: true,
  branch_no_matching_edge: true,
  fan_out_items_not_a_list: true,
  loop_max_iterations_reached: true,
  approval_timed_out: true,
  sub_workflow_failed: true,
  workflow_recursion_detected: true,
  unresolvable_step_reference: true,
  script_evaluation_failed: true,
  script_timed_out: true,
  script_output_not_json: true,
  unhandled_error_kind: true,
};

/**
 * A `HandledErrorKind` értékek egyike-e a bemenet (SPEC-004 8.2, O-5).
 */
export function isHandledErrorKind(value: unknown): value is HandledErrorKind {
  return isString(value) && Object.hasOwn(HANDLED_ERROR_KIND_KEYS, value);
}
