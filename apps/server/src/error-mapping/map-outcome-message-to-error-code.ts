import type { ProtocolErrorCode } from '@easter-workflow-builder/protocol';

/**
 * A hibaosztály neve mindig a zárójelben, az üzenet VÉGÉN áll, egy opcionális
 * záró pont előtt (F-22, pl. `... (not_found).`). Az üzenet elején is
 * előfordulhat zárójel ("A(z) ..."), ezért a mintát a string VÉGÉHEZ
 * horgonyozzuk, nem az első találatot vesszük.
 */
const TRAILING_ERROR_CLASS_PATTERN = /\(([a-z0-9_]+)\)\.?\s*$/;

/**
 * A `conflict` kódra képződő hibaosztályok (SPEC-005 8.3 táblázat 2. és 4.
 * sora): az erőforrás létezik, csak az állapota vagy egy egyidejű írás
 * akadályozza a műveletet.
 */
const CONFLICT_ERROR_CLASSES: ReadonlySet<string> = new Set([
  'illegal_status_transition',
  'foreign_key_violation',
  'duplicate_event',
  'graph_snapshot_hash_collision',
]);

/**
 * Az `unprocessable` kódra képződő hibaosztályok (SPEC-005 8.3 táblázat 3.,
 * 5. és 7. sora): a `no_default_provider`, a tárolt/küldött gráf dokumentum
 * feldolgozhatatlan hibái, és a SPEC-004 4.7 táblázat gráf validációs
 * hibaosztályai, plusz az `expression_evaluator_unavailable` (SPEC-004 O-1,
 * a motor kimondottan elutasító kifejezés/sablon port implementációja).
 */
const UNPROCESSABLE_ERROR_CLASSES: ReadonlySet<string> = new Set([
  'no_default_provider',
  'malformed_graph_document',
  'unknown_graph_document_version',
  'non_canonicalizable_value',
  'invalid_start_node',
  'dangling_edge',
  'unreachable_node',
  'unimplemented_node_type',
  'branch_key_unknown',
  'invalid_error_handler_edge',
  'malformed_node_config',
  'unhandled_error_policy_missing',
  'unsupported_join_merge_setting',
  'expression_evaluator_unavailable',
]);

function extractTrailingErrorClass(message: string): string | undefined {
  const match = TRAILING_ERROR_CLASS_PATTERN.exec(message);
  return match?.[1];
}

/**
 * A SPEC-005 8.3 táblázat megvalósítása: az `Outcome` hibaágának üzenetéből
 * a zárójelben álló hibaosztály nevet olvassa ki, és `ProtocolErrorCode`
 * értékre képezi. A be nem sorolt eset - beleértve azt, amikor a hibaosztály
 * neve nem a zárójelben, hanem az üzenet szabad szövegében fordul elő -
 * `internal` kódot kap, kedvezőbb besorolás nélkül.
 */
export function mapOutcomeMessageToErrorCode(message: string): ProtocolErrorCode {
  const errorClass = extractTrailingErrorClass(message);
  if (errorClass === undefined) {
    return 'internal';
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
  // A `database_closed` (8.3 6. sora) és minden más be nem sorolt eset itt esik: `internal`.
  return 'internal';
}
