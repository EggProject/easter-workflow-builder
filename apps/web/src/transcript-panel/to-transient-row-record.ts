import type {
  RunEventKind,
  RunEventOrigin,
  RunEventRecord,
  RunEventTransientFrame,
} from '@easter-workflow-builder/protocol';

/**
 * Minden `kind` érték eredete, a SPEC-003 6.4 szekció felosztása szerint
 * (tizenkét `sdk`, tizenhárom `engine` eredetű érték). Az átmeneti keretnek
 * nincs `origin` mezője (SPEC-005 5.4 táblázat), a sor jelölő oszlopához
 * (SPEC-008 7.2 4. pont) viszont kell: a spec szerint a `kind` egyértelműen
 * meghatározza. A `Record` típus kimerítő, tehát egy huszonhatodik `kind`
 * érték a `protocol` csomagban itt fordítási hibát ad.
 */
const RUN_EVENT_KIND_ORIGIN: Readonly<Record<RunEventKind, RunEventOrigin>> = {
  sdk_system: 'sdk',
  sdk_assistant: 'sdk',
  sdk_user: 'sdk',
  sdk_stream_event: 'sdk',
  sdk_result: 'sdk',
  sdk_hook_started: 'sdk',
  sdk_hook_progress: 'sdk',
  sdk_hook_response: 'sdk',
  sdk_informational: 'sdk',
  sdk_commands_changed: 'sdk',
  sdk_rate_limit: 'sdk',
  sdk_context_usage: 'sdk',
  run_started: 'engine',
  run_finished: 'engine',
  run_interrupted: 'engine',
  step_started: 'engine',
  step_finished: 'engine',
  branch_taken: 'engine',
  fan_out_expanded: 'engine',
  join_resolved: 'engine',
  loop_iteration_started: 'engine',
  approval_requested: 'engine',
  approval_decided: 'engine',
  sub_workflow_started: 'engine',
  sub_workflow_finished: 'engine',
};

/**
 * Egy átmeneti (`run_event_transient`) keret a transcript sor rekord
 * alakjában (SPEC-008 7.5, PLAN-009 T-009-26), hogy ugyanaz a `RunEventRow`
 * rajzolja, mint a perzisztált sort.
 *
 * **Azonosító nélkül**: a keretnek nincs `id` mezője (SPEC-008 M-64), és egy
 * kitalált azonosító összekeverhető volna a perzisztált sorokéval. A keret
 * által nem hordozott normalizált mezők (az SDK üzenet típusa, a session,
 * az eszközhívás, a négy token szám, a fordulók száma) `null` értéket
 * kapnak, ami a `RunEventRecord` szerződése szerint "nincs ilyen adat". A
 * nyers `payload` változatlanul átkerül, tehát a kinyitott sor a teljes
 * üzenetet mutatja.
 */
export function toTransientRowRecord(frame: RunEventTransientFrame): Omit<RunEventRecord, 'id'> {
  /* eslint-disable unicorn/no-null -- a RunEventRecord nullázható mezőinek "nincs adat" értéke a protokoll szerint `null`, nem `undefined` (packages/protocol/src/transcript/run-event-record.ts) */
  return {
    runId: frame.runId,
    stepRunId: frame.stepRunId,
    origin: RUN_EVENT_KIND_ORIGIN[frame.kind],
    kind: frame.kind,
    occurredAtMs: frame.occurredAtMs,
    sdkMessageType: null,
    sdkMessageSubtype: null,
    sdkSessionId: null,
    sdkUuid: null,
    parentToolUseId: null,
    toolName: null,
    toolUseId: null,
    inputTokens: null,
    outputTokens: null,
    cacheReadInputTokens: null,
    cacheCreationInputTokens: null,
    numTurns: null,
    payload: frame.payload,
  };
  /* eslint-enable unicorn/no-null */
}
