import { isString } from '@easter-workflow-builder/typeguards';
import type { RunEventKind } from './run-event-kind.ts';

/**
 * A huszonöt ág kulcsonként. A `Record<RunEventKind, true>` annotáció miatt a
 * fordító hibát ad, ha a `RunEventKind` unió bővül, de ez a lista nem: a
 * guard így nem tud csendben lemaradni egy típusról (ugyanaz a minta, mint
 * az `is-node-type.ts` `NODE_TYPE_KEYS`-e).
 */
const RUN_EVENT_KIND_KEYS: Readonly<Record<RunEventKind, true>> = {
  sdk_system: true,
  sdk_assistant: true,
  sdk_user: true,
  sdk_stream_event: true,
  sdk_result: true,
  sdk_hook_started: true,
  sdk_hook_progress: true,
  sdk_hook_response: true,
  sdk_informational: true,
  sdk_commands_changed: true,
  sdk_rate_limit: true,
  sdk_context_usage: true,
  run_started: true,
  run_finished: true,
  run_interrupted: true,
  step_started: true,
  step_finished: true,
  branch_taken: true,
  fan_out_expanded: true,
  join_resolved: true,
  loop_iteration_started: true,
  approval_requested: true,
  approval_decided: true,
  sub_workflow_started: true,
  sub_workflow_finished: true,
};

/**
A huszonöt `RunEventKind` érték egyike-e a bemenet (SPEC-003 6.4 és 9.4 szekció).
*/
export function isRunEventKind(value: unknown): value is RunEventKind {
  return isString(value) && Object.hasOwn(RUN_EVENT_KIND_KEYS, value);
}
