import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import { computePanelPosition, type PanelPosition } from './compute-panel-position.ts';
import { MenuCloseContext } from './menu-close-context.ts';
import { readPanelElement } from './read-panel-element.ts';
import './menu.css';

export type MenuAlign = 'left' | 'right';

/**
 * A triggerre ráterítendő props-ok. A hívó egy render-függvényt ad (nem egy
 * kész elemet, szemben a forrás `cloneElement`-alapú API-jával): ez a
 * fókusz-visszaállításhoz szükséges DOM referenciát és az ARIA huzalozást a
 * `Menu` birtokolja, a hívó pedig szabadon választja meg, milyen gomb
 * jelenik meg (pl. `Button` `icon` variánsa), `as`-alapú elem-tulajdonság
 * egyesítés nélkül.
 */
export interface MenuTriggerProperties {
  readonly ref: (element: HTMLButtonElement | null) => void;
  readonly id: string;
  readonly 'aria-haspopup': 'menu';
  readonly 'aria-expanded': boolean;
  readonly 'aria-controls': string;
  readonly onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}

export interface MenuProperties {
  readonly trigger: (triggerProperties: MenuTriggerProperties) => ReactElement;
  /**
   * A panel igazítása a triggerhez képest. `right` esetén a panel jobb
   * széle a trigger jobb szélére illeszkedik (balra nyílik) - ez kell a
   * táblázat jobb szélén álló triggerhez. Az eredmény MINDIG a viewporton
   * belülre van szorítva (lásd `compute-panel-position.ts`), tehát keskeny
   * viewporton a panel a bal margóra csúszhat, nem pontosan a trigger jobb
   * széléhez.
   */
  readonly align?: MenuAlign;
  readonly children: ReactNode;
}

function queryUsableMenuItems(panel: HTMLDivElement): readonly HTMLButtonElement[] {
  return [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].filter((item) => !item.disabled);
}

function setRovingTabIndex(items: readonly HTMLButtonElement[], target: HTMLButtonElement): void {
  for (const item of items) {
    item.tabIndex = item === target ? 0 : -1;
  }
}

function focusMenuItem(items: readonly HTMLButtonElement[], target: HTMLButtonElement | undefined): void {
  if (target === undefined) {
    return;
  }
  setRovingTabIndex(items, target);
  target.focus();
}

/**
 * Igaz, ha a `target` a `anchor` vagy a `panel` valamelyikének (akár közvetett)
 * leszármazottja. A panel és az anchor a DOM-ban 2026-09-04 óta KÜLÖN ágon
 * áll (lásd a `Menu` fejléc dokumentációját), ezért a "kívülre kattintás"/
 * "fókusz elhagyta a menüt" döntés mindkettőt meg kell vizsgálja.
 */
function isInsideMenu(
  anchor: HTMLSpanElement | null,
  panel: HTMLDivElement | null,
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Node)) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- mérve (bun run test, packages/ui/src/menu): az `anchor?.contains`/`panel?.contains` opcionális láncolás a v8 lefedettségi eszköznél ÖNÁLLÓ, mindkét oldalon lefedendő branch-et hoz létre, holott `anchor`/`panel` a hívási pontokon a gyakorlatban SOHA nem null (lásd a fenti dokumentációt) - a `!== null &&` forma ezt a branch-et NEM hozza létre.
  return (anchor !== null && anchor.contains(target)) || (panel !== null && panel.contains(target));
}

