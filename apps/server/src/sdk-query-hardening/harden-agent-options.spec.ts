import { describe, expect, it } from 'vitest';
import { hardenAgentOptions } from './harden-agent-options.ts';
import { STDIO_LAUNCHER_SOURCE } from './stdio-launcher-source.ts';

const STDIO = { type: 'stdio', command: 'mcp', args: [], env: { TOKEN: 'ertek' } };
const WRAPPED_STDIO = {
  type: 'stdio',
  command: process.execPath,
  args: ['-e', STDIO_LAUNCHER_SOURCE, '--', '["TOKEN"]', 'mcp'],
  env: { TOKEN: 'ertek' },
};

describe('hardenAgentOptions', () => {
  it('mcpServers és agents nélkül az Options változatlan, és nincs kivett rekord', () => {
    expect(hardenAgentOptions({ model: 'm', env: { A: 'b' } })).toStrictEqual({
      options: { model: 'm', env: { A: 'b' } },
      mcpServers: undefined,
    });
  });

  it('a lépés mcpServers rekordja kikerül az Options-ból, a stdio eleme az indítón át fut (O-45, O-52)', () => {
    expect(hardenAgentOptions({ model: 'm', mcpServers: { s: STDIO } })).toStrictEqual({
      options: { model: 'm' },
      mcpServers: { s: WRAPPED_STDIO },
    });
  });

  it('a nem rekord mcpServers érték eltűnik, kivett rekord nincs', () => {
    expect(hardenAgentOptions({ mcpServers: 'hibas' })).toStrictEqual({ options: {}, mcpServers: undefined });
  });

  it('az agent definíciók objektum elemeinek stdio szervere az indítón át fut, a név elem és a többi mező változatlan', () => {
    const hardened = hardenAgentOptions({
      agents: {
        a: { description: 'd', prompt: 'p', mcpServers: ['lepes', { sajat: STDIO }] },
        b: { description: 'd', prompt: 'p' },
        c: 'nem rekord',
      },
    });
    expect(hardened.options).toStrictEqual({
      agents: {
        a: { description: 'd', prompt: 'p', mcpServers: ['lepes', { sajat: WRAPPED_STDIO }] },
        b: { description: 'd', prompt: 'p' },
        c: 'nem rekord',
      },
    });
  });

  it('a nem rekord agents érték változatlanul marad', () => {
    expect(hardenAgentOptions({ agents: 'hibas' }).options).toStrictEqual({ agents: 'hibas' });
  });
});
