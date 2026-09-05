/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a dróton ténylegesen `null` értéket hordozza, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { StorableMcpServerSchema } from './storable-mcp-server.ts';

describe('StorableMcpServerSchema', () => {
  it('a stdio variánst elfogadja', () => {
    const result = StorableMcpServerSchema.safeParse({
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
      envNames: ['API_KEY'],
    });
    expect(result.success).toBe(true);
  });

  it('az sse variánst elfogadja, null authEnvName mellett is', () => {
    expect(
      StorableMcpServerSchema.safeParse({ type: 'sse', url: 'https://example.test', authEnvName: null }).success,
    ).toBe(true);
    expect(
      StorableMcpServerSchema.safeParse({ type: 'sse', url: 'https://example.test', authEnvName: 'AUTH_SECRET_ENV' })
        .success,
    ).toBe(true);
  });

  it('a http variánst elfogadja', () => {
    expect(
      StorableMcpServerSchema.safeParse({ type: 'http', url: 'https://example.test', authEnvName: null }).success,
    ).toBe(true);
  });

  it('az sdk variánst elutasítja (nem szerializálható)', () => {
    expect(StorableMcpServerSchema.safeParse({ type: 'sdk' }).success).toBe(false);
  });

  it('ismeretlen kulcsot elutasít (strictObject)', () => {
    expect(
      StorableMcpServerSchema.safeParse({
        type: 'stdio',
        command: 'node',
        args: [],
        envNames: [],
        env: { SECRET: 'x' },
      }).success,
    ).toBe(false);
  });
});
