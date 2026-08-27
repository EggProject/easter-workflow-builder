import { describe, expect, it } from 'vitest';
import { readTimeoutMs } from './read-timeout-ms.ts';

const VARIABLE = 'TESZT_TIMEOUT_MS';

describe('readTimeoutMs', () => {
  it('az alapértelmezést adja, ha a változó nincs beállítva', () => {
    expect(readTimeoutMs({}, VARIABLE, 1234)).toStrictEqual({ kind: 'ok', value: 1234 });
  });

  it('az alapértelmezést adja, ha a változó csak szóközt tartalmaz', () => {
    expect(readTimeoutMs({ [VARIABLE]: ' ' }, VARIABLE, 1234)).toStrictEqual({ kind: 'ok', value: 1234 });
  });

  it('a beállított értéket adja vissza', () => {
    expect(readTimeoutMs({ [VARIABLE]: ' 5000 ' }, VARIABLE, 1234)).toStrictEqual({ kind: 'ok', value: 5000 });
  });

  it('hibaágat ad nem szám értékre', () => {
    const outcome = readTimeoutMs({ [VARIABLE]: 'sok' }, VARIABLE, 1234);
    expect(outcome.kind).toBe('error');
  });

  it('hibaágat ad nulla és negatív értékre', () => {
    expect(readTimeoutMs({ [VARIABLE]: '0' }, VARIABLE, 1234).kind).toBe('error');
    expect(readTimeoutMs({ [VARIABLE]: '-5' }, VARIABLE, 1234).kind).toBe('error');
  });

  it('hibaágat ad tört értékre', () => {
    expect(readTimeoutMs({ [VARIABLE]: '1.5' }, VARIABLE, 1234).kind).toBe('error');
  });

  it('a hibaüzenet megnevezi a változót', () => {
    const outcome = readTimeoutMs({ [VARIABLE]: 'sok' }, VARIABLE, 1234);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain(VARIABLE);
  });
});
