import type { EngineErrorKind } from '@easter-workflow-builder/engine';
import type { ProtocolErrorCode } from '@easter-workflow-builder/protocol';
import { extractTrailingErrorClass } from './extract-trailing-error-class.ts';

/**
 * A `conflict` kódra képződő hibaosztályok (SPEC-005 8.3 táblázat 2. és 4.
 * sora): az erőforrás létezik, csak az állapota vagy egy egyidejű írás
 * akadályozza a műveletet. Az `already_decided` a `decideApproval` C
 * táblázat 18. sorának saját hibaága (`packages/db`
 * `human-approval-repository.ts`): a jóváhagyás már el van döntve.
 */
const CONFLICT_ERROR_CLASSES: ReadonlySet<string> = new Set([
  'illegal_status_transition',
  'foreign_key_violation',
  'duplicate_event',
  'graph_snapshot_hash_collision',
  'already_decided',
]);

/**
 * A motor futás indítási validációjának hibaosztályai (SPEC-005 8.3 táblázat
 * "minden motor eredetű validációs hibaosztály" sora): a SPEC-004 4.2, 4.5,
 * 4.6, 4.7, 4.8 és 8.2 gráf, config és bemenet ellenőrzései, a 11.1 provider
 * feloldás és a 11.3 leíró alapú ellenőrzések, plusz az
 * `expression_evaluator_unavailable` (SPEC-004 O-1, a motor kimondottan
 * elutasító kifejezés/sablon port implementációja). A `satisfies` a sodródás
 * védelem típusszintű ága: egy átnevezett vagy elvett hibaosztály a
 * `typecheck` kapun bukik, ahelyett hogy csendben `internal` kódra esne.
 *
 * 2026-09-26-ig a 4.2, 4.5, 4.6, 4.8, 8.2 és 11.3 osztályai hiányoztak
 * innen, tehát például a `graph_cycle_detected` és a `missing_required_input`
 * `500 internal` választ adott a 8.3 szerinti `422 unprocessable` helyett.
 */
const ENGINE_VALIDATION_ERROR_CLASSES = [
  'no_default_provider',
  'graph_cycle_detected',
  'loop_back_edge_outside_body',
  'loop_missing_branch_edge',
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
  'insufficient_backoff_list',
  'missing_required_input',
  'structured_output_strategy_unsupported',
  'insufficient_max_turns',
  'forced_tool_choice_silently_dropped',
  'model_not_selected',
  'unknown_model_id',
  'thinking_mode_unsupported',
  'effort_unsupported',
  'provider_descriptor_sdk_mismatch',
  'expression_evaluator_unavailable',
] satisfies readonly EngineErrorKind[];

/**
 * Az `unprocessable` kódra képződő hibaosztályok (SPEC-005 8.3 táblázat 3.,
 * 5. és 7. sora): a tárolt/küldött gráf dokumentum feldolgozhatatlan hibái
 * (`packages/db`), és a motor validációs hibaosztályai.
 */
const UNPROCESSABLE_ERROR_CLASSES: ReadonlySet<string> = new Set([
  'malformed_graph_document',
  'unknown_graph_document_version',
  'non_canonicalizable_value',
  ...ENGINE_VALIDATION_ERROR_CLASSES,
]);

/**
 * A `service_unavailable` kódra (HTTP 503) képződő egyetlen hibaosztály: a
 * leálló motor az új futást (SPEC-004 10.2 1. pont) és a felhasználói
 * megszakítást (9. szekció, user döntés 2026-09-24) ezzel utasítja el. A
 * folyamat átmeneti állapota, nem a kérésé, ami pontosan a 503 jelentése
 * (RFC 9110 15.6.4). A `satisfies` a sodródás védelem típusszintű ága: ha a
 * motor átnevezi vagy elveszi a hibaosztályt, a `typecheck` kapu bukik,
 * ahelyett hogy a leképezés csendben `internal` kódra esne vissza.
 */
const SERVICE_UNAVAILABLE_ERROR_CLASS = 'engine_shutting_down' satisfies EngineErrorKind;

/**
 * A SPEC-005 8.3 táblázat megvalósítása: az `Outcome` hibaágának üzenetéből
 * a zárójelben álló hibaosztály nevet olvassa ki, és `ProtocolErrorCode`
 * értékre képezi. A be nem sorolt eset - beleértve azt, amikor a hibaosztály
 * neve nem a zárójelben, hanem az üzenet szabad szövegében fordul elő -
 * `internal` kódot kap, kedvezőbb besorolás nélkül.
 *
 * Az `invalid_request` a végpont kezelők saját hibaosztálya a kérés törzs
 * vagy query séma hibájára és az ismeretlen `providerId` értékre
 * (`zodErrorToProtocolErrorBody`, `create-workflow.ts`): a SPEC-005 8.2
 * szerint `400`. 2026-09-26-ig ez is `internal` (500) lett, mert a leképezés
 * csak a törzs olvasás JSON hibáját ismerte (`create-http-server.ts`).
 */
export function mapOutcomeMessageToErrorCode(message: string): ProtocolErrorCode {
  const errorClass = extractTrailingErrorClass(message);
  if (errorClass === undefined) {
    return 'internal';
  }
  if (errorClass === 'invalid_request') {
    return 'invalid_request';
  }
  if (errorClass === 'not_found') {
    return 'not_found';
  }
  if (CONFLICT_ERROR_CLASSES.has(errorClass)) {
    return 'conflict';
  }
  if (UNPROCESSABLE_ERROR_CLASSES.has(errorClass)) {
    return 'unprocessable';
  }
  if (errorClass === SERVICE_UNAVAILABLE_ERROR_CLASS) {
    return 'service_unavailable';
  }
  // A `database_closed` (8.3 6. sora) és minden más be nem sorolt eset itt esik: `internal`.
  return 'internal';
}
