import { describe, expect, it } from 'vitest';
import { extractErrorCause } from './extract-error-cause.ts';

describe('extractErrorCause', () => {
  it('visszaadja az Error .cause mezőjét', () => {
    const cause = new Error('eredeti hiba');
    const wrapped = new Error('csomagolt hiba', { cause });
    expect(extractErrorCause(wrapped)).toBe(cause);
  });

  it('undefined-et ad, ha a bemenet nem Error példány', () => {
    expect(extractErrorCause('nem hiba')).toBeUndefined();
  });
});