/**
 * A design-token `.menu` lebegő művelet menü (felhasználói kérés: táblázat
 * sor műveletek egy hárompontos triggerből nyílva). A forrás `Menu`/
 * `MenuItem` pár DOKUMENTÁLT RÉSZHALMAZA: a `MenuLabel`, `MenuDivider`,
 * `MenuGroup`, a jelölhető (`checked`) elem, a billentyű-gyorsparancs
 * felirat, az ikon-vezetésű elem és a karakteres típusba-ugrás (typeahead)
 * nincs átemelve, mert a jelen felhasználási eset (2-3 egyszerű szöveges
 * művelet soronként) egyiket sem igényli - lásd `menu.css` fejléce a
 * kihagyott szabályokért.
 *
 * Billentyűzet: a trigger kattintás/`Enter`/`Space` az első elemre nyit,
 * `ArrowDown` az elsőre, `ArrowUp` az utolsóra. A panelen belül
 * `ArrowDown`/`ArrowUp` lép (körbeérve), `Home`/`End` az első/utolsó
 * elemre ugrik, `Escape` zár és a fókuszt a triggerre állítja vissza.
 * Kattintás a panelen kívülre, vagy a fókusz kilépése a menüből (pl. Tab),
 * szintén zár, fókusz-visszaállítás NÉLKÜL (a fókusz ilyenkor már máshova
 * mozdult - ezt egyetlen `handleFocusOut` figyelő dönti el a
 * `relatedTarget` alapján, a forrás `requestAnimationFrame`-alapú
 * Tab-kezelése helyett).
 *
 * PORTÁL, 2026-09-04 óta (a forrástól eltérve). A panel `createPortal`-lal
 * a `document.body`-ba renderelődik, `position: fixed` alakban, a trigger
 * `getBoundingClientRect()`-jéből nyitáskor számított koordinátákkal (lásd
 * `compute-panel-position.ts`) - NEM a trigger DOM-beli szülőjének
 * gyermekeként, ahogy a forrás teszi. Az eltérés oka mért, valódi hiba, nem
 * elővigyázatosság: a táblázat sor műveletek triggere a `DataTable` saját,
 * görgethető törzsében ül (`data-table.css` `.data-table-scroll { overflow:
 * auto; }`), ami a forrás relatív pozícionálású panelét ténylegesen
 * levágta - az `apps/web/e2e/responsive.spec.ts` 320px szélességen ezt elő
 * is idézte (`toBeInViewport({ ratio: 1 })` ~0.61 arányra bukott a menü
 * elemein, mert a panel az `overflow: auto` konténer vágási határán kívül
 * esett). A hivatalos React dokumentáció pontosan erre az esetre ajánlja a
 * portált: "you can use a portal to create a modal dialog that floats
 * above the rest of the page, even if the component... is inside a
 * container with `overflow: hidden`" - és a kontextus (`MenuCloseContext`)
 * és az eseménybuborékolás a React fa szerint működik tovább, a DOM fától
 * függetlenül (react.dev/reference/react-dom/createPortal).
 *
 * A portál önmagában nem volt elég: a triggerhez képesti "jobb szélhez
 * igazítás" (`align="right"`) NEM jelenti azt, hogy a trigger a viewport
 * jobb szélén ülne (a "MŰVELETEK" oszlop szélesebb lehet a triggernél),
 * ezért a nyers jobbra igazítás keskeny viewporton (mérve: 320px) a panelt
 * a viewport BAL szélén túlra tolta. A `compute-panel-position.ts` ezért
 * mindig a viewporton belülre szorítja az eredményt - lásd ott a
 * dokumentációt és a mért esetet reprodukáló tesztet.
 *
 * MARADÉK KORLÁT. A pozíció csak NYITÁSKOR számolódik: ha a trigger körüli
 * görgethető ős (pl. a táblázat törzse) a menü NYITOTT állapotában
 * görgetne, a panel nem követi - ez nem `ResizeObserver`/
 * `IntersectionObserver` alapú újraszámítással van kezelve, mert azok
 * tiltottak a csomagban (`component-boundary-invariant` regresszió,
 * SPEC-007 16. szekció 24. kritériuma). Ez a jelen felhasználási esetben
 * (egy rövid életű, egy soros táblázat sor menü) nem probléma: a menü
 * megnyitása és a kiválasztás között a felhasználó a táblázatot jellemzően
 * nem görgeti.
 */
