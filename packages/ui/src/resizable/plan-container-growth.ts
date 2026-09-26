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
  /**
   * A kérő csoport maga nem mozdulhat (saját aránya van, vagy a felhasználó
   * már húzta): a hely csak akkor ér valamit, ha a teljes kérést fedezi,
   * mert a hiányzó részt a kérő nem fizetheti meg (2026-09-26).
   */
  readonly requiresFullGrowth: boolean;
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
 *
 * **Egésszel vagy semmivel, ha a kérő nem mozdulhat** (2026-09-26, egy
 * független ellenőrzés nyomán): ha a kérő csoportnak saját aránya van, a
 * felfedendő elem a befoglaló csoport minden pixeléből csak a kérő
 * saját arányának megfelelő részt kapja, a többi a kérő másik panelére megy.
 * Ha a kérés a szomszéd minimumáig sem teljesíthető, a mozdulás a felfedést
 * nem hozná létre, csak a szomszédot (a futás nézetben a rajzot) nyomná
 * össze: ilyenkor az alapállás marad. Mozdítható kérőnél a részleges hely is
 * a felfedést szolgálja (a maradékot a kérő saját elválasztója fizeti), ezért
 * ott a csoport a határig ad.
 */
export function planContainerGrowth(input: Readonly<ContainerGrowthInput>): ContainerGrowth {
  const { baseSizes, panelIndex, currentPixels, deltaPixels, availablePixels, minSizePercents, canGrow } = input;
  const targetPercent = ((currentPixels + deltaPixels) / availablePixels) * 100;
  const largestPercent = growPanel(baseSizes, panelIndex, Infinity, minSizePercents)[panelIndex] ?? 0;
  const isWorthGrowing = !input.requiresFullGrowth || targetPercent <= largestPercent;
  const sizes =
    canGrow && isWorthGrowing ? growPanel(baseSizes, panelIndex, targetPercent, minSizePercents) : baseSizes;
  return {
    sizes,
    growthPixels: ((sizes[panelIndex] ?? 0) / 100) * availablePixels - currentPixels,
  };
}
