import { resizeAt } from './resize-at.ts';

/**
 * A `panelIndex` sorszámú panel növelése `targetPercent` méretre, a
 * szomszédja rovására: az előtte álló panel fizet, az első panelnél az utána
 * álló. A panel sosem lesz kisebb a mostaninál (ha a cél kisebb, a méretek
 * változatlanok), és a `resizeAt` határain (a forrás `[5, 95]` tartománya és a
 * mért pixeles minimumok) belül marad, tehát a fizető panel a minimumánál nem
 * lesz kisebb. Nem módosítja a bemenetet.
 *
 * A felfedés (`Resizable` `reveal`) két helyen használja: a felfedendő elemet
 * tartó panelt a saját csoportja, egy beágyazott csoportot tartó panelt a
 * szülő csoport növeli (2026-09-25, SPEC-008 8. szekció 1. pont).
 */
export function growPanel(
  sizes: readonly number[],
  panelIndex: number,
  targetPercent: number,
  minSizePercents: readonly number[],
): readonly number[] {
  const current = sizes[panelIndex];
  if (current === undefined || targetPercent <= current) {
    return sizes;
  }
  return panelIndex > 0
    ? resizeAt(sizes, panelIndex - 1, current - targetPercent, minSizePercents)
    : resizeAt(sizes, panelIndex, targetPercent - current, minSizePercents);
}
