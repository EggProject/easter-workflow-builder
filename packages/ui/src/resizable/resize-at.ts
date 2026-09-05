const MIN_PANEL_SIZE_PERCENT = 5;
const MAX_PANEL_SIZE_PERCENT = 95;

/**
 * A `handleIndex` és a `handleIndex + 1` sorszámú panel közötti határ
 * eltolása `deltaPercent`-tel, a páros összegének megtartásával és mindkét
 * panel `[5, 95]` tartományban tartásával. Nem módosítja a bemenetet, új
 * tömböt ad vissza - kivéve, ha a két panel mérete hiányzik vagy nem véges
 * szám, ilyenkor a bemenet változatlanul tér vissza.
 *
 * Forrás: eggproject-design-components/components/resizable/Resizable.jsx
 * `resizeAt` függvénye, TypeScriptre portolva (2026-09-05, PLAN-009 T-009-11).
 */
export function resizeAt(sizes: readonly number[], handleIndex: number, deltaPercent: number): readonly number[] {
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
  const maxBefore = Math.min(MAX_PANEL_SIZE_PERCENT, pairTotal - MIN_PANEL_SIZE_PERCENT);
  const newSizeBefore = Math.max(MIN_PANEL_SIZE_PERCENT, Math.min(maxBefore, sizeBefore + deltaPercent));

  const next = [...sizes];
  next[handleIndex] = newSizeBefore;
  next[handleIndex + 1] = pairTotal - newSizeBefore;
  return next;
}
