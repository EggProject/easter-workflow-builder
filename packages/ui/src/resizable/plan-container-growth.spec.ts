import { describe, expect, it } from 'vitest';
import { planContainerGrowth } from './plan-container-growth.ts';

const BASE = {
  baseSizes: [62.5, 37.5],
  panelIndex: 1,
  currentPixels: 300,
  availablePixels: 800,
  minSizePercents: [7.5, 7.5],
  canGrow: true,
} as const;

describe('planContainerGrowth', () => {
  it('a panel a kért pixellel nő az előtte álló rovására, és a tényleges növekedést adja vissza', () => {
    expect(planContainerGrowth({ ...BASE, deltaPixels: 100 })).toEqual({ sizes: [50, 50], growthPixels: 100 });
  });

  it('a szomszéd minimumánál megáll, és csak a ténylegesen megadott növekedést adja vissza', () => {
    expect(planContainerGrowth({ ...BASE, deltaPixels: 1000 })).toEqual({ sizes: [7.5, 92.5], growthPixels: 440 });
  });

  it('egy korábbi növekedés után a mért mai méretből számol, és az alapállás alá nem zsugorodik', () => {
    const shrunk = planContainerGrowth({ ...BASE, currentPixels: 400, deltaPixels: -300 });
    expect(shrunk).toEqual({ sizes: BASE.baseSizes, growthPixels: -100 });
  });

  it('ha a csoport nem mozdulhat, az alapállás áll vissza, és a változás a visszaállítás', () => {
    expect(planContainerGrowth({ ...BASE, currentPixels: 400, deltaPixels: 50, canGrow: false })).toEqual({
      sizes: BASE.baseSizes,
      growthPixels: -100,
    });
  });

  it('nem létező panelre a növekedés a mai méret ellentettje (a panel mérete nulla)', () => {
    expect(planContainerGrowth({ ...BASE, panelIndex: 2, deltaPixels: 100 })).toEqual({
      sizes: BASE.baseSizes,
      growthPixels: -300,
    });
  });
});
