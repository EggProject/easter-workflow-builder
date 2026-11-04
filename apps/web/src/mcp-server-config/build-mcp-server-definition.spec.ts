import { describe, expect, it } from 'vitest';
import { buildMcpServerDefinition } from './build-mcp-server-definition.ts';
import type { McpServerDraft } from './mcp-server-draft.ts';

const DRAFT: McpServerDraft = {
  name: 'szerver',
  type: 'stdio',
  command: '  npx  ',
  args: ['-y'],
  envNames: ['A', 'B'],
  envBindings: { A: 'A_CEG', B: '', TORLT: 'X' },
  url: '  https://mcp.example.test  ',
  authEnvName: '',
};

describe('buildMcpServerDefinition', () => {
  it('stdio: a parancs szélső szóközei nélkül, a hozzárendelés csak deklarált névre és kiválasztott szerver oldali névvel', () => {
    expect(buildMcpServerDefinition(DRAFT)).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y'],
      envNames: ['A', 'B'],
      envBindings: { A: 'A_CEG' },
    });
  });

  it('http és sse: az URL szélső szóközei nélkül, az üres Authorization változó név null', () => {
    expect(buildMcpServerDefinition({ ...DRAFT, type: 'http' })).toEqual({
      type: 'http',
      url: 'https://mcp.example.test',
      // eslint-disable-next-line unicorn/no-null -- a definíció `authEnvName` mezője `null` a "nincs Authorization" állapotban.
      authEnvName: null,
    });
    expect(buildMcpServerDefinition({ ...DRAFT, type: 'sse', authEnvName: 'SSE_TOKEN' })).toEqual({
      type: 'sse',
      url: 'https://mcp.example.test',
      authEnvName: 'SSE_TOKEN',
    });
  });

  it('a másik ág mezői nem szivárognak a definícióba', () => {
    expect(Object.keys(buildMcpServerDefinition(DRAFT))).toEqual([
      'type',
      'command',
      'args',
      'envNames',
      'envBindings',
    ]);
    expect(Object.keys(buildMcpServerDefinition({ ...DRAFT, type: 'http' }))).toEqual(['type', 'url', 'authEnvName']);
  });
});
