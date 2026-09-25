const MIN_PANEL_SIZE_PERCENT = 5;
const MAX_PANEL_SIZE_PERCENT = 95;

/**
 * A `handleIndex` és a `handleIndex + 1` sorszámú panel közötti határ
 * eltolása `deltaPercent`-tel, a páros összegének megtartásával és mindkét
 * panel `[5, 95]` tartományban tartásával. Nem módosítja a bemenetet, új
 * tömböt ad vissza - kivéve, ha a két panel mérete hiányzik vagy nem véges
 * szám, ilyenkor a bemenet változatlanul tér vissza.
 *
 * A `minSizePercents` a panelek pixeles minimuma százalékban
 * (`measure-panel-geometry.ts`): ha egy panel minimuma az 5 százaléknál
 * nagyobb, az a határ, tehát a bal/felső panel a saját minimuma alá, a
 * jobb/alsó a sajátja alá nem kerülhet. Mérés nélkül (üres tömb) a forrás
 * `[5, 95]` határa marad. Ez az egyetlen eltérés a forrástól
 * (2026-09-25, SPEC-008 14.2 O-12): a forrás CSS pixeles minimuma
 * (`min-height: 60px`) így a jelentett értékben is érvényesül, nem csak a
 * kirajzolásban.
 *
 * Forrás: eggproject-design-components/components/resizable/Resizable.jsx
 * `resizeAt` függvénye, TypeScriptre portolva (2026-09-05, PLAN-009 T-009-11).
 */
export function resizeAt(
  sizes: readonly number[],
  handleIndex: number,
  deltaPercent: number,
  minSizePercents: readonly number[] = [],
): readonly number[] {
  const sizeBefore = sizes[handleIndex];
  const sizeAfter = sizes[handleIndex + 1];
  if (
    sizeBefore === undefined ||
    sizeAfter === undefined ||
    !Number.isFinite(sizeBefore) ||
    !Number.isFinite(sizeAfter)
  ) {
    return sizes;
  }

  const pairTotal = sizeBefore + sizeAfter;
  const minBefore = Math.max(MIN_PANEL_SIZE_PERCENT, minSizePercents[handleIndex] ?? 0);
  const minAfter = Math.max(MIN_PANEL_SIZE_PERCENT, minSizePercents[handleIndex + 1] ?? 0);
  const maxBefore = Math.min(MAX_PANEL_SIZE_PERCENT, pairTotal - minAfter);
  const newSizeBefore = Math.max(minBefore, Math.min(maxBefore, sizeBefore + deltaPercent));

  const next = [...sizes];
  next[handleIndex] = newSizeBefore;
  next[handleIndex + 1] = pairTotal - newSizeBefore;
  return next;
}
