import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { readPanelElement } from '../menu/read-panel-element.ts';
import {
  computeContextMenuPosition,
  type ContextMenuCoordinates,
  type ContextMenuPosition,
} from './compute-context-menu-position.ts';
import './context-menu.css';

/**
 * Egy menüpont: a látható felirat és az érték, amit a választás a hívónak
 * visszaad.
 */
export interface ContextMenuItem<TValue> {
  readonly value: TValue;
  readonly label: string;
}

export interface ContextMenuProperties<TValue> {
  /**
   * A nyitási pont a nézetablak koordinátáiban (a jobb klikk esemény
   * `clientX`/`clientY` értéke); `undefined` esetén a menü zárva van. A
   * hívó állapotban tartja: minden új objektum új nyitási ciklus (a panel
   * a pontra kerül, és a fókusz az első menüpontra), ahogy a forrásban a
   * nyitott menüre adott újabb jobb klikk is csak áthelyez.
   */
  readonly position: ContextMenuPosition | undefined;
  /**
   * A `role="menu"` panel hozzáférhető neve (`aria-label`). Kötelező, mert a
   * pontra nyitó menünek nincs megnyitó eleme, amire `aria-labelledby`
   * mutathatna (W3C APG Menu and Menubar Pattern, MDN `menu` role).
   */
  readonly label: string;
  readonly items: readonly ContextMenuItem<TValue>[];
  /**
   * A választott menüpont értéke. Utána mindig az `onClose` is lefut.
   */
  readonly onSelect: (value: TValue) => void;
  /**
   * A menü zárást kér (`Escape`, választás, kattintás a panelen kívülre, a
   * fókusz kilépése, görgetés). A hívó erre a `position` értékét
   * `undefined`-re állítja; egy nyitási ciklusban legfeljebb egyszer fut.
   */
  readonly onClose: () => void;
}

interface ContextMenuPlacement extends ContextMenuCoordinates {
  readonly anchor: ContextMenuPosition;
}

function measurePlacement(panel: HTMLDivElement, anchor: ContextMenuPosition): ContextMenuPlacement {
  // Az `offsetWidth`/`offsetHeight` az elrendezés szerinti méret, a
  // belépő animáció `scale()` transzformációja nem hat rá (a forrás indoka).
  return {
    anchor,
    ...computeContextMenuPosition(
      anchor,
      { width: panel.offsetWidth, height: panel.offsetHeight },
      { width: globalThis.innerWidth, height: globalThis.innerHeight },
    ),
  };
}

