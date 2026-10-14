import { findBlankTextFields } from './find-blank-text-fields.ts';
import { NodeConfigSchema, type NodeConfig } from './node-config.ts';
import { REQUIRED_TEXT_FIELD_PATHS } from './required-text-field-paths.ts';

function requiredTextFieldPathsOf(config: NodeConfig): readonly string[] {
  return config.type === 'join' ? REQUIRED_TEXT_FIELD_PATHS.join[config.mode] : REQUIRED_TEXT_FIELD_PATHS[config.type];
}

/**
 * A mentési séma (SPEC-008 5.4, user döntés 2026-09-28, O-21): a
 * `NodeConfigSchema` olvasó séma plusz a kötelező szöveg mezők szabálya. A
 * `superRefine` a `ReplaceGraphRequestSchema` azonosító egyediség mintáját
 * követi: a hiba a mező útvonalára horgonyoz (`branches.0.key`), és az
 * elutasított érték nem jelenik meg az üzenetben.
 *
 * Csak az írás oldala szigorodik: a `NodeConfigSchema`, a `WorkflowNodeSchema`
 * és a `WorkflowGraphDocumentSchema` az üres kötelező mezőt változatlanul
 * elfogadja, mert a tárolt gráfban és a megváltoztathatatlan pillanatképben
 * lehet ilyen (`.claude/CLAUDE.md` 10. szekció 2. pont). A `z.infer`
 * eredménye nem változik, tehát a `db` mirror típusával szembeni sodródás
 * védelem típusszintű ága is változatlan.
 */
export const NodeConfigSaveSchema = NodeConfigSchema.superRefine((config, context) => {
  for (const path of requiredTextFieldPathsOf(config)) {
    for (const fieldPath of findBlankTextFields(config, path)) {
      context.addIssue({ code: 'custom', path: [...fieldPath], message: 'A mező nem lehet üres.' });
    }
  }
});
