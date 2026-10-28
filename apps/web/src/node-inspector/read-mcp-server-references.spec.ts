/* eslint-disable unicorn/no-null -- a teszt a hivatkozás `authEnvName` mezőjének `null` értékét vizsgálja (SPEC-009 6.2). */
import type { McpServerReference } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { readMcpServerReferences } from './read-mcp-server-references.ts';

describe('readMcpServerReferences', () => {
  it('a hiányzó mező üres hivatkozás-halmaz', () => {
    expect(readMcpServerReferences(undefined)).toEqual(new Map());
  });

  it('az üres rekord üres hivatkozás-halmaz', () => {
    expect(readMcpServerReferences({})).toEqual(new Map());
  });

  it('érvényes rekordot névsorrendben, Map-ként ad vissza', () => {
    const github: McpServerReference = { envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' }, authEnvName: null };
    const tavoli: McpServerReference = { envBindings: {}, authEnvName: 'TAVOLI_AUTH' };
    expect(readMcpServerReferences({ github, tavoli })).toEqual(
      new Map([
        ['github', github],
        ['tavoli', tavoli],
      ]),
    );
  });

  it('a `constructor` és a `__proto__` név is megmarad kulcsként', () => {
    const entry = { envBindings: {}, authEnvName: null };
    const stored: unknown = JSON.parse('{"constructor":{"envBindings":{},"authEnvName":null}}');
    expect(readMcpServerReferences(stored)?.get('constructor')).toEqual(entry);
  });

  it('nem rekord érték (sztring, tömb, null, szám) érvénytelen', () => {
    for (const stored of ['github', ['github'], null, 3]) {
      expect(readMcpServerReferences(stored)).toBeUndefined();
    }
  });

  it('egyetlen érvénytelen bejegyzés az egész értéket érvénytelenné teszi', () => {
    expect(
      readMcpServerReferences({
        jo: { envBindings: {}, authEnvName: null },
        rossz: { envBindings: { A: 1 }, authEnvName: null },
      }),
    ).toBeUndefined();
    expect(readMcpServerReferences({ extra: { envBindings: {}, authEnvName: null, mas: 1 } })).toBeUndefined();
  });
});
