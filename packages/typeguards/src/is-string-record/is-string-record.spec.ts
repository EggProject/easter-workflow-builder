import { describe, expect, expectTypeOf, it } from 'vitest';
import { isStringRecord } from './is-string-record.ts';

describe('isStringRecord', () => {
  it('igazat ad üres és csak szöveg értékű objektumra', () => {
    expect(isStringRecord({})).toBe(true);
    expect(isStringRecord({ GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' })).toBe(true);
  });

  it('hamisat ad, ha egy érték nem szöveg', () => {
    expect(isStringRecord({ GITHUB_TOKEN: 1 })).toBe(false);
    expect(isStringRecord({ A: 'a', B: undefined })).toBe(false);
  });

  it('hamisat ad nem objektum bemenetre', () => {
    expect(isStringRecord(['a'])).toBe(false);
    expect(isStringRecord('a')).toBe(false);
    expect(isStringRecord(undefined)).toBe(false);
  });

  it('a szöveg értékű rekordra szűkít', () => {
    const value: unknown = { A: 'a' };
    if (isStringRecord(value)) {
      expectTypeOf(value).toEqualTypeOf<Readonly<Record<string, string>>>();
    }
  });
});
