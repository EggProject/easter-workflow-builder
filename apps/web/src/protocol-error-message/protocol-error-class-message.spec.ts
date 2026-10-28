import { ProtocolErrorClassSchema, type ProtocolErrorClass } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { protocolErrorClassMessage } from './protocol-error-class-message.ts';
import { protocolErrorMessage } from './protocol-error-message.ts';

describe('protocolErrorClassMessage', () => {
  const cases: readonly (readonly [ProtocolErrorClass, string])[] = [
    ['graph_cycle_detected', 'A gráf olyan kört tartalmaz, amely nem egyetlen Ciklus csomóponton keresztül indul.'],
    [
      'loop_back_edge_outside_body',
      'Egy Ciklus csomópontba visszavezető él olyan csomópontból indul, amely nem a ciklus Folytatás ágán áll.',
    ],
    ['loop_missing_branch_edge', 'Egy Ciklus csomópontnak nincs Folytatás vagy Kilépés kimenő éle.'],
    ['reserved_branch_key_misuse', 'Egy Elágazás csomópont ága fenntartott kulcsnevet használ.'],
    ['unbalanced_fan_out_scope', 'A Szétosztás és az Összefésülés csomópontok nem alkotnak zárt párokat.'],
    ['invalid_start_node', 'A gráfban pontosan egy Indítás csomópontnak kell lennie.'],
    ['dangling_edge', 'A gráf egyik éle nem létező csomópontra hivatkozik.'],
    ['unreachable_node', 'A gráf egyik csomópontja nem érhető el az Indítás csomópontból.'],
    ['unimplemented_node_type', 'A gráf szkriptet futtató lépést tartalmaz, amit a rendszer még nem hajt végre.'],
    [
      'branch_key_unknown',
      'Egy Elágazás csomópont éle vagy alapértelmezett ága olyan kulcsra hivatkozik, ami nincs az ágai között.',
    ],
    ['invalid_error_handler_edge', 'Egy Hiba esetén él nem Hibakezelő csomópontra mutat.'],
    ['malformed_node_config', 'Egy csomópont beállításai hibásak.'],
    ['unhandled_error_policy_missing', 'Egy csomópontnál nincs beállítva, mi történjen kezeletlen hiba esetén.'],
    [
      'insufficient_backoff_list',
      'Egy Hibakezelő csomópont várakozási listája rövidebb, mint amit a próbálkozások száma megkövetel.',
    ],
    ['missing_required_input', 'A futás egy kötelező bemeneti mezője hiányzik.'],
    ['no_default_provider', 'Nincs alapértelmezett provider beállítva.'],
    [
      'structured_output_strategy_unsupported',
      'Egy lépés strukturált kimenet stratégiáját a választott provider nem támogatja.',
    ],
    ['insufficient_max_turns', 'Egy lépés körszáma kevesebb, mint amennyit a strukturált kimenet stratégiája igényel.'],
    [
      'forced_tool_choice_silently_dropped',
      'Egy lépés kényszerített eszközválasztást igényel, amit a választott provider csendben figyelmen kívül hagyna.',
    ],
    ['model_not_selected', 'Egy lépéshez modellt kell választani, mert a providernek több modellje van.'],
    ['unknown_model_id', 'Egy lépés olyan modellt választ, amit a provider nem ismer.'],
    ['thinking_mode_unsupported', 'Egy lépés thinking módját a választott modell nem támogatja.'],
    ['effort_unsupported', 'Egy lépés effort beállítását a választott provider nem támogatja.'],
    ['provider_descriptor_sdk_mismatch', 'A provider leírója nem a telepített Agent SDK verzióhoz készült.'],
    ['template_render_failed', 'A workflow egyik sablonja hibás, ezért a futás nem indítható.'],
    ['expression_evaluation_failed', 'A workflow egyik kifejezése hibás, ezért a futás nem indítható.'],
    ['skill_not_found', 'Egy lépés olyan skillre hivatkozik, ami nincs a skill könyvtárban.'],
    [
      'mcp_server_not_found',
      'Egy lépés olyan MCP szerverre hivatkozik, ami nincs a Beállítások MCP szerver listájában.',
    ],
    ['missing_mcp_server_env', 'Egy lépés MCP szerveréhez rendelt szerver oldali env változó nincs beállítva.'],
    ['already_decided', 'Ezt a jóváhagyást már eldöntötték.'],
    ['skill_archive_unreadable', 'A feltöltött fájl nem érvényes ZIP csomag.'],
    [
      'skill_archive_entry_type_unsupported',
      'A csomag nem támogatott bejegyzést tartalmaz, például szimbolikus linket.',
    ],
    ['skill_archive_unsafe_path', 'A csomag egyik bejegyzésének útvonala tiltott.'],
    [
      'skill_archive_path_collision',
      'A csomag két bejegyzésének útvonala azonos, vagy csak kis- és nagybetűben tér el.',
    ],
    ['skill_archive_layout_invalid', 'A csomag gyökerében nincs SKILL.md, és nem pontosan egy mappát tartalmaz.'],
    ['skill_manifest_missing', 'Hiányzik a SKILL.md.'],
    ['skill_manifest_duplicate', 'A skill gyökerében több SKILL.md áll.'],
    ['skill_manifest_invalid', 'A SKILL.md fejléce hibás.'],
    ['skill_name_invalid', 'A megadott skill név nem felel meg a névszabálynak.'],
    ['skill_name_mismatch', 'A SKILL.md fejlécében álló név eltér a megadott névtől.'],
    ['skill_archive_too_large', 'A csomag túl nagy.'],
    ['skill_archive_too_many_entries', 'A csomag túl sok fájlt tartalmaz.'],
    ['skill_archive_entry_size_mismatch', 'A csomag egyik bejegyzése sérült.'],
    ['skill_archive_entry_encrypted', 'A csomag titkosított bejegyzést tartalmaz.'],
    ['skill_archive_compression_unsupported', 'A csomag nem támogatott tömörítést használ.'],
  ];

  it.each(cases)('a(z) "%s" hibaosztályhoz a saját magyar mondatát rendeli', (errorClass, expected) => {
    expect(protocolErrorClassMessage(errorClass)).toBe(expected);
  });

  it('a teszt táblázata a protokoll szótár minden tagját lefedi, pontosan egyszer', () => {
    expect(new Set(cases.map(([errorClass]) => errorClass))).toStrictEqual(new Set(ProtocolErrorClassSchema.options));
    expect(cases).toHaveLength(ProtocolErrorClassSchema.options.length);
  });

  // Ugyanaz az írásjel szabály, mint a kód mondatánál (SPEC-007 8.4 1. pont):
  // egyetlen záró pont, kettőspont nélkül. A `SKILL.md` fájlnév pontja nem
  // mondatvégi írásjel (a SPEC-009 5.4 tábla mondatai a fájlt megnevezik),
  // ezért a fájlnév az ellenőrzés előtt pont nélküli alakra cserélődik.
  it.each(cases)('a(z) "%s" mondata egyetlen záró ponttal végződik, kettőspont nélkül', (errorClass) => {
    expect(protocolErrorClassMessage(errorClass).replaceAll('SKILL.md', 'SKILL')).toMatch(/^[^.:]+\.$/u);
  });

  it('egyik hibaosztály mondata sem azonos a saját hibakódja általános mondatával', () => {
    const codeSentences = new Set(
      (['invalid_request', 'not_found', 'conflict', 'unprocessable', 'internal', 'service_unavailable'] as const).map(
        (code) => protocolErrorMessage(code),
      ),
    );
    for (const [errorClass] of cases) {
      expect(codeSentences.has(protocolErrorClassMessage(errorClass))).toBe(false);
    }
  });
});
