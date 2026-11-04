import { describe, expect, it } from 'vitest';
import { collectNumberFields } from './collect-number-fields.ts';

const isNegative = (candidate: number): boolean => candidate < 0;

describe('collectNumberFields', () => {
  it('a sértő szám konkrét útvonalát adja', () => {
    expect(collectNumberFields({ a: { b: -1 } }, ['a', 'b'], [], isNegative)).toEqual([['a', 'b']]);
  });

  it('a nem sértő számra és a nem számra nincs találat', () => {
    expect(collectNumberFields({ a: 1 }, ['a'], [], isNegative)).toEqual([]);
    expect(collectNumberFields({ a: 'x' }, ['a'], [], isNegative)).toEqual([]);
  });

  it('a csillag a lista minden elemére kiterjed, a konkrét indexszel', () => {
    expect(collectNumberFields({ a: [1, -2, -3] }, ['a', '*'], [], isNegative)).toEqual([
      ['a', 1],
      ['a', 2],
    ]);
  });

  it('a csillag helyén nem lista és a kulcs előtt nem objektum értékre nincs találat', () => {
    expect(collectNumberFields({ a: -1 }, ['a', '*'], [], isNegative)).toEqual([]);
    expect(collectNumberFields(7, ['a'], [], isNegative)).toEqual([]);
  });
});
