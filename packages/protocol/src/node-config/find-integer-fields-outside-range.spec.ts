/* eslint-disable unicorn/no-null -- a dróton érkező szám mező helyén `null` is állhat, ezt a típushibás esetet vizsgáljuk */
import { describe, expect, it } from 'vitest';
import { findIntegerFieldsOutsideRange } from './find-integer-fields-outside-range.ts';

describe('findIntegerFieldsOutsideRange', () => {
  it('a tartomány alatti és fölötti egész értékre a mező útvonalát adja', () => {
    expect(findIntegerFieldsOutsideRange({ memoryLimitMb: 9 }, 'memoryLimitMb', 10, 20)).toEqual([['memoryLimitMb']]);
    expect(findIntegerFieldsOutsideRange({ memoryLimitMb: 21 }, 'memoryLimitMb', 10, 20)).toEqual([['memoryLimitMb']]);
  });

  it('a két határra és a tartományon belüli egészre nincs találat', () => {
    for (const memoryLimitMb of [10, 15, 20]) {
      expect(findIntegerFieldsOutsideRange({ memoryLimitMb }, 'memoryLimitMb', 10, 20)).toEqual([]);
    }
  });

  it('a tartományon belüli tört értékre is találat van (a mező egész)', () => {
    expect(findIntegerFieldsOutsideRange({ memoryLimitMb: 15.5 }, 'memoryLimitMb', 10, 20)).toEqual([
      ['memoryLimitMb'],
    ]);
  });

  for (const [description, value] of [
    ['NaN', NaN],
    ['végtelen', Infinity],
    ['szöveg', '99'],
    ['null', null],
    ['hiányzó', undefined],
  ] as const) {
    it(`${description} értékre nincs találat (a típushibáról a séma dönt)`, () => {
      expect(findIntegerFieldsOutsideRange({ memoryLimitMb: value }, 'memoryLimitMb', 10, 20)).toEqual([]);
    });
  }

  it('beágyazott útvonalon a teljes útvonalat adja', () => {
    expect(
      findIntegerFieldsOutsideRange({ settings: { memoryLimitMb: 21 } }, 'settings.memoryLimitMb', 10, 20),
    ).toEqual([['settings', 'memoryLimitMb']]);
  });

  it('a hiányzó beágyazott objektumra nincs találat', () => {
    expect(findIntegerFieldsOutsideRange({}, 'settings.memoryLimitMb', 10, 20)).toEqual([]);
    expect(findIntegerFieldsOutsideRange({ settings: 7 }, 'settings.memoryLimitMb', 10, 20)).toEqual([]);
  });
});
