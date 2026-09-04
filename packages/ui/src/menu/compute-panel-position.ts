export interface PanelPosition {
  readonly top: number;
  readonly left: number;
}

/**
 * A panel és a trigger közötti rés, pixelben - a forrás `calc(100% + 6px)`
 * szabályának megfelelője.
 */
const PANEL_GAP_PX = 6;

/**
 * A panel becsült szélessége, mielőtt a valós DOM méret ismert lenne - a
 * `menu.css` `min-width: 220px` szabályának megfelelője. A táblázat sor
 * műveletek menüje ma mindig ez alatt marad (rövid, egy soros feliratok:
 * "Átnevezés", "Törlés", "Indítás"), ezért a becslés a jelen felhasználási
 * esetben pontos, nem csak közelítő.
 */
const ESTIMATED_PANEL_WIDTH_PX = 220;

/**
 * A panel és a viewport széle közötti minimális távolság, pixelben.
 */
const VIEWPORT_MARGIN_PX = 8;

function clampLeft(left: number, panelWidth: number, viewportWidth: number): number {
  const maxLeft = viewportWidth - panelWidth - VIEWPORT_MARGIN_PX;
  return Math.min(Math.max(left, VIEWPORT_MARGIN_PX), Math.max(maxLeft, VIEWPORT_MARGIN_PX));
}

/**
 * A panel `position: fixed` koordinátáit számítja a trigger aktuális
 * képernyő-pozíciójából (`triggerRect`, tipikusan a trigger
 * `getBoundingClientRect()` eredménye) és a viewport szélességéből.
 *
 * `align="right"` esetén a panel jobb széle a trigger jobb szélére
 * igazodna, DE az eredmény MINDIG a viewporton belülre van szorítva
 * (`VIEWPORT_MARGIN_PX` ráhagyással a bal szélen). Ez egy mért, valódi hiba
 * javítása (lásd a `Menu.tsx` fejléc dokumentációját): a táblázat sor
 * műveletek triggere keskeny viewporton (pl. 320px) NEM feltétlenül a
 * viewport jobb szélén ül (a "MŰVELETEK" oszlop szélesebb lehet a
 * triggernél), ezért a nyers "jobb szélhez igazítás" a panelt a bal
 * viewport-szélen túlra tolhatja - az `apps/web/e2e/responsive.spec.ts`
 * 320px szélességen ezt ténylegesen elő is idézte.
 *
 * A `viewportWidth` paraméter explicit (nem `globalThis.innerWidth`-et
 * olvas belül), hogy a függvény tiszta, DOM nélkül, valós számokkal
 * közvetlenül tesztelhető legyen - a happy-dom teszt környezet
 * `getBoundingClientRect()`-je mindig nulla téglalapot ad, ami a
 * viewport-szorítás ágát élő DOM-on keresztül tesztelhetetlenné tenné.
 */
export function computePanelPosition(
  triggerRect: Pick<DOMRect, 'bottom' | 'left' | 'right'>,
  align: 'left' | 'right',
  viewportWidth: number,
): PanelPosition {
  const top = triggerRect.bottom + PANEL_GAP_PX;
  const idealLeft = align === 'right' ? triggerRect.right - ESTIMATED_PANEL_WIDTH_PX : triggerRect.left;
  const left = clampLeft(idealLeft, ESTIMATED_PANEL_WIDTH_PX, viewportWidth);
  return { top, left };
}
