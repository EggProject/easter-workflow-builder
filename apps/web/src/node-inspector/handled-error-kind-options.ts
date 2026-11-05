import { HandledErrorKindSchema, type HandledErrorKind } from '@easter-workflow-builder/protocol';

/**
 * A kezelt hibafajták választójának csoportjai (SPEC-004 8.2, O-5): a hibát adó
 * csomópont fajtája szerint, a `graph-node-catalog` neveivel.
 */
type HandledErrorKindGroup = 'agent' | 'language' | 'control' | 'sub_workflow' | 'script';

const GROUP_TITLES: Readonly<Record<HandledErrorKindGroup, string>> = {
  agent: 'Agent lépés',
  language: 'Sablon, kifejezés és kimenet',
  control: 'Vezérlő csomópontok',
  sub_workflow: 'Al-workflow',
  script: 'Szkript',
};

const GROUP_ORDER: readonly HandledErrorKindGroup[] = ['agent', 'language', 'control', 'sub_workflow', 'script'];

/**
 * Hibafajtánként a csoport és a magyar felirat. A mondat az okot nevezi meg a
 * felület szavaival, ugyanúgy, mint a `protocol-error-class-message.ts` mondatai;
 * a `Record` annotáció kimerítő, tehát egy új tag a `protocol` listájában
 * fordítási hibát ad, amíg ide nem kerül.
 */
const HANDLED_ERROR_KIND_ENTRIES: Readonly<
  Record<HandledErrorKind, { readonly group: HandledErrorKindGroup; readonly label: string }>
> = {
  provider_call_failed: {
    group: 'agent',
    label: 'Az agent hívás nem indult el, vagy az üzenetfolyam eredmény nélkül megszakadt.',
  },
  agent_result_not_success: { group: 'agent', label: 'Az agent futás nem sikeres eredménnyel zárt.' },
  missing_structured_output: { group: 'agent', label: 'A lépés strukturált kimenetet várt, de nem kapott.' },
  structured_output_schema_mismatch: {
    group: 'agent',
    label: 'A lépés kimenete nem illeszkedett a strukturált kimenet sémájára.',
  },
  no_resumable_session: { group: 'agent', label: 'A lépés nem talált folytatható munkamenetet.' },
  missing_provider_env: { group: 'agent', label: 'A provider egy kötelező env változója nincs beállítva.' },
  mcp_server_not_found: {
    group: 'agent',
    label: 'A lépés olyan MCP szerverre hivatkozik, ami nincs a Beállítások MCP szerver listájában.',
  },
  missing_mcp_server_env: {
    group: 'agent',
    label: 'A lépés MCP szerveréhez rendelt szerver oldali env változó nincs beállítva.',
  },
  mcp_server_connection_failed: { group: 'agent', label: 'A lépés MCP szervere nem csatlakozott.' },
  agent_skill_not_in_step: {
    group: 'agent',
    label: 'Egy agent definíció olyan skillre hivatkozik, ami nincs a lépés kiválasztott skilljei között.',
  },
  template_render_failed: { group: 'language', label: 'Egy sablon nem renderelhető.' },
  expression_evaluation_failed: { group: 'language', label: 'Egy kifejezés kiértékelése nem sikerült.' },
  step_output_not_storable: { group: 'language', label: 'A lépés kimenete nem tárolható.' },
  branch_no_matching_edge: { group: 'control', label: 'Az Elágazás egyik ága sem illeszkedett.' },
  fan_out_items_not_a_list: { group: 'control', label: 'A Szétosztás kifejezésének eredménye nem lista.' },
  loop_max_iterations_reached: { group: 'control', label: 'A Ciklus elérte a beállított maximális iterációszámot.' },
  approval_timed_out: { group: 'control', label: 'Az Emberi jóváhagyás várakozása döntés nélkül lejárt.' },
  unhandled_error_kind: {
    group: 'control',
    label: 'Egy másik Hibakezelő nem kezelte a hibát, mert a fajtája nem szerepelt a listájában.',
  },
  sub_workflow_failed: {
    group: 'sub_workflow',
    label: 'Az al-workflow futása nem indult el, vagy nem sikeresen zárt.',
  },
  workflow_recursion_detected: { group: 'sub_workflow', label: 'Az al-workflow önmagát hívná meg.' },
  unresolvable_step_reference: {
    group: 'sub_workflow',
    label: 'Az al-workflow bemenete olyan lépésre hivatkozik, aminek a kimenete nem érhető el.',
  },
  script_evaluation_failed: { group: 'script', label: 'A szkript futás közben hibát dobott.' },
  script_timed_out: { group: 'script', label: 'A szkript túllépte az időkorlátját.' },
  script_output_not_json: { group: 'script', label: 'A szkript eredménye nem JSON érték.' },
};

interface HandledErrorKindOption {
  readonly value: HandledErrorKind;
  readonly label: string;
}

interface HandledErrorKindOptionGroup {
  readonly title: string;
  readonly options: readonly HandledErrorKindOption[];
}

/**
 * A választó csoportjai a megjelenítés sorrendjében; egy csoporton belül az
 * opciók a `protocol` zárt listájának sorrendjében állnak.
 */
export const HANDLED_ERROR_KIND_OPTION_GROUPS: readonly HandledErrorKindOptionGroup[] = GROUP_ORDER.map((group) => ({
  title: GROUP_TITLES[group],
  options: HandledErrorKindSchema.options
    .filter((value) => HANDLED_ERROR_KIND_ENTRIES[value].group === group)
    .map((value) => ({ value, label: HANDLED_ERROR_KIND_ENTRIES[value].label })),
}));
