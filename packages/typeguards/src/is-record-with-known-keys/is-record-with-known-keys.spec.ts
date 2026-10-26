import { describe, expect, expectTypeOf, it } from 'vitest';
import { isRecordWithKnownKeys } from './is-record-with-known-keys.ts';

const KNOWN_KEYS: Readonly<Record<'name' | 'label', true>> = { name: true, label: true };

describe('isRecordWithKnownKeys', () => {
  it('igazat ad, ha minden kulcs ismert, a hiányzó kulcs nem számít', () => {
    expect(isRecordWithKnownKeys({ name: 'a', label: 'b' }, KNOWN_KEYS)).toBe(true);
    expect(isRecordWithKnownKeys({ name: 'a' }, KNOWN_KEYS)).toBe(true);
    expect(isRecordWithKnownKeys({}, KNOWN_KEYS)).toBe(true);
  });

  it('hamisat ad, ha egyetlen kulcs is ismeretlen', () => {
    expect(isRecordWithKnownKeys({ name: 'a', extra: 1 }, KNOWN_KEYS)).toBe(false);
    expect(isRecordWithKnownKeys({ extra: undefined }, KNOWN_KEYS)).toBe(false);
  });

  it('a prototípus lánc kulcsát nem tekinti ismertnek', () => {
    expect(isRecordWithKnownKeys({ toString: 'x' }, KNOWN_KEYS)).toBe(false);
  });

  it('hamisat ad nem rekord bemenetre', () => {
    expect(isRecordWithKnownKeys(undefined, KNOWN_KEYS)).toBe(false);
    expect(isRecordWithKnownKeys(['name'], KNOWN_KEYS)).toBe(false);
    expect(isRecordWithKnownKeys('name', KNOWN_KEYS)).toBe(false);
  });

  it('a szűkített típus az ismert kulcsok részleges rekordja', () => {
    const value: unknown = { name: 'a' };
    if (isRecordWithKnownKeys(value, KNOWN_KEYS)) {
      expectTypeOf(value).toEqualTypeOf<Readonly<Partial<Record<'name' | 'label', unknown>>>>();
    }
  });
});
