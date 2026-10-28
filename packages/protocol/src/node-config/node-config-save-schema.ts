import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { BLANK_FIELD_MESSAGE } from './blank-field-message.ts';
import { findBlankTextFields } from './find-blank-text-fields.ts';
import { findInvalidMcpServerReferenceEnvironmentNames } from './find-invalid-mcp-server-reference-environment-names.ts';
import { findNonPositiveIntegerFields } from './find-non-positive-integer-fields.ts';
import { NodeConfigSchema, type NodeConfig } from './node-config.ts';
import { REQUIRED_TEXT_FIELD_PATHS } from './required-text-field-paths.ts';

/**
 * A nem pozitív egész szám mező hibaüzenete (SPEC-008 5.4, O-37). A mondatot
 * a user 2026-10-17-i döntése rögzíti (`docs/research/2026-10-17-szam-es-agent-mezok.md`
 * 6. szekció).
 */
const NOT_POSITIVE_INTEGER_MESSAGE = 'A mező értéke nem pozitív egész szám.';

/**
 * A szerver oldali env változó név hibaüzenete (SPEC-009 6.1, T-012-27), a
 * Beállítások MCP űrlapjának mondatával egyezően.
 */
const INVALID_ENV_NAME_MESSAGE =
  'A változó név betűvel vagy aláhúzással kezdődik, és csak betűt, számot és aláhúzást tartalmaz.';

/**
 * A lépés alakú konfig a node-on belül (az `mcpServerReferences` helye): az
 * `agent_step` maga, a `join` `ai_synthesis` módja a `settings` mezőben
 * (SPEC-004 5. szekció). Más típusnak nincs MCP hivatkozása.
 */
function agentStepPathOf(
  config: NodeConfig,
): { readonly prefix: readonly string[]; readonly value: unknown } | undefined {
  if (config.type === 'agent_step') {
    return { prefix: [], value: config };
  }
  if (config.type === 'join' && config.mode === 'ai_synthesis') {
    return { prefix: ['settings'], value: config.settings };
  }
  return undefined;
}

/**
 * A pozitív egész szám mezők node típusonként (SPEC-008 5.4, O-37): ponttal
 * összefűzött mezőútvonal a `config`-on belül, a lista minden elemén `*`. A
 * lista a `db` `isNodeConfig` guardjának pozitív egész szabályát duplikálja
 * (SPEC-003 4.3, `isPositiveInteger`); a két oldal mezőnkénti egyezését az
 * `apps/server` `node-config-drift-protection` tesztje őrzi.
 */
const POSITIVE_INTEGER_FIELD_PATHS = {
  start: [],
  agent_step: [],
  branch: [],
  fan_out: [],
  join: [],
  loop: ['maxIterations'],
  human_approval: [],
  error_handler: ['maxAttempts', 'backoffMs.*'],
  sub_workflow: [],
  script: [],
} as const satisfies Readonly<Record<NodeConfig['type'], readonly string[]>>;

function requiredTextFieldPathsOf(config: NodeConfig): readonly string[] {
  if (config.type !== 'join') {
    return REQUIRED_TEXT_FIELD_PATHS[config.type];
  }
  return config.mode === null ? [] : REQUIRED_TEXT_FIELD_PATHS.join[config.mode];
}

/**
 * A finomítás `when` feltétele: a bemenet egy ismert `type` (és a `join`
 * egy ismert vagy `null` `mode`) értékkel áll, azaz a `NodeConfigSchema`
 * diszkriminált uniója ágat tudott választani. Az ismert értékek forrása a
 * `REQUIRED_TEXT_FIELD_PATHS` tábla kulcsai, amit a `satisfies` pontosan a
 * tíz típusra és a három választott módra köt.
 */
function hasKnownDiscriminators({ value }: { readonly value: unknown }): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const { type, mode } = value;
  if (!isString(type) || !Object.hasOwn(REQUIRED_TEXT_FIELD_PATHS, type)) {
    return false;
  }
  return type !== 'join' || mode === null || (isString(mode) && Object.hasOwn(REQUIRED_TEXT_FIELD_PATHS.join, mode));
}

