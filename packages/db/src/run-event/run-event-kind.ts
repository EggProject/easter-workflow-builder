/**
 * A `run_event.kind` oszlop huszonöt lehetséges értéke (SPEC-003 6.4
 * szekció, szó szerint). A `kind` oszlop a séma szintjén `text` marad,
 * `CHECK` constraint nélkül: egy új SDK üzenettípus különben migrációt
 * igényelne. A szűkítést a `RunEventKind` unió és az `isRunEventKind` guard
 * adja a repository határon (T-003-21).
 *
 * **Tizenkettő `sdk` eredetű**, a research 1. szekció `SDKMessage` uniója
 * szerint, egy az egyben.
 *
 * **Tizenhárom `engine` eredetű**, a jóváhagyott node típusokhoz kötve.
 */
export type RunEventKind =
  // sdk eredetű, 12 érték
  | 'sdk_system'
  | 'sdk_assistant'
  | 'sdk_user'
  | 'sdk_stream_event'
  | 'sdk_result'
  | 'sdk_hook_started'
  | 'sdk_hook_progress'
  | 'sdk_hook_response'
  | 'sdk_informational'
  | 'sdk_commands_changed'
  | 'sdk_rate_limit'
  | 'sdk_context_usage'
  // engine eredetű, 13 érték
  | 'run_started'
  | 'run_finished'
  | 'run_interrupted'
  | 'step_started'
  | 'step_finished'
  | 'branch_taken'
  | 'fan_out_expanded'
  | 'join_resolved'
  | 'loop_iteration_started'
  | 'approval_requested'
  | 'approval_decided'
  | 'sub_workflow_started'
  | 'sub_workflow_finished';
