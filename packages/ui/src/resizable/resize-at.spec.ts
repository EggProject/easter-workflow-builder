import { describe, expect, it } from 'vitest';
import { resizeAt } from './resize-at.ts';

describe('resizeAt', () => {
  it('a delta mértékével tolja el a határt, a páros összeg megtartásával', () => {
    expect(resizeAt([40, 60], 0, 10)).toEqual([50, 50]);
    expect(resizeAt([40, 60], 0, -10)).toEqual([30, 70]);
  });

  it('a szomszédos, nem a szélső párra hat', () => {
    expect(resizeAt([20, 30, 50], 1, 5)).toEqual([20, 35, 45]);
  });

  it('a bal oldalt 5 százalékra vágja, ha a delta a minimum alá vinné', () => {
    expect(resizeAt([10, 90], 0, -50)).toEqual([5, 95]);
  });

  it('a bal oldalt a párösszeg mínusz 5 százalékra vágja, ha a delta a maximum fölé vinné', () => {
    expect(resizeAt([50, 50], 0, 200)).toEqual([95, 5]);
  });

  it('nem a teljes 95-re vágja, ha a párösszeg annál kisebb', () => {
    expect(resizeAt([10, 20, 70], 0, 200)).toEqual([25, 5, 70]);
  });

  it('változatlan tömböt ad, ha a handleIndex a tömb végén túlmutat', () => {
    const sizes = [40, 60];
    expect(resizeAt(sizes, 1, 10)).toBe(sizes);
  });

  it('változatlan tömböt ad nem véges bemenetre', () => {
    const sizes = [NaN, 60];
    expect(resizeAt(sizes, 0, 10)).toBe(sizes);
  });

  it('nem módosítja a bemeneti tömböt', () => {
    const sizes = [40, 60];
    resizeAt(sizes, 0, 10);
    expect(sizes).toEqual([40, 60]);
  });
});
