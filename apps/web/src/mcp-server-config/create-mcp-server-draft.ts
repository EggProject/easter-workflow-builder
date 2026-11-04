import type { McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import type { McpServerDraft } from './mcp-server-draft.ts';

const EMPTY_DRAFT: McpServerDraft = {
  name: '',
  type: 'stdio',
  command: '',
  args: [],
  envNames: [],
  envBindings: {},
  url: '',
  authEnvName: '',
};

/**
 * A szerkesztő modális kiindulási állapota: üres `stdio` szerver újnál, a
 * tárolt definíció mezői szerkesztésnél.
 */
export function createMcpServerDraft(record: McpServerDefinitionRecord | undefined): McpServerDraft {
  if (record === undefined) {
    return EMPTY_DRAFT;
  }
  const { name, definition } = record;
  switch (definition.type) {
    case 'stdio': {
      return {
        ...EMPTY_DRAFT,
        name,
        type: 'stdio',
        command: definition.command,
        args: definition.args,
        envNames: definition.envNames,
        envBindings: definition.envBindings,
      };
    }
    case 'sse':
    case 'http': {
      return {
        ...EMPTY_DRAFT,
        name,
        type: definition.type,
        url: definition.url,
        authEnvName: definition.authEnvName ?? '',
      };
    }
  }
}