function queryMenuItems(panel: HTMLDivElement): readonly HTMLButtonElement[] {
  return [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
}

/**
 * A nyíl billentyű célja, körbeérve. Ha a fókusz a panelen magán áll (nem
 * menüponton), lefelé az első, felfelé az utolsó elem a cél, mint a
 * forrásban; üres listán nincs cél.
 */
function findStepTarget(items: readonly HTMLButtonElement[], step: 1 | -1): HTMLButtonElement | undefined {
  // eslint-disable-next-line unicorn/prefer-array-index-of -- az `indexOf` a `document.activeElement` (Element | null) típusát nem fogadná el egy HTMLButtonElement[] tömbön típushibás `as` nélkül, amit a projekt tilt (a `Menu.tsx` azonos sora).
  const currentIndex = items.findIndex((item) => item === document.activeElement);
  if (currentIndex === -1) {
    return step === 1 ? items[0] : items.at(-1);
  }
  return items[(currentIndex + step + items.length) % items.length];
}

/**
 * Görgetés nélküli fókusz (a forrás `focus({ preventScroll: true })`
 * hívása), és csak `HTMLElement` esetén: a `document.activeElement` típusa
 * `Element | null`, egy SVG elem is lehet (a `Modal.tsx` `focusIfHtmlElement`
 * mintája). A görgetés tiltása itt nem csak kozmetika: a menü minden
 * görgetésre zár, tehát egy fókusz okozta görgetés a saját nyitását zárná.
 */
function focusWithoutScroll(element: Element | null | undefined): void {
  if (element instanceof HTMLElement) {
    element.focus({ preventScroll: true });
  }
}

/**
 * A design system `.context-menu` jobb klikk menüje, pontra nyitó, vezérelt
 * alakban (SPEC-008 5.8, 11.4). A forrás `ContextMenu.jsx` a célelemet maga
 * burkolja és a saját `contextmenu` eseményén nyit; itt a nyitást a hívó
 * eseménye adja (a gráf szerkesztőben a React Flow `onPaneContextMenu`), ezért
 * a nyitott állapot és a pont a hívóé (`position`), a komponens pedig a
 * zárásról (`onClose`) és a választásról (`onSelect`) értesít.
 *
 * A forrásból megtartva: `role="menu"` panel `menuitem` gombokkal, nyitáskor
 * az első menüpontra kerül a fókusz (üres listánál a panelre),
 * `ArrowDown`/`ArrowUp` körbeérve lép, `Home`/`End` az első/utolsó elemre
 * ugrik, `Escape` zár és a fókuszt visszaadja annak az elemnek, amelyiken
 * a nyitáskor állt; választás után a fókusz akkor kerül vissza, ha még a
 * panelen van (ha a hívó `onSelect` kezelője máshova vitte, ott marad). A
 * panelen kívüli `mousedown` és a fókusz kilépése (`Tab`) visszaadás nélkül
 * zár; görgetés zár (visszaadással, ha a fókusz a panelen volt), ablak
 * átméretezés újraszorít. A nézetablakhoz szorítás a kirajzolt panel
 * méretéből számol (`compute-context-menu-position.ts`).
 *
 * Eltérések a forrástól:
 * - Nincs célelem burkoló (`.context-menu__target`), tehát nincs saját
 *   `contextmenu` figyelő, `Shift+F10`/`ContextMenu` billentyűs nyitás és a
 *   célelem `aria-haspopup`/`aria-expanded`/`aria-controls` attribútuma; a
 *   panel neve a kötelező `label` prop.
 * - A menüpont csak felirat és érték: a forrás `separator`, `label` típusú
 *   eleme, `icon`, `kbd`, `danger` és `disabled` mezője és a karakteres
 *   típusba-ugrás nincs átemelve (az APG szerint a típusba-ugrás
 *   elhagyható), mert a gráf szerkesztő felvételi menüje egyiket sem
 *   használja; a CSS szabályaik a bájtazonos fájlban megmaradnak.
 * - Minden menüpont `tabIndex={-1}`, a forrás roving `tabIndex=0` írása
 *   nélkül: a W3C APG Menu mintája szerint menüben minden elem `-1`.
 * - A panel `createPortal`-lal a `document.body`-ba kerül (a `Menu` mintája):
 *   a `position: fixed` elem tartalmazó blokkja csak akkor a nézetablak, ha
 *   egyik őse sem `transform`/`filter`/`contain` stb. értékű (MDN, "Layout
 *   and the containing block"), és a pont nézetablak koordináta.
 * - A mérés `useLayoutEffect`-ben fut, a forrás `requestAnimationFrame`
 *   helyett, hogy a szorított hely az első kifestés előtt álljon
 *   (react.dev `useLayoutEffect`, "Measuring layout before the browser
 *   repaints the screen"); a `Tab` zárását a fókusz kilépése dönti el, mint a
 *   `Menu`-ben.
 * - A választás utáni visszaadás feltétele a fókusz a panelen (a forrásban:
 *   menüponton); a panelen kívüli kattintás soha nem ad vissza fókuszt (a
 *   forrás visszaad, ha a fókusz a panelen volt és a kattintás célja nem
 *   fókuszálható), mint a `Menu`-ben.
 * - A gombok `type="button"` attribútumot kapnak.
 *
 * `ResizeObserver` és `IntersectionObserver` nincs (a csomagban tiltott, lásd
 * `component-boundary-invariant`): a panel mérete a nyitáskor, a
 * menüpontok változásakor és az ablak átméretezésekor számolódik újra.
 */
export function ContextMenu<TValue>(properties: Readonly<ContextMenuProperties<TValue>>): ReactElement | undefined {
  const { position, label, items, onSelect, onClose } = properties;

  const panelReference = useRef<HTMLDivElement | null>(null);
  const returnFocusReference = useRef<Element | null>(null);
  const closeRequestedReference = useRef(false);
  const [placement, setPlacement] = useState<ContextMenuPlacement>();

  const requestClose = useCallback(
    (shouldReturnFocus: boolean): void => {
      if (closeRequestedReference.current) {
        return;
      }
      closeRequestedReference.current = true;
      if (shouldReturnFocus) {
        focusWithoutScroll(returnFocusReference.current);
      }
      onClose();
    },
    [onClose],
  );

  useLayoutEffect(() => {
    if (position === undefined) {
      return;
    }
    setPlacement(measurePlacement(readPanelElement(panelReference), position));
  }, [position, items]);

  useEffect(() => {
    if (position === undefined) {
      return;
    }
    closeRequestedReference.current = false;
    const panel = readPanelElement(panelReference);
    // Áthelyezéskor a fókusz már a panelen áll: a visszaadás célja marad.
    if (!panel.contains(document.activeElement)) {
      returnFocusReference.current = document.activeElement;
    }
    focusWithoutScroll(queryMenuItems(panel)[0] ?? panel);
  }, [position]);

  useEffect(() => {
    if (position === undefined) {
      return;
    }
    const anchor = position;
    const panel = readPanelElement(panelReference);
    const handleMouseDown = (event: MouseEvent): void => {
      if (event.target instanceof Node && panel.contains(event.target)) {
        return;
      }
      requestClose(false);
    };
    const handleResize = (): void => {
      setPlacement(measurePlacement(panel, anchor));
    };
    const handleScroll = (): void => {
      requestClose(panel.contains(document.activeElement));
    };
    globalThis.addEventListener('mousedown', handleMouseDown);
    globalThis.addEventListener('resize', handleResize);
    // Elfogó fázis: a beágyazott görgető dobozok `scroll` eseménye nem buborékol.
    globalThis.addEventListener('scroll', handleScroll, { capture: true });
    return () => {
      globalThis.removeEventListener('mousedown', handleMouseDown);
      globalThis.removeEventListener('resize', handleResize);
      globalThis.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [position, requestClose]);

  if (position === undefined) {
    return undefined;
  }

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const panelItems = queryMenuItems(event.currentTarget);
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        focusWithoutScroll(findStepTarget(panelItems, 1));
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        focusWithoutScroll(findStepTarget(panelItems, -1));
        break;
      }
      case 'Home': {
        event.preventDefault();
        focusWithoutScroll(panelItems[0]);
        break;
      }
      case 'End': {
        event.preventDefault();
        focusWithoutScroll(panelItems.at(-1));
        break;
      }
      case 'Escape': {
        event.preventDefault();
        requestClose(true);
        break;
      }
      default: {
        break;
      }
    }
  }

  function handlePanelBlur(event: ReactFocusEvent<HTMLDivElement>): void {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    requestClose(false);
  }

  function handleSelect(value: TValue): void {
    onSelect(value);
    requestClose(readPanelElement(panelReference).contains(document.activeElement));
  }

  const coordinates = placement?.anchor === position ? placement : { left: position.x, top: position.y };

  return createPortal(
    <div
      ref={panelReference}
      className="context-menu"
      role="menu"
      aria-label={label}
      tabIndex={-1}
      style={{ left: coordinates.left, top: coordinates.top }}
      onKeyDown={handlePanelKeyDown}
      onBlur={handlePanelBlur}
    >
      {items.map((item, index) => (
        <button
          // A forrás is a sorszámot adja kulcsnak; a menüpontoknak nincs saját azonosítója.
          key={index}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="context-menu__item"
          onClick={() => {
            handleSelect(item.value);
          }}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
