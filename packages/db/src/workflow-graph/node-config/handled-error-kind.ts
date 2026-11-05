/**
 * Az `error_handler` node `handledErrorKinds` szűrőjének értékkészlete: zárt
 * felsorolás (SPEC-004 8.2, O-5, user döntés 2026-11-04, "Zárt lista"). A motor
 * `EngineErrorKind` uniójának az a része, ami a motor kódja szerint egy lépés
 * hibájaként eljuthat a kezelőig: egy végrehajtó `failed` kimenete, amit a
 * vezérlés az `on_error` élen visz tovább. A kiválasztás indoka osztályonként a
 * SPEC-004 8.2 szekciójában áll.
 *
 * A `db` a motor uniójától nem függhet (a motor függ a `db`-től), ezért az unió
 * itt önállóan áll; hogy minden tagja motor hibaosztály, azt az `apps/server`
 * `handled-error-kind-drift-protection` témája őrzi, a `protocol` duplikátumával
 * együtt. Az `isHandledErrorKind` guard szűkíti, minden úton (írás, olvasás, futás
 * indítás), visszafelé kompatibilitási ág nélkül.
 */
export type HandledErrorKind =
  // az agent lépés (és a `join` `ai_synthesis` módja) futása
  | 'provider_call_failed'
  | 'agent_result_not_success'
  | 'missing_structured_output'
  | 'structured_output_schema_mismatch'
  | 'no_resumable_session'
  | 'missing_provider_env'
  | 'mcp_server_not_found'
  | 'missing_mcp_server_env'
  | 'mcp_server_connection_failed'
  | 'agent_skill_not_in_step'
  // a sablon és a kifejezés kiértékelése, minden node típusnál közös
  | 'template_render_failed'
  | 'expression_evaluation_failed'
  // a lépés kimenete nem tárolható
  | 'step_output_not_storable'
  // a vezérlő node-ok saját hibái
  | 'branch_no_matching_edge'
  | 'fan_out_items_not_a_list'
  | 'loop_max_iterations_reached'
  | 'approval_timed_out'
  // az al-workflow hívás
  | 'sub_workflow_failed'
  | 'workflow_recursion_detected'
  | 'unresolvable_step_reference'
  // a szkript csomópont JavaScript útja
  | 'script_evaluation_failed'
  | 'script_timed_out'
  | 'script_output_not_json'
  // egy másik hibakezelő, aminek a szűrője nem illeszkedett, és saját `on_error` éle van
  | 'unhandled_error_kind';
