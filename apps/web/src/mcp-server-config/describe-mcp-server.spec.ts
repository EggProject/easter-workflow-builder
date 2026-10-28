import { describe, expect, it } from 'vitest';
import { describeMcpServer } from './describe-mcp-server.ts';

describe('describeMcpServer', () => {
  it('stdio: a parancs az argumentumokkal, a változók az alapértelmezett hozzárendeléssel', () => {
    expect(
      describeMcpServer({
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'szerver'],
        envNames: ['GITHUB_TOKEN', 'MASIK'],
        envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
      }),
    ).toEqual(['stdio: npx -y szerver', 'Változók: GITHUB_TOKEN ← GITHUB_TOKEN_CEG, MASIK']);
  });

  it('stdio: deklarált változó nélkül kimondja, hogy nincs', () => {
    expect(describeMcpServer({ type: 'stdio', command: 'szerver', args: [], envNames: [], envBindings: {} })).toEqual([
      'stdio: szerver',
      'Nincs deklarált környezeti változó.',
    ]);
  });

  it('http és sse: az URL és az Authorization fejlécet adó változó neve, vagy a "nincs" mondat', () => {
    expect(describeMcpServer({ type: 'http', url: 'https://mcp.example.test', authEnvName: 'MCP_TOKEN' })).toEqual([
      'http: https://mcp.example.test',
      'Authorization fejléc: a(z) MCP_TOKEN változó értéke.',
    ]);
    // eslint-disable-next-line unicorn/no-null -- a definíció `authEnvName` mezője `null` a "nincs Authorization" állapotban.
    expect(describeMcpServer({ type: 'sse', url: 'https://sse.example.test', authEnvName: null })).toEqual([
      'sse: https://sse.example.test',
      'Nincs Authorization fejléc.',
    ]);
  });
});
