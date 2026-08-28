import { describe, expect, it } from 'vitest';
import type { SdkResultSubtype } from './sdk-result-subtype.ts';
import { isSdkResultSubtype } from './is-sdk-result-subtype.ts';

// Az öt érték, a SPEC-004 2. szekció F-3 tényének sorrendjében. A
// `SdkResultSubtype[]` annotáció fordítási idejű állítás is: ha az unió bővül
// vagy szűkül, ez a lista nem maradhat érintetlenül.
const allSubtypes: readonly SdkResultSubtype[] = [
  'success',
  'error_during_execution',
  'error_max_turns',
  'error_max_budget_usd',
  'error_max_structured_output_retries',
];

describe('isSdkResultSubtype', () => {
  it('az öt érték mindegyikére igazat ad', () => {
    expect(allSubtypes.every((subtype) => isSdkResultSubtype(subtype))).toBe(true);
    expect(allSubtypes).toHaveLength(5);
  });

  it('hamisat ad ismeretlen szövegre', () => {
    expect(isSdkResultSubtype('init')).toBe(false);
    expect(isSdkResultSubtype('')).toBe(false);
    // A `Record` alapú keresés nem eshet át a prototípus láncra.
    expect(isSdkResultSubtype('toString')).toBe(false);
    expect(isSdkResultSubtype('constructor')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isSdkResultSubtype(undefined)).toBe(false);
    expect(isSdkResultSubtype(7)).toBe(false);
    expect(isSdkResultSubtype({ subtype: 'success' })).toBe(false);
    expect(isSdkResultSubtype(['success'])).toBe(false);
  });
});
