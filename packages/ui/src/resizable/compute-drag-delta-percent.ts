/**
 * A pointer aktuális és kezdő pozíciója közötti távolságot a konténer
 * tényleges méretének (pixelben) százalékában fejezi ki. Nulla vagy negatív
 * konténerméretre (pl. még el nem rendezett elem, vagy happy-dom alatti
 * teszt, ahol a `getBoundingClientRect()` mindig nulla téglalapot ad) 0-t
 * ad vissza, hogy a hívó `resizeAt` sosem kapjon `NaN` vagy `Infinity`
 * eltolást (SPEC-008 12.2 elve: mért geometria hiányában sincs érvénytelen
 * ág).
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
