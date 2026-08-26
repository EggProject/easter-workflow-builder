import { describe, expect, it } from 'vitest';
import { readBaseUrl } from './read-base-url.ts';

const VARIABLE = 'TESZT_BASE_URL';
const FALLBACK = 'https://alap.example';

describe('readBaseUrl', () => {
  it('az alapértelmezést adja, ha a változó nincs beállítva', () => {
    expect(readBaseUrl({}, VARIABLE, FALLBACK)).toBe(FALLBACK);
  });

  it('az alapértelmezést adja, ha a változó üres', () => {
    expect(readBaseUrl({ [VARIABLE]: '  ' }, VARIABLE, FALLBACK)).toBe(FALLBACK);
  });

  it('levágja a záró perjeleket', () => {
    expect(readBaseUrl({ [VARIABLE]: ' https://sajat.example// ' }, VARIABLE, FALLBACK)).toBe('https://sajat.example');
  });
});
