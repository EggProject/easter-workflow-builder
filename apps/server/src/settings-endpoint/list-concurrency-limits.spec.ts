/* eslint-disable unicorn/no-null -- a ConcurrencyLimitView.configuredMaxConcurrentSteps mezője valódi number | null */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import { createListConcurrencyLimitsHandler } from './list-concurrency-limits.ts';

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

describe('createListConcurrencyLimitsHandler', () => {
  it('pontosan a két rögzített providerre ad nézetet', async () => {
    const database = openMemoryDatabase();
    okOrThrow(database.concurrencyLimits.setLimit('minimax', 5));
    const handler = createListConcurrencyLimitsHandler(database, buildFakeEngine());

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject([
      { providerId: 'claude-subscription', configuredMaxConcurrentSteps: null },
      { providerId: 'minimax', configuredMaxConcurrentSteps: 5 },
    ]);
  });

  it('a claude-subscription-re is ad nézetet, ha csak az van beállítva (a másik providerId ?? null ága)', async () => {
    const database = openMemoryDatabase();
    okOrThrow(database.concurrencyLimits.setLimit('claude-subscription', 3));
    const handler = createListConcurrencyLimitsHandler(database, buildFakeEngine());

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toMatchObject([
      { providerId: 'claude-subscription', configuredMaxConcurrentSteps: 3 },
      { providerId: 'minimax', configuredMaxConcurrentSteps: null },
    ]);
  });

  it('a repository hibaágát változatlanul továbbadja (lezárt adatbázis kapcsolat)', async () => {
    const database = openMemoryDatabase();
    database.close();
    const handler = createListConcurrencyLimitsHandler(database, buildFakeEngine());

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('error');
  });
});
