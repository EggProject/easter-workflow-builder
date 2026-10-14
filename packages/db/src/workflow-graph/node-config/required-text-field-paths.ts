import type { JoinNodeConfig, NodeConfig } from './node-config.ts';

type RequiredTextFieldPathTable = Readonly<Record<Exclude<NodeConfig['type'], 'join'>, readonly string[]>> &
  Readonly<Record<'join', Readonly<Record<JoinNodeConfig['mode'], readonly string[]>>>>;

/**
 * A kötelező szöveg mezők listája node típusonként, a `join` módonként
 * (SPEC-008 5.4 táblázata, user döntés 2026-09-28, O-21): ponttal
 * összefűzött mezőútvonal a `config`-on belül, a lista minden elemén `*`
 * áll. A `replaceGraph` írás oldali ellenőrzése ebből dolgozik; a
 * `readGraph` és az `isNodeConfig` guard nem, mert a tárolt gráfban és a
 * megváltoztathatatlan pillanatképben lehet üres kötelező mező.
 *
 * A `packages/protocol` mentési sémája ugyanezt a táblát tartja, szándékos
 * duplikátumként (`.claude/CLAUDE.md` 5. szekció); a két tábla
 * típusszintű egyenlőségét és mezőnkénti futásidejű viselkedését az
 * `apps/server` `node-config-drift-protection` regressziós tesztje őrzi.
 */
export const REQUIRED_TEXT_FIELD_PATHS = {
  start: ['inputFields.*.name', 'inputFields.*.label', 'inputFields.*.valueKind'],
  agent_step: ['promptTemplate'],
  branch: ['expression', 'branches.*.key', 'branches.*.label'],
  fan_out: ['itemsExpression', 'branchLabelTemplate'],
  join: { merge: [], script: ['settings.source'], ai_synthesis: ['settings.promptTemplate'] },
  loop: ['continueExpression'],
  human_approval: ['title', 'bodyTemplate'],
  error_handler: [],
  sub_workflow: ['targetWorkflowId'],
  script: ['source'],
} as const satisfies RequiredTextFieldPathTable;
