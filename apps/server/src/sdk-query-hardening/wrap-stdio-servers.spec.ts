import { describe, expect, it } from 'vitest';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { STDIO_LAUNCHER_SOURCE } from './stdio-launcher-source.ts';
import { wrapStdioServers } from './wrap-stdio-servers.ts';

describe('wrapStdioServers', () => {
  it('a stdio elem parancsa az indító, a nevek az env kulcsai, az env változatlan', () => {
    const wrapped = wrapStdioServers({
      github: { type: 'stdio', command: 'github-mcp', args: ['--stdio'], env: { GITHUB_TOKEN: 'ertek' } },
    });
    expect(wrapped).toStrictEqual({
      github: {
        type: 'stdio',
        command: process.execPath,
        args: ['-e', STDIO_LAUNCHER_SOURCE, '--', '["GITHUB_TOKEN"]', 'github-mcp', '--stdio'],
        env: { GITHUB_TOKEN: 'ertek' },
      },
    });
  });

  it('a http és a sse elem, a nem rekord elem és a hiányos stdio elem változatlan', () => {
    const servers = {
      docs: { type: 'http', url: 'http://127.0.0.1:4100/mcp' },
      events: { type: 'sse', url: 'http://127.0.0.1:4200/sse' },
      szoveg: 'nem rekord',
      hianyos: { type: 'stdio', command: 'x', args: ['a'] },
      rossz: { type: 'stdio', command: 1, args: [], env: {} },
      rosszArgs: { type: 'stdio', command: 'x', args: [1], env: {} },
    };
    expect(wrapStdioServers(servers)).toStrictEqual(servers);
  });

  it('a nem rekord érték változatlan', () => {
    expect(wrapStdioServers(undefined)).toBeUndefined();
    expect(wrapStdioServers('github')).toBe('github');
  });

  it('a __proto__ nevű szerver saját kulcs marad', () => {
    const servers = Object.fromEntries([['__proto__', { type: 'http', url: 'https://example.invalid/mcp' }]]);
    const wrapped = wrapStdioServers(servers);
    expect(isRecord(wrapped) && Object.keys(wrapped)).toStrictEqual(['__proto__']);
  });
});
