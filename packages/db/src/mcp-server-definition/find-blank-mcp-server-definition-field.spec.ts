/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a tárolt alakban valódi `null` értéket hordoz */
import { describe, expect, it } from 'vitest';
import { findBlankMcpServerDefinitionField } from './find-blank-mcp-server-definition-field.ts';
import type { McpServerDefinition } from './mcp-server-definition.ts';

const STDIO: McpServerDefinition = { type: 'stdio', command: 'node', args: [], envNames: [], envBindings: {} };

describe('findBlankMcpServerDefinitionField', () => {
  it.each([
    ['stdio', STDIO],
    ['sse', { type: 'sse', url: 'https://x.test/sse', authEnvName: null }],
    ['http', { type: 'http', url: 'https://x.test/mcp', authEnvName: 'AUTH' }],
  ] satisfies readonly (readonly [string, McpServerDefinition])[])(
    'kitöltött %s ágra undefined',
    (_type, definition) => {
      expect(findBlankMcpServerDefinitionField(definition)).toBeUndefined();
    },
  );

  it.each([
    ['üres stdio command', { ...STDIO, command: '' }, 'command'],
    ['csak szóköz stdio command', { ...STDIO, command: ' '.repeat(3) }, 'command'],
    ['üres sse url', { type: 'sse', url: '', authEnvName: null }, 'url'],
    ['csak szóköz http url', { type: 'http', url: ' \t', authEnvName: null }, 'url'],
  ] satisfies readonly (readonly [string, McpServerDefinition, string])[])(
    '%s: a mező neve',
    (_label, definition, field) => {
      expect(findBlankMcpServerDefinitionField(definition)).toBe(field);
    },
  );
});
