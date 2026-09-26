import type { ProtocolErrorClass } from '@easter-workflow-builder/protocol';

/**
 * A protokoll zárt hibaosztály szótárának magyar mondatai (SPEC-007 8.4,
 * user döntés 2026-09-26, "Ismert okokra saját mondat"). A mondat az okot
 * nevezi meg a felület szavaival (csomópont nevek a `graph-node-catalog`
 * szerint), a szerver `message` szövegét nem elemzi és nem idézi. A
 * `Record` annotáció kimerítő: egy új szótár tag a `protocol` csomagban
 * fordítási hibát ad, amíg ide nem kerül a mondata.
 *
 * Ez megjelenítés, nem validáció: a gráf szemantikai ellenőrzése
 * kizárólag a szerveren fut (SPEC-008 5.4).
 */
const PROTOCOL_ERROR_CLASS_MESSAGES: Readonly<Record<ProtocolErrorClass, string>> = {
  graph_cycle_detected: 'A gráf Ciklus csomópont nélküli kört tartalmaz.',
  loop_back_edge_outside_body:
    'Egy Ciklus csomópontba visszavezető él olyan csomópontból indul, amely nem a ciklus Folytatás ágán áll.',
  loop_missing_branch_edge: 'Egy Ciklus csomópontnak nincs Folytatás vagy Kilépés kimenő éle.',
  reserved_branch_key_misuse: 'Egy Elágazás csomópont ága fenntartott kulcsnevet használ.',
  unbalanced_fan_out_scope: 'A Szétosztás és az Összefésülés csomópontok nem alkotnak zárt párokat.',
  invalid_start_node: 'A gráfban pontosan egy Indítás csomópontnak kell lennie.',
  dangling_edge: 'A gráf egyik éle nem létező csomópontra hivatkozik.',
  unreachable_node: 'A gráf egyik csomópontja nem érhető el az Indítás csomópontból.',
  unimplemented_node_type: 'A gráf szkriptet futtató lépést tartalmaz, amit a rendszer még nem hajt végre.',
  branch_key_unknown:
    'Egy Elágazás csomópont éle vagy alapértelmezett ága olyan kulcsra hivatkozik, ami nincs az ágai között.',
  invalid_error_handler_edge: 'Egy Hiba esetén él nem Hibakezelő csomópontra mutat.',
  malformed_node_config: 'Egy csomópont beállításai hibásak.',
  unhandled_error_policy_missing: 'Egy csomópontnál nincs beállítva, mi történjen kezeletlen hiba esetén.',
  unsupported_join_merge_setting: 'Egy Összefésülés csomópont összefésülés módja ismeretlen beállítást tartalmaz.',
  insufficient_backoff_list:
    'Egy Hibakezelő csomópont várakozási listája rövidebb, mint amit a próbálkozások száma megkövetel.',
  missing_required_input: 'A futás egy kötelező bemeneti mezője hiányzik.',
  no_default_provider: 'Nincs alapértelmezett provider beállítva.',
  structured_output_strategy_unsupported:
    'Egy lépés strukturált kimenet stratégiáját a választott provider nem támogatja.',
  insufficient_max_turns: 'Egy lépés körszáma kevesebb, mint amennyit a strukturált kimenet stratégiája igényel.',
  forced_tool_choice_silently_dropped:
    'Egy lépés kényszerített eszközválasztást igényel, amit a választott provider csendben figyelmen kívül hagyna.',
  model_not_selected: 'Egy lépéshez modellt kell választani, mert a providernek több modellje van.',
  unknown_model_id: 'Egy lépés olyan modellt választ, amit a provider nem ismer.',
  thinking_mode_unsupported: 'Egy lépés thinking módját a választott modell nem támogatja.',
  effort_unsupported: 'Egy lépés effort beállítását a választott provider nem támogatja.',
  provider_descriptor_sdk_mismatch: 'A provider leírója nem a telepített Agent SDK verzióhoz készült.',
  already_decided: 'Ezt a jóváhagyást már eldöntötték.',
};

export function protocolErrorClassMessage(errorClass: ProtocolErrorClass): string {
  return PROTOCOL_ERROR_CLASS_MESSAGES[errorClass];
}
