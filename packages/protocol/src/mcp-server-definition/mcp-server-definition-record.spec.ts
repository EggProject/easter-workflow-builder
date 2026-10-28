/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a dróton ténylegesen `null` értéket hordozza */
import { describe, expect, it } from 'vitest';
import { McpServerDefinitionRecordSchema } from './mcp-server-definition-record.ts';

const definition = { type: 'http', url: 'https://x.test/mcp', authEnvName: null };

describe('McpServerDefinitionRecordSchema', () => {
  it('a névvel együtt elfogadja a definíciót', () => {
    expect(McpServerDefinitionRecordSchema.safeParse({ name: 'github_ceg', definition }).success).toBe(true);
  });

  it.each([
    ['szabálytalan név', { name: 'git hub', definition }],
    ['ismeretlen kulcs', { name: 'github', definition, extra: 1 }],
    ['hiányzó definíció', { name: 'github' }],
  ])('elutasítja: %s', (_label, value) => {
    expect(McpServerDefinitionRecordSchema.safeParse(value).success).toBe(false);
  });
});
