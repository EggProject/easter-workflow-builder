import { z } from 'zod';

/**
 * A `run_event.origin` két lehetséges értéke, drótszintű felsorolásként
 * (SPEC-003 6.2 szekció). A `db` réteg ezt raw `string` oszlopként tárolja,
 * nincs hozzá exportált típus vagy guard (`packages/db/src/run-event/event-record/run-event.ts`,
 * "Az origin szándékosan raw string marad"), tehát ez **nem** tagja a hat
 * sodródás védett felsorolásnak (SPEC-005 7.6): a `protocol` maga dönti el,
 * milyen zárt halmazt enged a dróton.
 */
export const RunEventOriginSchema = z.enum(['sdk', 'engine']);

export type RunEventOrigin = z.infer<typeof RunEventOriginSchema>;

/**
 * A `run_event.kind` 25 lehetséges értéke, drótszintű felsorolásként
 * (SPEC-003 6.4 szekció, szó szerint). A `protocol` L1, tehát a `db` (L2)
 * `RunEventKind` unióját nem importálhatja: szándékos duplikáció, a
 * sodródás védelmét az `apps/server` regressziós tesztje adja (T-006-12).
 */
export const RunEventKindSchema = z.enum([
  // sdk eredetű, 12 érték
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
  // engine eredetű, 13 érték
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
]);

export type RunEventKind = z.infer<typeof RunEventKindSchema>;
