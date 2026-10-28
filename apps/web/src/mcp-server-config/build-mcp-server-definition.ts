import type { McpServerDefinition } from '@easter-workflow-builder/protocol';
import type { McpServerDraft } from './mcp-server-draft.ts';

/**
 * Az űrlap-állapotból a mentett definíció (SPEC-009 6.1): a `command` és az
 * `url` szélső szóközei nélkül; a hozzárendelés csak deklarált névre és csak
 * kiválasztott szerver oldali névvel marad meg (a hiányzó bejegyzés azonos
 * nevet jelent); az üres `authEnvName` `null`.
 */
export function buildMcpServerDefinition(draft: McpServerDraft): McpServerDefinition {
  switch (draft.type) {
    case 'stdio': {
      return {
        type: 'stdio',
        command: draft.command.trim(),
        args: draft.args,
        envNames: draft.envNames,
        envBindings: Object.fromEntries(
          Object.entries(draft.envBindings).filter(
            ([declaredName, serverName]) => draft.envNames.includes(declaredName) && serverName !== '',
          ),
        ),
      };
    }
    case 'sse':
    case 'http': {
      return {
        type: draft.type,
        url: draft.url.trim(),
        // eslint-disable-next-line unicorn/no-null -- a definíció `authEnvName` mezője `string | null`: a `null` jelenti a "nincs Authorization fejléc" állapotot (SPEC-009 6.1).
        authEnvName: draft.authEnvName === '' ? null : draft.authEnvName,
      };
    }
  }
}
