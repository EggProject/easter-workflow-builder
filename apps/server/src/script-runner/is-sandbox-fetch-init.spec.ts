import { describe, expect, it } from 'vitest';
import { isSandboxFetchInit } from './is-sandbox-fetch-init.ts';

describe('isSandboxFetchInit', () => {
  it('elfogadja az üres és a teljes dokumentált alakot', () => {
    expect(isSandboxFetchInit({})).toBe(true);
    expect(isSandboxFetchInit({ method: 'PUT', headers: { a: 'b' }, body: 'x' })).toBe(true);
  });

  it('elutasítja az ismeretlen kulcsot', () => {
    expect(isSandboxFetchInit({ redirect: 'follow' })).toBe(false);
  });

  it.each([
    ['method', { method: 1 }],
    ['headers', { headers: { a: 1 } }],
    ['headers nem objektum', { headers: 'a' }],
    ['body', { body: {} }],
  ])('elutasítja a rossz típusú mezőt: %s', (_name, value) => {
    expect(isSandboxFetchInit(value)).toBe(false);
  });

  it('elutasítja a nem objektumot', () => {
    expect(isSandboxFetchInit('GET')).toBe(false);
    expect(isSandboxFetchInit([])).toBe(false);
  });

  it('szűkít', () => {
    const value: unknown = { method: 'GET' };
    if (isSandboxFetchInit(value)) {
      expect(value.method).toBe('GET');
    } else {
      throw new Error('a guard nem fogadta el');
    }
  });
});
