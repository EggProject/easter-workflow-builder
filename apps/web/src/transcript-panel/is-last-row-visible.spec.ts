import { describe, expect, it } from 'vitest';
import { isLastRowVisible } from './is-last-row-visible.ts';

describe('isLastRowVisible', () => {
  it('igaz, ha a látható tartomány utolsó indexe a lista utolsó sora', () => {
    expect(isLastRowVisible({ stopIndex: 9 }, 10)).toBe(true);
  });

  it('hamis, ha az utolsó sor a látható tartományon kívül esik', () => {
    expect(isLastRowVisible({ stopIndex: 8 }, 10)).toBe(false);
  });

  it('hamis, ha a lista időközben nőtt, és a jelentés még a régi tartományról szól', () => {
    expect(isLastRowVisible({ stopIndex: 9 }, 11)).toBe(false);
  });
});
