/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a dróton ténylegesen `null` értéket hordozza */
import { describe, expect, it } from 'vitest';
import { BLANK_FIELD_MESSAGE } from '../node-config/blank-field-message.ts';
import { McpServerDefinitionSaveSchema } from './mcp-server-definition-save-schema.ts';

const stdio = { type: 'stdio', command: 'node', args: [], envNames: ['TOKEN'], envBindings: {} };

function issuesOf(value: unknown): readonly { readonly path: readonly PropertyKey[]; readonly message: string }[] {
  const parsed = McpServerDefinitionSaveSchema.safeParse(value);
  return parsed.success ? [] : parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message }));
}

describe('McpServerDefinitionSaveSchema', () => {
  it('a kitöltött kötelező mezőkkel mindhárom ágat elfogadja', () => {
    expect(McpServerDefinitionSaveSchema.safeParse(stdio).success).toBe(true);
    expect(
      McpServerDefinitionSaveSchema.safeParse({ type: 'sse', url: 'https://x.test/sse', authEnvName: null }).success,
    ).toBe(true);
    expect(
      McpServerDefinitionSaveSchema.safeParse({ type: 'http', url: 'https://x.test/mcp', authEnvName: 'AUTH' }).success,
    ).toBe(true);
  });

  it.each([
    ['üres stdio command', { ...stdio, command: '' }, 'command'],
    ['csak szóköz stdio command', { ...stdio, command: '  ' }, 'command'],
    ['üres sse url', { type: 'sse', url: '', authEnvName: null }, 'url'],
    ['csak szóköz http url', { type: 'http', url: ' ', authEnvName: null }, 'url'],
  ])('%s: a mező útvonalán, a közös üzenettel utasítja el', (_label, definition, field) => {
    expect(issuesOf(definition)).toStrictEqual([{ path: [field], message: BLANK_FIELD_MESSAGE }]);
  });

  it('a más mező típushibája mellett is jelzi az üres kötelező mezőt (when)', () => {
    const issues = issuesOf({ ...stdio, command: '', envNames: ['1-rossz'] });
    expect(issues.map((issue) => issue.path)).toStrictEqual([['envNames', 0], ['command']]);
  });

  it('ismeretlen típusra csak a diszkriminátor hibáját adja', () => {
    expect(issuesOf({ type: 'sdk', command: '' }).map((issue) => issue.path)).toStrictEqual([['type']]);
  });
});
