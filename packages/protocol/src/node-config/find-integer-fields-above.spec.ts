/* eslint-disable unicorn/no-null -- a dróton érkező szám mező helyén `null` is állhat, ezt a típushibás esetet vizsgáljuk */
import { describe, expect, it } from 'vitest';
import { findIntegerFieldsAbove } from './find-integer-fields-above.ts';

describe('findIntegerFieldsAbove', () => {
  it('a határnál nagyobb egész értékre a mező útvonalát adja', () => {
    expect(findIntegerFieldsAbove({ timeoutMs: 11 }, 'timeoutMs', 10)).toEqual([['timeoutMs']]);
  });

  it('a határral egyenlő és a határnál kisebb értékre nincs találat', () => {
    expect(findIntegerFieldsAbove({ timeoutMs: 10 }, 'timeoutMs', 10)).toEqual([]);
    expect(findIntegerFieldsAbove({ timeoutMs: 1 }, 'timeoutMs', 10)).toEqual([]);
  });

  it('a határ fölötti tört értékre nincs találat (azt a pozitív egész szabály jelzi)', () => {
    expect(findIntegerFieldsAbove({ timeoutMs: 10.5 }, 'timeoutMs', 10)).toEqual([]);
  });

  for (const [description, value] of [
    ['NaN', NaN],
    ['végtelen', Infinity],
    ['szöveg', '99'],
    ['null', null],
    ['hiányzó', undefined],
  ] as const) {
    it(`${description} értékre nincs találat (a típushibáról a séma dönt)`, () => {
      expect(findIntegerFieldsAbove({ timeoutMs: value }, 'timeoutMs', 10)).toEqual([]);
    });
  }

  it('beágyazott útvonalon a teljes útvonalat adja', () => {
    expect(findIntegerFieldsAbove({ settings: { timeoutMs: 11 } }, 'settings.timeoutMs', 10)).toEqual([
      ['settings', 'timeoutMs'],
    ]);
  });

  it('a hiányzó beágyazott objektumra nincs találat', () => {
    expect(findIntegerFieldsAbove({}, 'settings.timeoutMs', 10)).toEqual([]);
    expect(findIntegerFieldsAbove({ settings: 7 }, 'settings.timeoutMs', 10)).toEqual([]);
  });
});
