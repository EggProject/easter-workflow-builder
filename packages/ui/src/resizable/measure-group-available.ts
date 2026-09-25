import { readPixels } from './read-pixels.ts';

/**
 * A csoport paneljeinek TÉNYLEGESEN rendelkezésre álló mérete a tengelyen,
 * pixelben: a csoport befoglaló doboza a két szegélye nélkül (a kitöltés
 * doboza), mínusz a nem panel gyerekek (az elválasztók) mérete. A panelek
 * százaléka ennek a százaléka.
 *
 * Miért nem a panelek összege (`measurePanelGeometry`): ha a csoport kisebb a
 * panelek pixeles minimumainak összegénél, a panelek a minimumukon állnak és
 * túllógnak a csoporton, tehát az összegük nagyobb a csoportnál (mérve
 * 1000x700-on a futás nézet belső csoportja 34,5 pixel, a két panel 60 és 60).
 * A felfedés (`plan-reveal.ts`) ebből számolja, mekkora csoportban fér el a
 * felfedendő panel, ezért a valódi méret kell neki.
 *
 * Miért nem a `clientHeight`/`clientWidth` (2026-09-26 óta): az egész számra
 * kerekített érték (CSSOM View: `readonly attribute long clientHeight`,
 * <https://drafts.csswg.org/cssom-view/>; MDN: "An integer"), a panelek mérete
 * viszont tört pixel (`getBoundingClientRect`). A felfedés a hívó minden
 * renderelésekor újra fut (`Resizable` `reveal`), és a kerekítés hibája a
 * befoglaló csoport tervébe is bekerül: egy fél pixellel eltérő mérés minden
 * futáskor kicsit más méretet adhatna. A tört pixeles mérés mellett egy
 * változatlan elrendezés újramérése ugyanazt a tervet adja.
 */
export function measureGroupAvailable(group: Element, isVertical: boolean): number {
  const rect = group.getBoundingClientRect();
  const style = globalThis.getComputedStyle(group);
  let available = isVertical
    ? rect.height - readPixels(style.borderTopWidth) - readPixels(style.borderBottomWidth)
    : rect.width - readPixels(style.borderLeftWidth) - readPixels(style.borderRightWidth);
  for (const child of group.children) {
    if (child.classList.contains('resizable-panel')) {
      continue;
    }
    const childRect = child.getBoundingClientRect();
    available -= isVertical ? childRect.height : childRect.width;
  }
  return available;
}
