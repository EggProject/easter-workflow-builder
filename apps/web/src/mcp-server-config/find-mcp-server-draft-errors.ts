import {
  BLANK_FIELD_MESSAGE,
  McpServerDefinitionSaveSchema,
  McpServerNameSchema,
} from '@easter-workflow-builder/protocol';
import { buildMcpServerDefinition } from './build-mcp-server-definition.ts';
import type { McpServerDraft } from './mcp-server-draft.ts';

export interface McpServerDraftErrors {
  readonly name: string | undefined;
  readonly command: string | undefined;
  readonly url: string | undefined;
  readonly envNames: string | undefined;
}

const INVALID_NAME_MESSAGE = 'A név csak betűt, számot, aláhúzást és kötőjelet tartalmazhat, és nem lehet üres.';

const INVALID_ENV_NAMES_MESSAGE =
  'A változó név betűvel vagy aláhúzással kezdődik, és csak betűt, számot és aláhúzást tartalmaz.';

/**
 * Az űrlap mezőinek hibái a mentési sémák szerint (SPEC-009 6.1): a név a
 * `McpServerNameSchema`, a definíció mezői a `McpServerDefinitionSaveSchema`
 * szabályán mennek át, tehát a felület ugyanazt tiltja, amit a szerver. A
 * mezőt a séma hibájának útvonala (`command`, `url`, `envNames`) azonosítja;
 * a hibaüzenet a kliens saját magyar mondata. Csak a kiválasztott ág mezői
 * kaphatnak hibát.
 */
export function findMcpServerDraftErrors(draft: McpServerDraft): McpServerDraftErrors {
  const nameError = McpServerNameSchema.safeParse(draft.name).success ? undefined : INVALID_NAME_MESSAGE;
  const parsed = McpServerDefinitionSaveSchema.safeParse(buildMcpServerDefinition(draft));
  const invalidFields = new Set(parsed.success ? [] : parsed.error.issues.map((issue) => String(issue.path[0])));
  return {
    name: nameError,
    command: invalidFields.has('command') ? BLANK_FIELD_MESSAGE : undefined,
    url: invalidFields.has('url') ? BLANK_FIELD_MESSAGE : undefined,
    envNames: invalidFields.has('envNames') ? INVALID_ENV_NAMES_MESSAGE : undefined,
  };
}
