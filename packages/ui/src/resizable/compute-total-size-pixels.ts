/**
 * A húzás teljes tartományát (a konténer szélessége vagy magassága, az
 * iránytól függően) adja vissza pixelben. `null` konténerre 0-t ad - ez a
 * `computeDragDeltaPercent` már meglévő nulla-védelmét terheli, nem újat
 * vezet be -, hogy a hívó (`Resizable.tsx` `beginDrag`) ne kelljen saját
 * elágazást írnia egy, a gyakorlatban sosem null referenciára (a
 * `containerReference` mindig a saját, feltétel nélkül renderelt `<div>`-re
 * mutat, mire egy leszármazott `ResizableHandle` pointer eseményt kaphatna).
 * A null ág mégis tiszta függvényként, közvetlen paraméterátadással
 * tesztelhető - ugyanaz a minta, mint a `menu/Menu.tsx` `isEventInsideMenu`
 * függvényének nullázható paraméterei.
 */
export function computeTotalSizePixels(container: Element | null, isVertical: boolean): number {
  if (container === null) {
    return 0;
  }
  const rect = container.getBoundingClientRect();
  return isVertical ? rect.height : rect.width;
}
