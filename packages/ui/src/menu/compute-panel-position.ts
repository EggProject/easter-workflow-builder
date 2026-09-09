export interface PanelPosition {
  /**
   * Nyitás lefelé esetén állítva, felfelé nyitáskor `undefined` (a `Menu`
   * ilyenkor a `bottom` mezőt adja át a `style`-nak).
   */
  readonly top: number | undefined;
  /**
   * Nyitás felfelé esetén állítva (a lábléc-menü esete, ahol a trigger a
   * viewport aljához közel ül): a panel ALJÁT rögzíti a triggerhez képest,
   * a panel MAGASSÁGÁNAK ismerete nélkül - a panel zárva `hidden` (tehát
   * `display: none`), a valós magassága nyitás előtt nem mérhető.
   */
  readonly bottom: number | undefined;
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
 * A `viewportWidth`/`viewportHeight` paraméter explicit (nem
 * `globalThis.innerWidth`/`innerHeight`-et olvas belül), hogy a függvény
 * tiszta, DOM nélkül, valós számokkal közvetlenül tesztelhető legyen - a
 * happy-dom teszt környezet `getBoundingClientRect()`-je mindig nulla
 * téglalapot ad, ami a viewport-szorítás ágát élő DOM-on keresztül
 * tesztelhetetlenné tenné.
 *
 * FÜGGŐLEGES IRÁNY (flip). Ha a trigger alatt kevesebb hely marad a
 * viewport aljáig, mint a trigger fölött a viewport tetejéig, a panel
 * FELFELÉ nyílik: a `bottom` mező áll, a `top` `undefined` marad. Ez egy
 * mért, valódi hiba javítása - a szerkesztő láblécének "További
 * műveletek" triggere a viewport aljához tapad (`page-footer.css`
 * `position: sticky; bottom: 0;`), ahol a korábbi, mindig lefelé nyíló
 * logika a panelt a viewporton kívülre, gyakorlatilag elérhetetlenül
 * helyezte (`apps/web/e2e/graph-editor-layout.spec.ts` mérte: "element is
 * outside of the viewport"). A döntés a panel MAGASSÁGÁNAK ismerete
 * NÉLKÜL működik, mert a `bottom` CSS-tulajdonság a panel alját rögzíti a
 * viewport aljához képest, a magasságot a tartalom önmaga adja.
 */
export function computePanelPosition(
  triggerRect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>,
  align: 'left' | 'right',
  viewportWidth: number,
  viewportHeight: number,
): PanelPosition {
  const idealLeft = align === 'right' ? triggerRect.right - ESTIMATED_PANEL_WIDTH_PX : triggerRect.left;
  const left = clampLeft(idealLeft, ESTIMATED_PANEL_WIDTH_PX, viewportWidth);
  const spaceBelow = viewportHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;
  if (spaceBelow >= spaceAbove) {
    return { top: triggerRect.bottom + PANEL_GAP_PX, bottom: undefined, left };
  }
  return { top: undefined, bottom: viewportHeight - triggerRect.top + PANEL_GAP_PX, left };
}
