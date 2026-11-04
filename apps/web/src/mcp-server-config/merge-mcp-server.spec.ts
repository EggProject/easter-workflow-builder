import type { McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { mergeMcpServer } from './merge-mcp-server.ts';

const ALFA: McpServerDefinitionRecord = {
  name: 'alfa',
  definition: { type: 'stdio', command: 'npx', args: [], envNames: [], envBindings: {} },
};
const BETA: McpServerDefinitionRecord = {
  name: 'beta',
  // eslint-disable-next-line unicorn/no-null -- a definíció `authEnvName` mezője `null` a "nincs Authorization" állapotban.
  definition: { type: 'http', url: 'https://mcp.example.test', authEnvName: null },
};
const GAMMA: McpServerDefinitionRecord = { ...BETA, name: 'gamma' };

describe('mergeMcpServer', () => {
  it('az új szervert név szerinti helyre illeszti', () => {
    expect(mergeMcpServer([ALFA, GAMMA], BETA)).toEqual([ALFA, BETA, GAMMA]);
  });

  it('az azonos nevű sort lecseréli, a lista hossza nem nő', () => {
    const replaced: McpServerDefinitionRecord = { ...BETA, definition: { ...ALFA.definition } };

    expect(mergeMcpServer([ALFA, BETA, GAMMA], replaced)).toEqual([ALFA, replaced, GAMMA]);
  });

  it('üres listába és a lista végére is beilleszt, és a bemenetet nem módosítja', () => {
    const original: readonly McpServerDefinitionRecord[] = [ALFA];

    expect(mergeMcpServer([], ALFA)).toEqual([ALFA]);
    expect(mergeMcpServer(original, GAMMA)).toEqual([ALFA, GAMMA]);
    expect(original).toEqual([ALFA]);
  });

  it('a nagybetűs, aláhúzásos és kötőjeles nevet UTF-16 kódegység sorrendben rendezi', () => {
    const upper: McpServerDefinitionRecord = { ...ALFA, name: 'Zeta' };
    const dashed: McpServerDefinitionRecord = { ...ALFA, name: 'alfa-2' };
    const underscored: McpServerDefinitionRecord = { ...ALFA, name: 'alfa_2' };

    expect(mergeMcpServer([underscored, ALFA, upper], dashed).map((server) => server.name)).toEqual([
      'Zeta',
      'alfa',
      'alfa-2',
      'alfa_2',
    ]);
  });
});
