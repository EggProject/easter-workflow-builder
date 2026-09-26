/**
 * A pointer aktuális és kezdő pozíciója közötti távolságot a panelek
 * együttes méretének (pixelben, az elválasztók nélkül,
 * `measure-panel-geometry.ts`) százalékában fejezi ki: a panelek százalékos
 * mérete ennek a százaléka, tehát az elválasztó pontosan a pointerrel
 * együtt mozog. Nulla vagy negatív méretre (mért geometria hiányában, pl.
 * happy-dom alatti teszt, ahol a `getBoundingClientRect()` mindig nulla
 * téglalapot ad) 0-t ad vissza, hogy a hívó `resizeAt` sosem kapjon `NaN`
 * vagy `Infinity` eltolást (SPEC-008 12.2 elve: mért geometria hiányában
 * sincs érvénytelen ág).
 */
export function computeDragDeltaPercent(
  startClientPos: number,
  currentClientPos: number,
  totalSizePixels: number,
): number {
  if (totalSizePixels <= 0) {
    return 0;
  }
  return ((currentClientPos - startClientPos) / totalSizePixels) * 100;
}
