import { describe, expect, it } from 'vitest';
import { parseConcurrencyLimitDraft } from './parse-concurrency-limit-draft.ts';

describe('parseConcurrencyLimitDraft', () => {
  it.each([
    ['1', 1],
    ['4', 4],
    [' 12 ', 12],
    ['007', 7],
  ])('a pozitív egész "%s" szövegből %d számot ad', (draft, expected) => {
    expect(parseConcurrencyLimitDraft(draft)).toBe(expected);
  });

  it.each([
    ['üres mező', ''],
    ['csak szóköz', ' '.repeat(3)],
    ['nulla', '0'],
    ['negatív', '-3'],
    ['tört', '1.5'],
    ['kitevős alak', '1e2'],
    ['hexadecimális', '0x10'],
    ['betű', 'öt'],
    ['biztonságos egészen túli', '99999999999999999999'],
  ])('%s nem pozitív egész: undefined', (_name, draft) => {
    expect(parseConcurrencyLimitDraft(draft)).toBeUndefined();
  });
});
