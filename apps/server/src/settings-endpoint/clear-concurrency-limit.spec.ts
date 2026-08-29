import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createClearConcurrencyLimitHandler } from './clear-concurrency-limit.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

describe('createClearConcurrencyLimitHandler', () => {
  it('sikeres törlésre 204-et ad, üres törzzsel', async () => {
    const database = openMemoryDatabase();
    okOrThrow(database.concurrencyLimits.setLimit('minimax', 5));
    const handler = createClearConcurrencyLimitHandler(database);

    const result = await handler({
      parameters: { providerId: 'minimax' },
      query: new URLSearchParams(),
      body: undefined,
    });

    expect(result).toStrictEqual({ kind: 'ok', value: { status: 204, body: undefined } });
    expect(okOrThrow(database.concurrencyLimits.readLimit('minimax'))).toBeNull();
  });

  it('nem beállított korlátra is 204-et ad (idempotens törlés)', async () => {
    const database = openMemoryDatabase();
    const handler = createClearConcurrencyLimitHandler(database);

    const result = await handler({
      parameters: { providerId: 'minimax' },
      query: new URLSearchParams(),
      body: undefined,
    });

    expect(result).toStrictEqual({ kind: 'ok', value: { status: 204, body: undefined } });
  });

  it('érvénytelen providerId-ra not_found hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createClearConcurrencyLimitHandler(database);

    const result = await handler({
      parameters: { providerId: 'nincs-ilyen' },
      query: new URLSearchParams(),
      body: undefined,
    });

    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('hiányzó providerId útvonal paraméterre not_found hibát ad', async () => {
    const database = openMemoryDatabase();
    const handler = createClearConcurrencyLimitHandler(database);

    const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });

    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toContain('(not_found)');
  });

  it('a repository hibaágát változatlanul továbbadja (lezárt adatbázis kapcsolat)', async () => {
    const database = openMemoryDatabase();
    database.close();
    const handler = createClearConcurrencyLimitHandler(database);

    const result = await handler({
      parameters: { providerId: 'minimax' },
      query: new URLSearchParams(),
      body: undefined,
    });

    expect(result.kind).toBe('error');
  });
});
