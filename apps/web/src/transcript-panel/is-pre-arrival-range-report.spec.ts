import { describe, expect, it } from 'vitest';
import { isPreArrivalRangeReport } from './is-pre-arrival-range-report.ts';

describe('isPreArrivalRangeReport', () => {
  it('igaz, ha a sorszám nőtt, és a jelentés a régi utolsó sornál ér véget (a nem teli lista első jelentése)', () => {
    expect(isPreArrivalRangeReport({ stopIndex: 2 }, 4, 3)).toBe(true);
  });

  it('hamis, ha a sorszám nem nőtt az előző jelentés óta', () => {
    expect(isPreArrivalRangeReport({ stopIndex: 2 }, 3, 3)).toBe(false);
  });

  it('hamis, ha a régi tartomány a régi utolsó sor előtt ért véget (felgörgetett lista)', () => {
    expect(isPreArrivalRangeReport({ stopIndex: 1 }, 4, 3)).toBe(false);
  });

  it('hamis, ha a sorszám csökkent', () => {
    expect(isPreArrivalRangeReport({ stopIndex: 2 }, 2, 3)).toBe(false);
  });
});
