/**
 * A motor hibaosztályainak zárt szótára. Minden tag a SPEC-004 dokumentum
 * végigfésülésével gyűlt össze (4.2, 4.5, 4.6, 4.7, 4.8, 5., 6.2, 6.3, 8.2,
 * 8.3, 11.1, 11.3 és 15. szekció O-1 sora), plusz a `missing_provider_env`,
 * ami csak a PLAN-005 T-005-14 elfogadási kritériumában szerepel névvel.
 *
 * **Nyitott unió.** Ez a lista a jelen lépés (T-005-8) idején teljes, de a
 * motor hátralévő fázisai (F4-F7) bővíthetik, ha a spec további részének
 * végrehajtása közben újabb hibaosztály derül ki: ez természetes növekedés,
 * nem hiba. Egy bővítéskor az `isEngineErrorKind` guard `ENGINE_ERROR_KIND_KEYS`
 * rekordja és a `format-engine-error-message.spec.ts` teszt listája is
 * kötelezően bővül, mert a `Record<EngineErrorKind, true>` annotáció ezt
 * fordítási hibával kikényszeríti.
 */
export type EngineErrorKind =
  // 4.6: a `loop` node visszaéle és a gráf alak validációja
  | 'graph_cycle_detected'
  | 'loop_back_edge_outside_body'
  | 'loop_missing_branch_edge'
  | 'loop_max_iterations_reached'
  // 4.2, 4.5: fenntartott `branch_key` és hatókör kiegyensúlyozottság
  | 'reserved_branch_key_misuse'
  | 'unbalanced_fan_out_scope'
  // 4.7: egyéb gráf validációk
  | 'invalid_start_node'
  | 'dangling_edge'
  | 'unreachable_node'
  | 'unimplemented_node_type'
  | 'branch_key_unknown'
  | 'invalid_error_handler_edge'
  | 'malformed_node_config'
  | 'unhandled_error_policy_missing'
  | 'unsupported_join_merge_setting'
  // 4.8: a futás indításának validációja
  | 'missing_required_input'
  // 5.: a kifejezés és a sablon port hibaágai, minden node típusnál közösek
  | 'expression_evaluation_failed'
  | 'template_render_failed'
  // 5.2: az `agent_step` életciklusa
  | 'agent_result_not_success'
  | 'missing_structured_output'
  | 'provider_call_failed'
  // 6.3: a session modell
  | 'no_resumable_session'
  // 5.: `branch` és `fan_out` saját hibaágai
  | 'branch_no_matching_edge'
  | 'fan_out_items_not_a_list'
  // 5.8: a `human_approval` várakozás
  | 'approval_timed_out'
  | 'approval_rejected'
  // 8.2: az `error_handler` node
  | 'retry_attempts_exhausted'
  | 'unhandled_error_kind'
  | 'insufficient_backoff_list'
  // 5.9: a `sub_workflow` hívás, 6.2 a `steps` hivatkozás feloldása
  | 'workflow_recursion_detected'
  | 'sub_workflow_failed'
  | 'unresolvable_step_reference'
  // 11.1: a háromszintű provider feloldás
  | 'no_default_provider'
  // 11.3: a leírótól függő tizenhat viselkedés
  | 'structured_output_strategy_unsupported'
  | 'insufficient_max_turns'
  | 'forced_tool_choice_silently_dropped'
  | 'model_not_selected'
  | 'unknown_model_id'
  | 'thinking_mode_unsupported'
  | 'effort_unsupported'
  | 'provider_descriptor_sdk_mismatch'
  // 15. O-1: a kifejezés port hiánya
  | 'expression_evaluator_unavailable'
  // PLAN-005 T-005-14: a `provider-environment` téma, hiányzó kötelező env változó
  | 'missing_provider_env'
  // 7.: a párhuzamossági szabályozó, ismeretlen azonosító felszabadítása
  | 'unknown_concurrency_slot'
  // 9. szekció zárómondat, PLAN-005 T-005-27: a `restartRun` művelet - az
  // eredeti futás `input` mezője a `db` rétegben `unknown` (nem `Record`), a
  // `StartRunRequest.input` viszont `Readonly<Record<string, unknown>>`-ot
  // vár. Ez NEM csak korrupt adatra fordul elő: a `WorkflowRunRepository.startRun`
  // bemeneti típusa (`StartRunInput.input: unknown`) sem kényszeríti ki a
  // rekord alakot a `db` rétegben, tehát a motor felett álló, más hívó is
  // adhatott korábban nem rekord bemenetet (lásd `run-supervisor/restart-run.ts`).
  | 'malformed_restart_source_input'
  // 4.4, 4.8: a futás léptetése közben történt, NEM lépés szintű hiba
  // (PLAN-005 T-005-25). Két forrása van, és mindkettő megállítja a futást:
  // egy végrehajtó `Outcome` hibaága (adatbázis hiba, ami nem a lépés saját
  // hibaága, lásd `node-executor` téma "a visszatérési érték két szintű"),
  // illetve a futás állapotának belső ellentmondása - ma egyetlen ilyen van,
  // egy `error_handler` példány, ami nem `on_error` élen vált futtathatóvá,
  // tehát nincs hozzá hibakontextus (a 4.7 validáció csak az `on_error` élek
  // CÉLJÁT köti `error_handler` node-hoz, a fordítottját nem). Ilyenkor a
  // motor nem talál ki hibaosztályt és kísérletszámot, hanem megnevezett
  // hibával leállítja a futást.
  | 'run_execution_failed';
