import { z } from 'zod';

/**
 * A hibaosztályok zárt szótára, amiket a kliens a felhasználónak saját
 * mondattal nevez meg (SPEC-005 8.5, user döntés 2026-09-26, "Ismert okokra
 * saját mondat"). A tagok a szerver hibaosztályainak szándékos részhalmaza:
 * a futás indításának minden validációs hibaosztálya (SPEC-004 4.2, 4.5,
 * 4.6, 4.7, 4.8, 8.2 és 11.3, a motor `validateRun` és `prepareRun` útja,
 * plusz a SPEC-010 9.2 sablon és kifejezés fordítási ellenőrzése és a
 * SPEC-009 5.1 skill hivatkozás ellenőrzése),
 * plusz a jóváhagyás `already_decided` ága (`packages/db`
 * `human-approval-repository.ts`), plusz a skill feltöltés tizenöt szerver
 * oldali elutasítási osztálya (SPEC-009 5.4, O-41, user döntés 2026-10-28;
 * az `apps/server` `skill-endpoint` témájának `SKILL_UPLOAD_ERROR_CLASSES`
 * táblája). A felsorolás a
 * `protocol` saját deklarációja, mert az L1 réteg a motor `EngineErrorKind`
 * unióját nem importálhatja; a sodródás védelmét az `apps/server`
 * `error-class-drift-protection` regressziós tesztje adja.
 */
export const ProtocolErrorClassSchema = z.enum([
  // SPEC-004 4.6: a gráf alakja és a `loop` node
  'graph_cycle_detected',
  'loop_back_edge_outside_body',
  'loop_missing_branch_edge',
  // SPEC-004 4.2 és 4.5: fenntartott ágkulcs, fan-out hatókör
  'reserved_branch_key_misuse',
  'unbalanced_fan_out_scope',
  // SPEC-004 4.7: egyéb gráf validációk
  'invalid_start_node',
  'dangling_edge',
  'unreachable_node',
  'unimplemented_node_type',
  'branch_key_unknown',
  'invalid_error_handler_edge',
  'malformed_node_config',
  'unhandled_error_policy_missing',
  // SPEC-004 8.2 3. pont: a hibakezelő várakozási listája
  'insufficient_backoff_list',
  // SPEC-004 4.8 4. lépés: a futás bemenete
  'missing_required_input',
  // SPEC-004 11.1: a provider feloldás
  'no_default_provider',
  // SPEC-010 9.2 és 9.3: a sablon és a kifejezés mezők fordítása (user döntés 2026-10-25)
  'template_render_failed',
  'expression_evaluation_failed',
  // SPEC-004 11.3: a leírótól függő validációk
  'structured_output_strategy_unsupported',
  'insufficient_max_turns',
  'forced_tool_choice_silently_dropped',
  'model_not_selected',
  'unknown_model_id',
  'thinking_mode_unsupported',
  'effort_unsupported',
  'provider_descriptor_sdk_mismatch',
  // SPEC-009 5.1 (O-13): a lépés skill hivatkozása nincs a skill könyvtárban
  'skill_not_found',
  // SPEC-009 6.4 (O-43, O-18): a lépés MCP hivatkozása nincs a központi
  // listában, illetve a hozzárendelt szerver oldali env változó nincs beállítva
  'mcp_server_not_found',
  'missing_mcp_server_env',
  // SPEC-005 4.2 18. végpont: a jóváhagyás már el van döntve
  'already_decided',
  // SPEC-009 5.4: a skill feltöltés elutasítási okai (O-41)
  'skill_archive_unreadable',
  'skill_archive_entry_type_unsupported',
  'skill_archive_unsafe_path',
  'skill_archive_path_collision',
  'skill_archive_layout_invalid',
  'skill_manifest_missing',
  'skill_manifest_duplicate',
  'skill_manifest_invalid',
  'skill_name_invalid',
  'skill_name_mismatch',
  'skill_archive_too_large',
  'skill_archive_too_many_entries',
  'skill_archive_entry_size_mismatch',
  'skill_archive_entry_encrypted',
  'skill_archive_compression_unsupported',
]);

export type ProtocolErrorClass = z.infer<typeof ProtocolErrorClassSchema>;
