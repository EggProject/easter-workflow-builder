import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import { createSetConcurrencyLimitHandler } from './set-concurrency-limit.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function unused<TValue>(): Promise<TValue> {
  return Promise.reject(new Error('nem várt hívás'));
}

function buildFakeEngine(): Engine {
  return {
    startRun: () => unused(),
    interruptRun: () => unused(),
    decideApproval: () => unused(),
    restartRun: () => unused(),
    suggestedConcurrencyLimit: () => ({ suggestedLimit: undefined, note: 'teszt' }),
    testProviderConnection: () => unused(),
    shutdown: () => unused(),
  };
}

describe('createSetConcurrencyLimitHandler', () => {
  it('sikeresen beállítja a korlátot, és a friss nézetet adja vissza', async () => {
    const database = openMemoryDatabase();
    const handler = createSetConcurrencyLimitHandler(database, buildFakeEngine());

    const result = await handler({
      parameters: { providerId: 'minimax' },
      query: new URLSearchParams(),
      body: { maxConcurrentSteps: 5 },
    });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject({
      providerId: 'minimax',
      configuredMaxConcurrentSteps: 5,
    });
    expect(okOrThrow(database.concurrencyLimits.readLimit('minimax'))).toBe(5);
  });

  it('érvénytelen providerId-ra not_found hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createSetConcurrencyLimitHandler(database, buildFakeEngine());

    const result = await handler({
      parameters: { providerId: 'nincs-ilyen' },
      query: new URLSearchParams(),
      body: { maxConcurrentSteps: 5 },
    });

    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('érvénytelen kérés törzsre invalid_request hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createSetConcurrencyLimitHandler(database, buildFakeEngine());

    const result = await handler({ parameters: { providerId: 'minimax' }, query: new URLSearchParams(), body: {} });

    expect(result.kind).toBe('error');
  });

  it('a repository hibaágát változatlanul továbbadja', async () => {
    const database = openMemoryDatabase();
    const handler = createSetConcurrencyLimitHandler(database, buildFakeEngine());

    const result = await handler({
      parameters: { providerId: 'minimax' },
      query: new URLSearchParams(),
      body: { maxConcurrentSteps: 0 },
    });

    expect(result.kind).toBe('error');
  });
});
