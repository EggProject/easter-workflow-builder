import { growPanel } from './grow-panel.ts';

export interface RevealInput {
  /**
   * A csoport alapállása százalékban: a felfedés előtti méretek, vagy ha a
   * csoport még nem igazodott, a mostaniak.
   */
  readonly sizes: readonly number[];
  /**
   * A felfedendő elemet tartó panel sorszáma.
   */
  readonly panelIndex: number;
  /**
   * A panel szükséges mérete pixelben (`measureRevealRequirement`).
   */
  readonly requiredPixels: number;
  /**
   * A panelek rendelkezésére álló méret pixelben, a mai elrendezésben
   * (`measure-group-available.ts`).
   */
  readonly availablePixels: number;
  /**
   * A panelek pixeles minimuma az `availablePixels` százalékában.
   */
  readonly minSizePercents: readonly number[];
  /**
   * Mozdulhat-e a csoport saját elválasztója (nincs saját arány, és a
   * felhasználó még nem húzta).
   */
  readonly canGrow: boolean;
}

/**
 * A felfedés terve egy csoportban (2026-09-25, SPEC-008 8. szekció 1. pont):
 * ELŐSZÖR a befoglaló csoport ad helyet, a csoport saját arányát megtartva
 * (a `growContainer` a csoport paneljeinek együttes méretét növeli, és
 * visszaadja, mennyivel nőtt ténylegesen; befoglaló csoport nélkül vagy más
 * tengelyen nulla), és csak a maradékot fizeti a saját elválasztó, a
 * felfedendő panel előtti panel rovására, ha mozdulhat. A visszatérési érték
 * a csoport új méretei; ha a panel már elég nagy, az alapállás.
 *
 * A befoglaló csoport kérése a teljes igény: annyi, amennyivel a csoportnak
 * nőnie kell, hogy a panel a saját arányán elérje a szükséges méretet
 * (`szükséges / arány - mai`). Ez negatív is lehet: ha a felfedendő elem
 * rövidebb lett (másik jóváhagyás), a befoglaló csoport az alapállása felé
 * zsugorodik, de az alá nem (`growPanel`).
 */
export function planReveal(
  input: Readonly<RevealInput>,
  growContainer: (deltaPixels: number) => number,
): readonly number[] {
  const { sizes, panelIndex, requiredPixels, availablePixels, minSizePercents, canGrow } = input;
  const share = (sizes[panelIndex] ?? 0) / 100;
  const grownAvailable = availablePixels + growContainer(requiredPixels / share - availablePixels);
  const grownMinimums = minSizePercents.map((minimum) => (minimum * availablePixels) / grownAvailable);
  // Ha a panelek minimumai a megnőtt csoportban sem férnek el együtt, nincs
  // olyan arány, amit a kirajzolás követne (a panelek a minimumukon
  // túllógnak): az alapállás marad.
  if (!canGrow || grownMinimums.reduce((sum, minimum) => sum + minimum, 0) >= 100) {
    return sizes;
  }
  return growPanel(sizes, panelIndex, (requiredPixels / grownAvailable) * 100, grownMinimums);
}
