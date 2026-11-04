import { describe, expect, it } from 'vitest';
import { findFailedMcpServers } from './find-failed-mcp-servers.ts';

describe('findFailedMcpServers', () => {
  it('a kiadott szerverek közül a failed és a needs-auth állapotúakat adja, sorrendben', () => {
    const init = {
      type: 'system',
      subtype: 'init',
      mcp_servers: [
        { name: 'docs', status: 'failed' },
        { name: 'github', status: 'connected' },
        { name: 'auth', status: 'needs-auth' },
        { name: 'lassu', status: 'pending' },
        { name: 'cli-sajat', status: 'failed' },
      ],
    };
    expect(findFailedMcpServers(init, ['docs', 'github', 'auth', 'lassu'])).toStrictEqual(['docs', 'auth']);
  });

  it('a nem várt alakú üzenet és elem nem számít', () => {
    expect(findFailedMcpServers('nem rekord', ['docs'])).toStrictEqual([]);
    expect(findFailedMcpServers({ mcp_servers: 'nem tömb' }, ['docs'])).toStrictEqual([]);
    expect(findFailedMcpServers({}, ['docs'])).toStrictEqual([]);
    expect(
      findFailedMcpServers({ mcp_servers: ['docs', { name: 1, status: 'failed' }, { name: 'docs', status: 2 }] }, [
        'docs',
      ]),
    ).toStrictEqual([]);
  });
});
