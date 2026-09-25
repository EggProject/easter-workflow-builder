import { growPanel } from './grow-panel.ts';

export interface ContainerGrowthInput {
  /**
   * A csoport alapállása százalékban: az első kérés előtti méretek.
   */
  readonly baseSizes: readonly number[];
  /**
   * A beágyazott csoportot tartó panel sorszáma.
   */
  readonly panelIndex: number;
  /**
   * A panel mért, kirajzolt mérete pixelben (egy korábbi kérés már
   * növelhette).
   */
  readonly currentPixels: number;
  /**
   * Mennyivel kellene a panelnek a mai méretéhez képest nőnie, pixelben
   * (negatív is lehet).
   */
  readonly deltaPixels: number;
  readonly availablePixels: number;
  readonly minSizePercents: readonly number[];
  /**
   * Mozdulhat-e a csoport elválasztója: nincs saját arány, a felhasználó még
   * nem húzta, és a kérő csoport ugyanazon a tengelyen áll.
   */
  readonly canGrow: boolean;
}

export interface ContainerGrowth {
  readonly sizes: readonly number[];
  /**
   * A panel méretének változása a mai elrendezéshez képest, pixelben.
   */
  readonly growthPixels: number;
}

/**
 * Egy beágyazott csoport kérésének terve a befoglaló csoportban (2026-09-25,
 * SPEC-008 8. szekció 1. pont): a panel az alapállásából indulva a kért
 * méretre nő, de az alapállása alá nem megy, és a szomszédja a minimumánál
 * kisebb nem lesz (`growPanel`). Ha a csoport nem mozdulhat, az alapállás
 * áll vissza (egy korábbi kérés visszavonása, például más tengelyre váltáskor).
 */
export function planContainerGrowth(input: Readonly<ContainerGrowthInput>): ContainerGrowth {
  const { baseSizes, panelIndex, currentPixels, deltaPixels, availablePixels, minSizePercents, canGrow } = input;
  const sizes = canGrow
    ? growPanel(baseSizes, panelIndex, ((currentPixels + deltaPixels) / availablePixels) * 100, minSizePercents)
    : baseSizes;
  return {
    sizes,
    growthPixels: ((sizes[panelIndex] ?? 0) / 100) * availablePixels - currentPixels,
  };
}
