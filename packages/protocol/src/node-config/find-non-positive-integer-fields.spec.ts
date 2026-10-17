/* eslint-disable unicorn/no-null -- a dróton érkező szám mező helyén `null` is állhat (a JSON a `NaN` értéket `null`-ként írja), ezt a típushibás esetet vizsgáljuk */
import { describe, expect, it } from 'vitest';
import { findNonPositiveIntegerFields } from './find-non-positive-integer-fields.ts';

describe('findNonPositiveIntegerFields', () => {
  for (const [description, number] of [
    ['nulla', 0],
    ['negatív nulla', -0],
    ['negatív egész', -3],
    ['pozitív tört', 1.5],
    ['negatív tört', -0.5],
  ] as const) {
    it(`${description} értékre a mező útvonalát adja`, () => {
      expect(findNonPositiveIntegerFields({ maxIterations: number }, 'maxIterations')).toEqual([['maxIterations']]);
    });
  }

  it('pozitív egészre nincs találat', () => {
    expect(findNonPositiveIntegerFields({ maxIterations: 1 }, 'maxIterations')).toEqual([]);
    expect(findNonPositiveIntegerFields({ maxIterations: 250 }, 'maxIterations')).toEqual([]);
  });

  for (const [description, value] of [
    ['NaN', NaN],
    ['végtelen', Infinity],
    ['negatív végtelen', -Infinity],
    ['szöveg', '0'],
    ['null', null],
    ['hiányzó', undefined],
  ] as const) {
    it(`${description} értékre nincs találat (a típushibáról a séma dönt)`, () => {
      expect(findNonPositiveIntegerFields({ maxIterations: value }, 'maxIterations')).toEqual([]);
    });
  }

  it('a csillag a lista minden elemére kiterjed, a konkrét indexszel', () => {
    expect(findNonPositiveIntegerFields({ backoffMs: [100, 0, -3, 1.5, 200] }, 'backoffMs.*')).toEqual([
      ['backoffMs', 1],
      ['backoffMs', 2],
      ['backoffMs', 3],
    ]);
  });

  it('üres listára nincs találat', () => {
    expect(findNonPositiveIntegerFields({ backoffMs: [] }, 'backoffMs.*')).toEqual([]);
  });

  it('a csillag helyén nem lista értékre nincs találat', () => {
    expect(findNonPositiveIntegerFields({ backoffMs: 0 }, 'backoffMs.*')).toEqual([]);
  });

  it('a kulcs előtt nem objektum értékre nincs találat', () => {
    expect(findNonPositiveIntegerFields('szöveg', 'maxIterations')).toEqual([]);
    expect(findNonPositiveIntegerFields(undefined, 'maxIterations')).toEqual([]);
  });
});