/**
 * A mentési séma (SPEC-008 5.4): a `NodeConfigSchema` olvasó séma plusz négy
 * írás oldali szabály, egyetlen `superRefine` hívásban:
 *
 * 1. a kötelező szöveg mezők nem üresek (user döntés 2026-09-28, O-21);
 * 2. az `onUnhandledError` mind a tíz típusnál nem `null` (O-29);
 * 3. a `join` `mode` mezője nem `null` (O-33);
 * 4. a `loop` `maxIterations`, az `error_handler` `maxAttempts` mezője és a
 *    `backoffMs` minden eleme pozitív egész (user döntés 2026-10-17, O-37);
 * 5. a lépés `mcpServerReferences` hivatkozásainak `envBindings` értéke és nem
 *    `null` `authEnvName` mezője env változó név alakú (SPEC-009 6.1,
 *    T-012-27); az agent definíciók azonos mezőjét a motor indításkori
 *    validációja ellenőrzi, mert az `agents` rekord itt szűkítetlen.
 *
 * **A szabályok a konfig típushibája mellett is lefutnak** (user döntés
 * 2026-10-16, "Egyszerre látsszon mind", SPEC-008 81. kritérium): a zod
 * alapértelmezés szerint kihagyja a finomítást, ha a bemenet már típushibát
 * hordoz (a felvett `loop` `NaN` `maxIterations` értéke), a `when` feltétel
 * ezt írja felül (<https://zod.dev/api>, "when"; a `superRefine` `when`
 * paramétere a zod 4.4.0-ban jelent meg:
 * <https://github.com/colinhacks/zod/releases/tag/v4.4.0>, colinhacks/zod
 * #5741). Ha viszont egy korábbi hiba kifejezetten megszakító
 * (`continue: false`), a finomítás a `when` mellett is kimarad (zod 4.4.3
 * `v4/core/schemas.js` 37-40. sor, `v4/core/util.js` 536-545. sor). A feltétel
 * pontosan azt garantálja, amit
 * a finomítás típusosan olvas: a `type` és a `join` `mode` ismert értékét. A
 * többi mezőt a finomítás csak az `unknown` bemenetű `findBlankTextFields` és
 * `findNonPositiveIntegerFields` hívással vizsgálja, vagy `null` értékkel
 * hasonlítja össze, tehát egy
 * típushibás mező a szabályt nem töri meg. Ugyanez a séma fut a kliensen a
 * mentés előtt és a szerveren a `PUT` törzsén, tehát mindkét oldal ugyanazokat
 * a mezőútvonalakat adja.
 *
 * A `superRefine` a `ReplaceGraphRequestSchema` azonosító egyediség mintáját
 * követi: a hiba a mező útvonalára horgonyoz (`branches.0.key`,
 * `onUnhandledError`, `mode`), és az elutasított érték nem jelenik meg az
 * üzenetben.
 *
 * Csak az írás oldala szigorodik: a `NodeConfigSchema`, a `WorkflowNodeSchema`
 * és a `WorkflowGraphDocumentSchema` az üres kötelező mezőt, a `null`
 * `onUnhandledError` értéket és a `null` `join` módot változatlanul
 * elfogadja, mert a tárolt gráfban és a megváltoztathatatlan pillanatképben
 * lehet ilyen (`.claude/CLAUDE.md` 10. szekció 2. pont). A `z.infer`
 * eredménye nem változik, tehát a `db` mirror típusával szembeni sodródás
 * védelem típusszintű ága is változatlan. A 2. és a 3. szabálynak nincs `db`
 * oldali párja: a `db` `replaceGraph` mindkét `null` értéket elfogadja, mert
 * a workflow létrehozásakor írt Start `onUnhandledError: null` értékkel áll
 * (SPEC-008 5.4, 5.8). A 4. szabály párja a `db` `isNodeConfig` guardja; az
 * olvasó sémák a nem pozitív egész számot változatlanul elfogadják. Az 5.
 * szabálynak nincs `db` oldali párja, a központi MCP definíció env név
 * szabályának mintájára (SPEC-009 6.1: a `db` alakot ellenőriz, a név alakot
 * a `protocol` mentési sémája).
 */
export const NodeConfigSaveSchema = NodeConfigSchema.superRefine(
  (config, context) => {
    for (const path of requiredTextFieldPathsOf(config)) {
      for (const fieldPath of findBlankTextFields(config, path)) {
        context.addIssue({ code: 'custom', path: [...fieldPath], message: BLANK_FIELD_MESSAGE });
      }
    }
    if (config.onUnhandledError === null) {
      context.addIssue({ code: 'custom', path: ['onUnhandledError'], message: BLANK_FIELD_MESSAGE });
    }
    if (config.type === 'join' && config.mode === null) {
      context.addIssue({ code: 'custom', path: ['mode'], message: BLANK_FIELD_MESSAGE });
    }
    const positiveIntegerFieldPaths: readonly string[] = POSITIVE_INTEGER_FIELD_PATHS[config.type];
    for (const path of positiveIntegerFieldPaths) {
      for (const fieldPath of findNonPositiveIntegerFields(config, path)) {
        context.addIssue({ code: 'custom', path: [...fieldPath], message: NOT_POSITIVE_INTEGER_MESSAGE });
      }
    }
    const agentStep = agentStepPathOf(config);
    if (agentStep !== undefined) {
      for (const fieldPath of findInvalidMcpServerReferenceEnvironmentNames(agentStep.value)) {
        context.addIssue({
          code: 'custom',
          path: [...agentStep.prefix, ...fieldPath],
          message: INVALID_ENV_NAME_MESSAGE,
        });
      }
    }
  },
  { when: hasKnownDiscriminators },
);
