import { describe, expect, it } from 'vitest';
import { growPanel } from './grow-panel.ts';

describe('growPanel', () => {
  it('a második panelt az előtte álló rovására növeli', () => {
    expect(growPanel([50, 50], 1, 70, [])).toEqual([30, 70]);
  });

  it('az első panelt az utána álló rovására növeli', () => {
    expect(growPanel([50, 50], 0, 70, [])).toEqual([70, 30]);
  });

  it('a fizető panel a mért minimumánál kisebb nem lesz', () => {
    expect(growPanel([50, 50], 1, 90, [20, 20])).toEqual([20, 80]);
  });

  it('kisebb célra a méretek változatlanok: a panel sosem zsugorodik', () => {
    const sizes = [30, 70];
    expect(growPanel(sizes, 1, 60, [])).toBe(sizes);
    expect(growPanel(sizes, 1, 70, [])).toBe(sizes);
  });

  it('nem létező panelre a méretek változatlanok', () => {
    const sizes = [50, 50];
    expect(growPanel(sizes, 2, 80, [])).toBe(sizes);
  });
});
