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
 * A mentési séma (SPEC-008 5.4): a `NodeConfigSchema` olvasó séma plusz három
 * írás oldali szabály, egyetlen `superRefine` hívásban:
 *
 * 1. a kötelező szöveg mezők nem üresek (user döntés 2026-09-28, O-21);
 * 2. az `onUnhandledError` mind a tíz típusnál nem `null` (O-29);
 * 3. a `join` `mode` mezője nem `null` (O-33).
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
export const NodeConfigSaveSchema = NodeConfigSchema.superRefine((config, context) => {
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
});
