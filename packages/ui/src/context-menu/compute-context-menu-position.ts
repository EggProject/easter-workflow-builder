/**
 * Egy pont a nézetablak (viewport) koordináta rendszerében, pixelben: a
 * menü nyitási pontja (a forrás `position` állapota, tipikusan
 * `{ x: event.clientX, y: event.clientY }`).
 */
export interface ContextMenuPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * A panel `position: fixed` koordinátái, a `style` `left` és `top`
 * mezőjének értéke.
 */
export interface ContextMenuCoordinates {
  readonly left: number;
  readonly top: number;
}

/**
 * A panel és a nézetablak széle közötti minimális távolság, pixelben: a
 * forrás `ContextMenu.jsx` `VIEWPORT_MARGIN` értéke ("positioning-internal;
 * not a token/prop").
 */
const VIEWPORT_MARGIN_PX = 8;

/**
 * Egy tengely szorítása, a forrás `clampAxis` szabálya szerint: a közeli él
 * legalább a margóra kerül, a távoli él legfeljebb a nézetablak mérete
 * mínusz a margó; ha a panel nagyobb a résnél, a közeli margóra tapad. A
 * forrás a nem véges számokat is kezeli, a port nem: a bemenet a
 * `clientX`/`clientY`, az `offsetWidth`/`offsetHeight` és az
 * `innerWidth`/`innerHeight` értéke, mind véges szám. A nulla méret ága
 * marad (ilyenkor csak a közeli él szorul), mert a nem kirajzolt panel
 * mérete nulla.
 */
function clampAxis(anchor: number, size: number, viewportSize: number): number {
  const nearClamped = Math.max(anchor, VIEWPORT_MARGIN_PX);
  if (size <= 0) {
    return Math.round(nearClamped);
  }
  const farLimit = viewportSize - size - VIEWPORT_MARGIN_PX;
  return Math.round(farLimit >= VIEWPORT_MARGIN_PX ? Math.min(nearClamped, farLimit) : VIEWPORT_MARGIN_PX);
}

/**
 * A panel nézetablakhoz szorított `position: fixed` koordinátái a nyitási
 * pontból, a kirajzolt panel méretéből és a nézetablak méretéből. Tiszta
 * függvény, a `menu` téma `compute-panel-position.ts` mintájára: a méretek
 * explicit paraméterek, tehát DOM nélkül, valós számokkal tesztelhető (a
 * happy-dom elrendezést nem számol, a panel mérete ott nulla). Az eredmény
 * egész pixel, mint a forrásban, hogy két mérés összehasonlítása a
 * törtpixeles eltérésre ne váltson.
 */
export function computeContextMenuPosition(
  anchor: ContextMenuPosition,
  panelSize: { readonly width: number; readonly height: number },
  viewportSize: { readonly width: number; readonly height: number },
): ContextMenuCoordinates {
  return {
    left: clampAxis(anchor.x, panelSize.width, viewportSize.width),
    top: clampAxis(anchor.y, panelSize.height, viewportSize.height),
  };
}
