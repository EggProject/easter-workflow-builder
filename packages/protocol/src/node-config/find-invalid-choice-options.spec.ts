import { describe, expect, it } from 'vitest';
import { findInvalidChoiceOptions } from './find-invalid-choice-options.ts';

function invalidPathsOf(...inputFields: readonly unknown[]): readonly (readonly (string | number)[])[] {
  return findInvalidChoiceOptions({ type: 'start', inputFields });
}

function choice(options: unknown): unknown {
  return { name: 'szin', label: 'Szín', valueKind: 'choice', options, required: true };
}

describe('findInvalidChoiceOptions', () => {
  it('érvényes opciókra nincs találat', () => {
    expect(invalidPathsOf(choice(['piros']))).toEqual([]);
    expect(invalidPathsOf(choice(['piros', 'zöld', 'két szó']))).toEqual([]);
  });

  for (const [description, options] of [
    ['üres lista', []],
    ['üres elem', ['piros', '']],
    ['csak szóközös elem', ['piros', ' '.repeat(3)]],
    ['duplikált elem', ['piros', 'zöld', 'piros']],
  ] as const) {
    it(`${description} esetén a mező options útvonalát adja`, () => {
      expect(invalidPathsOf(choice(options))).toEqual([['inputFields', 0, 'options']]);
    });
  }

  it('több hibás mezőt a saját indexükkel ad, a hibátlant kihagyja', () => {
    expect(invalidPathsOf(choice([]), choice(['a']), { valueKind: 'text' }, choice(['b', 'b']))).toEqual([
      ['inputFields', 0, 'options'],
      ['inputFields', 3, 'options'],
    ]);
  });

  it('a nem choice ágon álló options mezőre nincs találat (az ismeretlen kulcsot a séma utasítja el)', () => {
    expect(invalidPathsOf({ valueKind: 'text', options: [] })).toEqual([]);
  });

  for (const [description, options] of [
    ['hiányzó', undefined],
    ['nem lista', 'piros'],
    ['nem szöveg elem', [1, 2]],
  ] as const) {
    it(`${description} options értékre nincs találat (a típushibáról a séma dönt)`, () => {
      expect(invalidPathsOf(choice(options))).toEqual([]);
    });
  }

  it('nem objektum config, nem lista inputFields és nem objektum mező esetén nincs találat', () => {
    expect(findInvalidChoiceOptions('start')).toEqual([]);
    expect(findInvalidChoiceOptions({ type: 'start', inputFields: 'x' })).toEqual([]);
    expect(invalidPathsOf('choice', 7)).toEqual([]);
  });
});
