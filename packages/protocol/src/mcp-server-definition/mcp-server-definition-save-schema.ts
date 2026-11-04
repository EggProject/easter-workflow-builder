import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { BLANK_FIELD_MESSAGE } from '../node-config/blank-field-message.ts';
import { findBlankTextFields } from '../node-config/find-blank-text-fields.ts';
import { McpServerDefinitionSchema } from './mcp-server-definition.ts';
import { MCP_SERVER_DEFINITION_REQUIRED_TEXT_FIELDS } from './mcp-server-definition-required-text-fields.ts';

/**
 * A finomítás `when` feltétele: a bemenet ismert `type` értékkel áll, tehát a
 * diszkriminált unió ágat tudott választani (a `NodeConfigSaveSchema`
 * mintája). Az ismert értékek forrása a kötelező mező tábla kulcsai.
 */
function hasKnownType({ value }: { readonly value: unknown }): boolean {
  return (
    isRecord(value) &&
    isString(value['type']) &&
    Object.hasOwn(MCP_SERVER_DEFINITION_REQUIRED_TEXT_FIELDS, value['type'])
  );
}

/**
 * A `PUT /api/mcp-servers/:name` törzsének mentési sémája (SPEC-009 6.1, 6.2):
 * a `McpServerDefinitionSchema` olvasó séma plusz a kötelező szöveg mező
 * szabály (`stdio` `command`, `sse` és `http` `url`: nem üres, nem csak
 * szóköz), a node config kötelező szöveg mező szabályának mintájára
 * (`.claude/CLAUDE.md` 5. szekció). A hiba a mező útvonalára horgonyoz
 * (`command`, `url`), az üzenet a `BLANK_FIELD_MESSAGE`.
 *
 * A szabály a többi mező típushibája mellett is lefut (`when`, a
 * `NodeConfigSaveSchema` indoka szerint: egyszerre látsszon minden hiba).
 * Csak az írás oldala szigorodik: a lista elemének olvasó sémája
 * (`McpServerDefinitionRecordSchema`) változatlan. A `z.infer` eredménye nem
 * változik, tehát a `db` párjával szembeni típusszintű sodródás védelem
 * változatlan.
 */
export const McpServerDefinitionSaveSchema = McpServerDefinitionSchema.superRefine(
  (definition, context) => {
    const fields: readonly string[] = MCP_SERVER_DEFINITION_REQUIRED_TEXT_FIELDS[definition.type];
    for (const field of fields) {
      for (const fieldPath of findBlankTextFields(definition, field)) {
        context.addIssue({ code: 'custom', path: [...fieldPath], message: BLANK_FIELD_MESSAGE });
      }
    }
  },
  { when: hasKnownType },
);
