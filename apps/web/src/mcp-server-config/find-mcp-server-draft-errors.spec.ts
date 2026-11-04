import { describe, expect, it } from 'vitest';
import { findMcpServerDraftErrors } from './find-mcp-server-draft-errors.ts';
import type { McpServerDraft } from './mcp-server-draft.ts';

const VALID: McpServerDraft = {
  name: 'github-1',
  type: 'stdio',
  command: 'npx',
  args: [],
  envNames: ['GITHUB_TOKEN'],
  envBindings: {},
  url: '',
  authEnvName: '',
};

const NO_ERRORS = { name: undefined, command: undefined, url: undefined, envNames: undefined };

describe('findMcpServerDraftErrors', () => {
  it('érvényes stdio űrlapra nincs hiba, az üres url nem számít', () => {
    expect(findMcpServerDraftErrors(VALID)).toEqual(NO_ERRORS);
  });

  it('a név üres vagy a megengedett halmazon kívüli jelet tartalmaz: hiba a névnél', () => {
    expect(findMcpServerDraftErrors({ ...VALID, name: '' }).name).toContain('betűt, számot');
    expect(findMcpServerDraftErrors({ ...VALID, name: 'a b' }).name).toContain('betűt, számot');
    expect(findMcpServerDraftErrors({ ...VALID, name: 'a.b' }).name).toBeDefined();
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'a fenntartott %s név: hiba a névnél (PLAN-012 T-012-27)',
    (name) => {
      expect(findMcpServerDraftErrors({ ...VALID, name }).name).toContain('constructor vagy prototype');
    },
  );

  it('üres vagy csak szóközből álló parancs: hiba a parancsnál', () => {
    expect(findMcpServerDraftErrors({ ...VALID, command: '' })).toEqual({
      ...NO_ERRORS,
      command: 'A mező nem lehet üres.',
    });
    expect(findMcpServerDraftErrors({ ...VALID, command: ' '.repeat(3) }).command).toBe('A mező nem lehet üres.');
  });

  it('szabálytalan deklarált változó név: hiba a változó neveknél', () => {
    expect(findMcpServerDraftErrors({ ...VALID, envNames: ['1ROSSZ'] }).envNames).toContain(
      'betűvel vagy aláhúzással kezdődik',
    );
  });

  it('http és sse: üres URL hiba az URL-nél, a parancs üressége nem számít', () => {
    const remote: McpServerDraft = { ...VALID, type: 'http', command: '', url: 'https://mcp.example.test' };

    expect(findMcpServerDraftErrors(remote)).toEqual(NO_ERRORS);
    expect(findMcpServerDraftErrors({ ...remote, url: ' ' })).toEqual({ ...NO_ERRORS, url: 'A mező nem lehet üres.' });
    expect(findMcpServerDraftErrors({ ...remote, type: 'sse', url: '' }).url).toBe('A mező nem lehet üres.');
  });
});
