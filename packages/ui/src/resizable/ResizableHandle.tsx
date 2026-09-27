import { useContext, type KeyboardEvent, type PointerEvent, type ReactElement } from 'react';
import { ResizableContext } from './resizable-context.ts';
import { resizeAt } from './resize-at.ts';

export interface ResizableHandleProperties {
  /**
   * A bal/felső oldali panel sorszáma, amit ez az elválasztó a következővel
   * párban mozgat.
   */
  readonly beforeIndex: number;
  readonly 'aria-label'?: string;
}

/**
 * A jelentett `aria-valuenow` szorítása a jelentett `aria-valuemin`/`aria-valuemax`
 * közé.
 *
 * MIÉRT KELL: a `Resizable` a mért minimumot minden méretváltozáskor újraméri
 * (2026-09-27: a felfedéskor és a befoglaló csoport méretváltozásakor is), a
 * `sizes` állapotot (a nyers százalékot) viszont ilyenkor nem igazítja, hogy a
 * felhasználó aránya a hely visszatérésekor visszaálljon. Egy szűkebb csoportban
 * (pl. a futás nézet belső, transcript-vs-jóváhagyás csoportja a külső elválasztó
 * húzása után), vagy ha a panelek minimumai együtt sem férnek el, a nyers
 * `sizeBefore` a mért `lowestSize`/`highestSize` tartományon kívül állhat; a
 * kirajzolást ilyenkor a CSS minimum vágja, tehát a jelentett érték a vágott hely.
 * A szorítás csak friss tartománnyal helyes: egy elavult (a felfedés előtti,
 * kisebb csoportból mért) tartomány a helyes értéket is a szélére vágná.
 *
 * A W3C WAI-ARIA 1.2 `separator` szerepe fókuszálható elválasztónál KÖTELEZŐVÉ teszi
 * az `aria-valuenow`-t, ami az elválasztó jelenlegi pozícióját tükrözi
 * (<https://www.w3.org/TR/wai-aria-1.2/#separator>). A tartományon (min-max) kívüli
 * érték a spec leírása szerint érvénytelen, de ezt a specifikáció szövege kizárólag a
 * `meter` szerepnél mondja ki MUST szóval; a `separator`-ra (és a `scrollbar`/`slider`
 * szerepekre) ugyanez nincs kimondva, ez egy nyitva álló következetlenség
 * (<https://github.com/w3c/aria/issues/2025>). Az APG Window Splitter minta szerint
 * mindhárom érték (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`) az ELSŐDLEGES
 * panel méretét írja le (<https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/>),
 * tehát a hármuk közötti ellentmondás félrevezető állapotot jelentene, függetlenül a
 * MUST kérdéstől.
 */
function clampToReportedRange(value: number, lowestSize: number, highestSize: number): number {
  return Math.min(Math.max(value, lowestSize), highestSize);
}

const ARROW_STEP_PERCENT = 5;
const SHIFT_ARROW_STEP_PERCENT = 10;
const HOME_DELTA_PERCENT = -100;
const END_DELTA_PERCENT = 100;

/**
 * Egy `Resizable` elválasztója, `role="separator"` szemantikával. A forrás
 * `Resizable.jsx` billentyűzet kezelését követi (nyilak az elrendezés
 * tengelyén, `Shift` dupla lépésköz, `Home`/`End` a szélső értékre), plusz
 * az ÚJ `Enter` (lásd `Resizable.tsx` fejléc dokumentációja). A hat ARIA
 * attribútum: `aria-orientation`, `aria-label`, `aria-controls`,
 * `aria-valuemin`, `aria-valuemax`, `aria-valuenow`.
 *
 * Az `aria-valuemin` és az `aria-valuemax` a `Home`, illetve az `End`
 * érkezési helye (ugyanaz a `resizeAt` számítás, a mért pixeles minimummal),
 * nem a forrás rögzített 5 és 95 értéke: a W3C APG Window Splitter mintája
 * szerint a kettő az a hely, ahol az elsődleges panel a legkisebb, illetve a
 * legnagyobb (2026-09-25, `Resizable.tsx` fejléc). A fókusz újraméri a
 * paneleket, hogy a felolvasott érték friss legyen.
 */
export function ResizableHandle(properties: Readonly<ResizableHandleProperties>): ReactElement {
  const { beforeIndex, 'aria-label': ariaLabelOverride } = properties;
  const {
    sizes,
    minSizePercents,
    direction,
    activeHandleIndex,
    panelDomId,
    beginDrag,
    resizeByDelta,
    toggleCollapse,
    refreshGeometry,
  } = useContext(ResizableContext);
  const isVertical = direction === 'vertical';
  const sizeBefore = sizes[beforeIndex];
  const lowestSize = resizeAt(sizes, beforeIndex, HOME_DELTA_PERCENT, minSizePercents)[beforeIndex];
  const highestSize = resizeAt(sizes, beforeIndex, END_DELTA_PERCENT, minSizePercents)[beforeIndex];
  const reportedSizeBefore =
    sizeBefore === undefined || lowestSize === undefined || highestSize === undefined
      ? sizeBefore
      : clampToReportedRange(sizeBefore, lowestSize, highestSize);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    beginDrag(beforeIndex, isVertical ? event.clientY : event.clientX);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? SHIFT_ARROW_STEP_PERCENT : ARROW_STEP_PERCENT;
    switch (event.key) {
      case 'ArrowLeft': {
        if (isVertical) {
          return;
        }
        event.preventDefault();
        resizeByDelta(beforeIndex, -step);
        return;
      }
      case 'ArrowRight': {
        if (isVertical) {
          return;
        }
        event.preventDefault();
        resizeByDelta(beforeIndex, step);
        return;
      }
      case 'ArrowUp': {
        if (!isVertical) {
          return;
        }
        event.preventDefault();
        resizeByDelta(beforeIndex, -step);
        return;
      }
      case 'ArrowDown': {
        if (!isVertical) {
          return;
        }
        event.preventDefault();
        resizeByDelta(beforeIndex, step);
        return;
      }
      case 'Home': {
        event.preventDefault();
        resizeByDelta(beforeIndex, HOME_DELTA_PERCENT);
        return;
      }
      case 'End': {
        event.preventDefault();
        resizeByDelta(beforeIndex, END_DELTA_PERCENT);
        return;
      }
      case 'Enter': {
        event.preventDefault();
        toggleCollapse(beforeIndex);
        return;
      }
      default: {
        return;
      }
    }
  };

  return (
    <div
      className={`resizable-handle${activeHandleIndex === beforeIndex ? ' is-dragging' : ''}`}
      role="separator"
      aria-orientation={isVertical ? 'horizontal' : 'vertical'}
      aria-label={ariaLabelOverride ?? `Resize panels ${String(beforeIndex + 1)} and ${String(beforeIndex + 2)}`}
      aria-controls={`${panelDomId(beforeIndex)} ${panelDomId(beforeIndex + 1)}`}
      aria-valuemin={lowestSize === undefined ? undefined : Math.round(lowestSize)}
      aria-valuemax={highestSize === undefined ? undefined : Math.round(highestSize)}
      aria-valuenow={reportedSizeBefore === undefined ? undefined : Math.round(reportedSizeBefore)}
      tabIndex={0}
      onFocus={refreshGeometry}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />
  );
}
