import { describe, expect, it } from 'vitest';
import { computeTotalSizePixels } from './compute-total-size-pixels.ts';

function fakeElementWithRect(width: number, height: number): Element {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => new DOMRect(0, 0, width, height);
  return element;
}

describe('computeTotalSizePixels', () => {
  it('null konténerre 0-t ad', () => {
    // eslint-disable-next-line unicorn/no-null -- a `container: Element | null` paraméter valódi DOM ref hiányát modellezi, nem helyőrző undefined-et
    expect(computeTotalSizePixels(null, false)).toBe(0);
    // eslint-disable-next-line unicorn/no-null -- lásd fent
    expect(computeTotalSizePixels(null, true)).toBe(0);
  });

  it('vízszintes irányban a szélességet adja', () => {
    expect(computeTotalSizePixels(fakeElementWithRect(200, 100), false)).toBe(200);
  });

  it('függőleges irányban a magasságot adja', () => {
    expect(computeTotalSizePixels(fakeElementWithRect(200, 100), true)).toBe(100);
  });
});
