/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a dróton ténylegesen `null` értéket hordozza */
import { describe, expect, it } from 'vitest';
import { McpServerDefinitionSchema } from './mcp-server-definition.ts';

const stdio = {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  envNames: ['GITHUB_TOKEN', 'GITHUB_HOST'],
  envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
};

describe('McpServerDefinitionSchema', () => {
  it('mindhárom ágat elfogadja', () => {
    expect(McpServerDefinitionSchema.safeParse(stdio).success).toBe(true);
    expect(McpServerDefinitionSchema.safeParse({ ...stdio, envNames: [], envBindings: {} }).success).toBe(true);
    expect(
      McpServerDefinitionSchema.safeParse({ type: 'sse', url: 'https://x.test', authEnvName: 'AUTH' }).success,
    ).toBe(true);
    expect(
      McpServerDefinitionSchema.safeParse({ type: 'http', url: 'https://x.test', authEnvName: null }).success,
    ).toBe(true);
  });

  it('a nem deklarált névre szóló hozzárendelést a kulcs útvonalán utasítja el', () => {
    const parsed = McpServerDefinitionSchema.safeParse({ ...stdio, envBindings: { OTHER: 'GITHUB_TOKEN_CEG' } });
    expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.path)).toStrictEqual([
      ['envBindings', 'OTHER'],
    ]);
  });

  it.each([
    ['sdk ág', { type: 'sdk' }],
    ['stdio érték rekorddal', { ...stdio, env: { GITHUB_TOKEN: 'titok' } }],
    ['stdio envBindings nélkül', { type: 'stdio', command: 'x', args: [], envNames: [] }],
    ['szabálytalan deklarált név', { ...stdio, envNames: ['GITHUB-TOKEN'], envBindings: {} }],
    ['szabálytalan szerver oldali név', { ...stdio, envBindings: { GITHUB_TOKEN: 'ceg token' } }],
    ['sse fejléc érték', { type: 'sse', url: 'u', authEnvName: null, headers: { Authorization: 'titok' } }],
    ['http szabálytalan authEnvName', { type: 'http', url: 'u', authEnvName: 'Bearer abc' }],
  ])('elutasítja: %s', (_label, value) => {
    expect(McpServerDefinitionSchema.safeParse(value).success).toBe(false);
  });
});
