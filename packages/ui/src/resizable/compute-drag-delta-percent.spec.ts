import { describe, expect, it } from 'vitest';
import { computeDragDeltaPercent } from './compute-drag-delta-percent.ts';

describe('computeDragDeltaPercent', () => {
  it('a pozíció elmozdulását a konténerméret százalékában adja vissza', () => {
    expect(computeDragDeltaPercent(100, 150, 200)).toBe(25);
  });

  it('negatív elmozdulásra negatív százalékot ad', () => {
    expect(computeDragDeltaPercent(150, 100, 200)).toBe(-25);
  });

  it('nulla konténerméretre 0-t ad, NaN vagy Infinity helyett', () => {
    expect(computeDragDeltaPercent(100, 150, 0)).toBe(0);
  });

  it('negatív konténerméretre is 0-t ad', () => {
    expect(computeDragDeltaPercent(100, 150, -10)).toBe(0);
  });

  it('változatlan pozícióra 0 százalékot ad', () => {
    expect(computeDragDeltaPercent(100, 100, 200)).toBe(0);
  });
});
