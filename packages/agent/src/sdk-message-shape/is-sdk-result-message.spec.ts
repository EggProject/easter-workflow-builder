/* eslint-disable unicorn/no-null -- a `messages` folyam eleme `unknown`, és a
   guardnak kifejezetten a `null` bemenetet is el kell utasítania, nem csak a
   hiányzó (`undefined`) esetet, ezért a `null` itt szándékos negatív teszteset */
import { describe, expect, it } from 'vitest';
import { isSdkResultMessage } from './is-sdk-result-message.ts';
import type { SdkResultMessage } from './sdk-result-message.ts';
import type { SdkResultSubtype } from './sdk-result-subtype.ts';

// Az öt `subtype`, a SPEC-004 2. szekció F-3 tényének sorrendjében.
const allSubtypes: readonly SdkResultSubtype[] = [
  'success',
  'error_during_execution',
  'error_max_turns',
  'error_max_budget_usd',
  'error_max_structured_output_retries',
];

describe('isSdkResultMessage', () => {
  it('mind az öt `subtype` értékre igazat ad, és szűkíti a mezőt', () => {
    for (const subtype of allSubtypes) {
      const value: unknown = { type: 'result', subtype };
      expect(isSdkResultMessage(value)).toBe(true);
      if (isSdkResultMessage(value)) {
        const narrowed: SdkResultMessage = value;
        expect(narrowed.subtype).toBe(subtype);
      }
    }
  });

  it('igazat ad akkor is, ha a `structured_output` mező jelen van', () => {
    expect(isSdkResultMessage({ type: 'result', subtype: 'success', structured_output: { answer: 42 } })).toBe(true);
  });

  it('igazat ad akkor is, ha a `structured_output` mező hiányzik', () => {
    expect(isSdkResultMessage({ type: 'result', subtype: 'success' })).toBe(true);
  });

  it('hamisat ad, ha a `type` nem `result`', () => {
    expect(isSdkResultMessage({ type: 'system', subtype: 'success' })).toBe(false);
  });

  it('hamisat ad ismeretlen `subtype` értékre', () => {
    expect(isSdkResultMessage({ type: 'result', subtype: 'unknown_subtype' })).toBe(false);
  });

  it('hamisat ad nem rekord bemenetre', () => {
    expect(isSdkResultMessage(undefined)).toBe(false);
    expect(isSdkResultMessage(null)).toBe(false);
    expect(isSdkResultMessage('result')).toBe(false);
    expect(isSdkResultMessage(['result', 'success'])).toBe(false);
  });
});
