import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createUpdateSettingsHandler } from './update-settings.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

describe('createUpdateSettingsHandler', () => {
  it('mindkét mezőt frissíti, és a frissített beállítást adja vissza', async () => {
    const database = openMemoryDatabase();
    const handler = createUpdateSettingsHandler(database);

    const result = await handler({
      parameters: {},
      query: new URLSearchParams(),
      body: { defaultProviderId: 'minimax', persistStreamDeltas: true },
    });

    expect(result).toStrictEqual({
      kind: 'ok',
      value: { status: 200, body: { defaultProviderId: 'minimax', persistStreamDeltas: true } },
    });
  });

  it('elhagyott mezőt érintetlenül hagy', async () => {
    const database = openMemoryDatabase();
    okOrThrow(database.settings.setDefaultProvider('claude-subscription'));
    const handler = createUpdateSettingsHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: { persistStreamDeltas: true } });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toStrictEqual({
      defaultProviderId: 'claude-subscription',
      persistStreamDeltas: true,
    });
  });

  it('érvénytelen defaultProviderId-ra invalid_request hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createUpdateSettingsHandler(database);

    const result = await handler({
      parameters: {},
      query: new URLSearchParams(),
      body: { defaultProviderId: 'nincs-ilyen' },
    });

    expect(result.kind).toBe('error');
  });

  it('érvénytelen kérés törzsre invalid_request hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createUpdateSettingsHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: { extra: 1 } });

    expect(result.kind).toBe('error');
  });
});