export function Menu(properties: Readonly<MenuProperties>): ReactElement {
  const { trigger, align = 'left', children } = properties;

  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ top: 0, left: 0 });
  const anchorReference = useRef<HTMLSpanElement | null>(null);
  const panelReference = useRef<HTMLDivElement | null>(null);
  const triggerReference = useRef<HTMLButtonElement | null>(null);
  const openIntentReference = useRef<'first' | 'last'>('first');

  const automaticId = useId();
  const triggerId = `${automaticId}-trigger`;
  const menuId = `${automaticId}-menu`;

  const attachTriggerElement = useCallback((element: HTMLButtonElement | null): void => {
    triggerReference.current = element;
  }, []);

  const closeMenu = useCallback((shouldRestoreFocus: boolean): void => {
    setOpen(false);
    if (shouldRestoreFocus) {
      triggerReference.current?.focus();
    }
  }, []);

  // Kezdő fókusz nyitáskor: az első (vagy `ArrowUp` nyitás esetén az
  // utolsó) használható elemre. A panel mindig csatolva van (`hidden`
  // attribútummal rejtve zárva), tehát nincs szükség csatolási
  // időzítésre - az effekt a `hidden` eltávolítása UTÁN, a DOM commit-ot
  // követően fut.
  useEffect(() => {
    if (!open) {
      return;
    }
    const panel = readPanelElement(panelReference);
    const items = queryUsableMenuItems(panel);
    const target = openIntentReference.current === 'last' ? items.at(-1) : items[0];
    if (target === undefined) {
      panel.focus();
      return;
    }
    focusMenuItem(items, target);
  }, [open]);

  // Escape és kattintás a panelen kívülre: mindkettő zár, amíg a menü
  // nyitva van. `mousedown`-on figyelünk (nem `click`-en), hogy a záró
  // kattintás előbb fusson le, mint egy másik trigger saját nyitása.
  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent): void {
      if (!isInsideMenu(anchorReference.current, panelReference.current, event.target)) {
        closeMenu(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      closeMenu(true);
    }
    globalThis.addEventListener('mousedown', handlePointerDown);
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('mousedown', handlePointerDown);
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeMenu]);

  function focusStep(step: 1 | -1): void {
    const panel = readPanelElement(panelReference);
    const items = queryUsableMenuItems(panel);
    if (items.length === 0) {
      return;
    }
    // eslint-disable-next-line unicorn/prefer-array-index-of -- az `indexOf` a `document.activeElement` (Element | null) típusát nem fogadná el egy HTMLButtonElement[] tömbön típushibás `as` nélkül, amit a projekt tilt.
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + step + items.length) % items.length;
    focusMenuItem(items, items[nextIndex]);
  }

  function focusEdge(edge: 'first' | 'last'): void {
    const panel = readPanelElement(panelReference);
    const items = queryUsableMenuItems(panel);
    focusMenuItem(items, edge === 'first' ? items[0] : items.at(-1));
  }

  function openMenu(triggerElement: HTMLButtonElement, intent: 'first' | 'last'): void {
    openIntentReference.current = intent;
    setPanelPosition(computePanelPosition(triggerElement.getBoundingClientRect(), align, globalThis.innerWidth));
    setOpen(true);
  }

  function handleTriggerClick(event: ReactMouseEvent<HTMLButtonElement>): void {
    if (open) {
      closeMenu(false);
      return;
    }
    openMenu(event.currentTarget, 'first');
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    if (open) {
      focusEdge(event.key === 'ArrowDown' ? 'first' : 'last');
      return;
    }
    openMenu(event.currentTarget, event.key === 'ArrowDown' ? 'first' : 'last');
  }

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        focusStep(1);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        focusStep(-1);
        break;
      }
      case 'Home': {
        event.preventDefault();
        focusEdge('first');
        break;
      }
      case 'End': {
        event.preventDefault();
        focusEdge('last');
        break;
      }
      default: {
        break;
      }
    }
  }

  function handleFocusOut(event: ReactFocusEvent<HTMLElement>): void {
    if (!isInsideMenu(anchorReference.current, panelReference.current, event.relatedTarget)) {
      closeMenu(false);
    }
  }

  return (
    <>
      <span ref={anchorReference} className={joinClassNames('menu-anchor', open && 'is-open')} onBlur={handleFocusOut}>
        {trigger({
          ref: attachTriggerElement,
          id: triggerId,
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          'aria-controls': menuId,
          onClick: handleTriggerClick,
          onKeyDown: handleTriggerKeyDown,
        })}
      </span>
      {createPortal(
        <div
          ref={panelReference}
          id={menuId}
          className="menu"
          role="menu"
          aria-labelledby={triggerId}
          tabIndex={-1}
          hidden={!open}
          style={{ top: panelPosition.top, left: panelPosition.left }}
          onKeyDown={handlePanelKeyDown}
          onBlur={handleFocusOut}
        >
          <MenuCloseContext
            value={() => {
              closeMenu(true);
            }}
          >
            {children}
          </MenuCloseContext>
        </div>,
        document.body,
      )}
    </>
  );
}
