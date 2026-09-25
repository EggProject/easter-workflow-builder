/**
 * A csoport paneljeinek TÉNYLEGESEN rendelkezésre álló mérete a tengelyen,
 * pixelben: a csoport kliens területe mínusz a nem panel gyerekek (az
 * elválasztók) mérete. A panelek százaléka ennek a százaléka.
 *
 * Miért nem a panelek összege (`measurePanelGeometry`): ha a csoport kisebb a
 * panelek pixeles minimumainak összegénél, a panelek a minimumukon állnak és
 * túllógnak a csoporton, tehát az összegük nagyobb a csoportnál (mérve
 * 1000x700-on a futás nézet belső csoportja 34,5 pixel, a két panel 60 és 60).
 * A felfedés (`plan-reveal.ts`) ebből számolja, mekkora csoportban fér el a
 * felfedendő panel, ezért a valódi méret kell neki.
 */
export function measureGroupAvailable(group: Element, isVertical: boolean): number {
  let available = isVertical ? group.clientHeight : group.clientWidth;
  for (const child of group.children) {
    if (child.classList.contains('resizable-panel')) {
      continue;
    }
    const rect = child.getBoundingClientRect();
    available -= isVertical ? rect.height : rect.width;
  }
  return available;
}
