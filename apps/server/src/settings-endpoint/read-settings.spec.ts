import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createReadSettingsHandler } from './read-settings.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

describe('createReadSettingsHandler', () => {
  it('üres táblán az alapértelmezett beállítást adja', async () => {
    const database = openMemoryDatabase();
    const handler = createReadSettingsHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(result).toStrictEqual({
      kind: 'ok',
      // eslint-disable-next-line unicorn/no-null -- a SettingsRecord.defaultProviderId mezője valódi ProviderId | null
      value: { status: 200, body: { defaultProviderId: null, persistStreamDeltas: false } },
    });
  });

  it('a beállított értéket adja vissza', async () => {
    const database = openMemoryDatabase();
    okOrThrow(database.settings.setDefaultProvider('minimax'));
    const handler = createReadSettingsHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.value.body).toStrictEqual({
      defaultProviderId: 'minimax',
      persistStreamDeltas: false,
    });
  });
});
