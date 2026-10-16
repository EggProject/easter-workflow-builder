import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { findBlankTextFields } from './find-blank-text-fields.ts';
import { NodeConfigSchema, type NodeConfig } from './node-config.ts';
import { REQUIRED_TEXT_FIELD_PATHS } from './required-text-field-paths.ts';

const BLANK_FIELD_MESSAGE = 'A mező nem lehet üres.';

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
 * A mentési séma (SPEC-008 5.4): a `NodeConfigSchema` olvasó séma plusz három
 * írás oldali szabály, egyetlen `superRefine` hívásban:
 *
 * 1. a kötelező szöveg mezők nem üresek (user döntés 2026-09-28, O-21);
 * 2. az `onUnhandledError` mind a tíz típusnál nem `null` (O-29);
 * 3. a `join` `mode` mezője nem `null` (O-33).
 *
 * **A szabályok a konfig típushibája mellett is lefutnak** (user döntés
 * 2026-10-16, "Egyszerre látsszon mind", SPEC-008 81. kritérium): a zod
 * alapértelmezés szerint kihagyja a finomítást, ha a bemenet már típushibát
 * hordoz (a felvett `loop` `NaN` `maxIterations` értéke), a `when` feltétel
 * ezt írja felül (<https://zod.dev/api>, "when"; a `superRefine` paramétere:
 * colinhacks/zod #5741). A feltétel pontosan azt garantálja, amit
 * a finomítás típusosan olvas: a `type` és a `join` `mode` ismert értékét. A
 * többi mezőt a finomítás csak az `unknown` bemenetű `findBlankTextFields`
 * hívással vizsgálja, vagy `null` értékkel hasonlítja össze, tehát egy
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
 * (SPEC-008 5.4, 5.8).
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
  },
  { when: hasKnownDiscriminators },
);
