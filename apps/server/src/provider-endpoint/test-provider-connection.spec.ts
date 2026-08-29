import { describe, expect, it } from 'vitest';
import type { Engine } from '@easter-workflow-builder/engine';
import { createTestProviderConnectionHandler } from './test-provider-connection.ts';

function unused<TValue>(): Promise<TValue> {
  return Promise.reject(new Error('nem várt hívás'));
}

function buildFakeEngine(overrides: Partial<Engine>): Engine {
  return {
    startRun: () => unused(),
    interruptRun: () => unused(),
    decideApproval: () => unused(),
    restartRun: () => unused(),
    suggestedConcurrencyLimit: () => {
      throw new Error('nem várt hívás');
    },
    testProviderConnection: () => unused(),
    shutdown: () => unused(),
    ...overrides,
  };
}

describe('createTestProviderConnectionHandler', () => {
  it('érvényes providerId-ra a motor eredményét adja vissza', async () => {
    let seenProviderId: string | undefined;
    const engine = buildFakeEngine({
      testProviderConnection: (providerId) => {
        seenProviderId = providerId;
        // eslint-disable-next-line unicorn/no-null -- a ConnectionTestResult.errorMessage mezője valódi string | null
        return Promise.resolve({ kind: 'ok', value: { succeeded: true, mode: 'minimal_query', errorMessage: null } });
      },
    });
    const handler = createTestProviderConnectionHandler(engine);

    const result = await handler({
      parameters: { providerId: 'claude-subscription' },
      query: new URLSearchParams(),
      body: undefined,
    });

    expect(seenProviderId).toBe('claude-subscription');
    expect(result).toStrictEqual({
      kind: 'ok',
      // eslint-disable-next-line unicorn/no-null -- lásd fent
      value: { status: 200, body: { succeeded: true, mode: 'minimal_query', errorMessage: null } },
    });
  });

  it('érvénytelen providerId-ra not_found hibát ad, a motort nem hívja', async () => {
    const engine = buildFakeEngine({});
    const handler = createTestProviderConnectionHandler(engine);

    const result = await handler({
      parameters: { providerId: 'nincs-ilyen' },
      query: new URLSearchParams(),
      body: undefined,
    });

    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('a motor hibaágát változatlanul továbbadja', async () => {
    const engine = buildFakeEngine({
      testProviderConnection: () => Promise.resolve({ kind: 'error', message: 'hiba (internal).' }),
    });
    const handler = createTestProviderConnectionHandler(engine);

    const result = await handler({
      parameters: { providerId: 'minimax' },
      query: new URLSearchParams(),
      body: undefined,
    });

    expect(result.kind).toBe('error');
  });
});
