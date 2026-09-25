import { describe, expect, it, vi } from 'vitest';
import { planReveal } from './plan-reveal.ts';

const INPUT = {
  sizes: [50, 50],
  panelIndex: 1,
  requiredPixels: 150,
  availablePixels: 200,
  minSizePercents: [30, 30],
  canGrow: true,
} as const;

describe('planReveal', () => {
  it('előbb a befoglaló csoporttól kér helyet, a saját arányt megtartva: ha az megadja, a saját arány marad', () => {
    const growContainer = vi.fn((deltaPixels: number) => deltaPixels);
    expect(planReveal(INPUT, growContainer)).toEqual([50, 50]);
    // 150 / 0,5 - 200 = 100 pixel.
    expect(growContainer).toHaveBeenCalledWith(100, false);
  });

  it('a befoglaló csoport által meg nem adott maradékot a saját elválasztó fizeti, a mért minimummal vágva', () => {
    // A befoglaló csoport 40 pixelt ad: 240 pixelből 150 a panelé (62,5
    // százalék); a minimum 60 / 240 = 25 százalék.
    expect(planReveal(INPUT, () => 40)).toEqual([37.5, 62.5]);
  });

  it('befoglaló csoport nélkül a teljes igényt a saját elválasztó fizeti', () => {
    expect(planReveal({ ...INPUT, minSizePercents: [] }, () => 0)).toEqual([25, 75]);
  });

  it('ha a saját elválasztó nem mozdulhat, az alapállás marad, és a befoglaló csoport kérése egésszel vagy semmivel megy', () => {
    const growContainer = vi.fn(() => 0);
    expect(planReveal({ ...INPUT, canGrow: false }, growContainer)).toBe(INPUT.sizes);
    expect(growContainer).toHaveBeenCalledWith(100, true);
  });

  it('ha a panel már elég nagy, a kérés negatív (a befoglaló csoport az alapállása felé mehet), és az alapállás marad', () => {
    const growContainer = vi.fn(() => 0);
    expect(planReveal({ ...INPUT, requiredPixels: 80 }, growContainer)).toBe(INPUT.sizes);
    expect(growContainer).toHaveBeenCalledWith(-40, false);
  });

  it('ha a minimumok a megnőtt csoportban sem férnek el együtt, az alapállás marad', () => {
    // 60 + 60 pixeles minimum egy 100 pixeles csoportban.
    expect(planReveal({ ...INPUT, availablePixels: 100, minSizePercents: [60, 60] }, () => 0)).toBe(INPUT.sizes);
  });

  it('nem létező panelre a befoglaló csoport végtelen igényt kap, a saját méretek változatlanok', () => {
    const growContainer = vi.fn(() => 0);
    expect(planReveal({ ...INPUT, panelIndex: 2 }, growContainer)).toBe(INPUT.sizes);
    expect(growContainer).toHaveBeenCalledWith(Infinity, false);
  });
});
