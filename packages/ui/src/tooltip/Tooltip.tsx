import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { joinAriaTokenList } from '../aria-token-list/join-aria-token-list.ts';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './tooltip.css';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';
export type TooltipVariant = 'dark' | 'light' | 'rich';

/**
 * A trigger elem azon propja, amit a `Tooltip` kezel: nyitva a tipp
 * azonosítóját fűzi a hívó saját `aria-describedby` értéke MELLÉ.
 */
export interface TooltipTriggerProperties {
  readonly 'aria-describedby'?: string | undefined;
}

/**
 * A forrás `Tooltip.jsx` propjai, egy az egyben: `content`, `placement`,
 * `variant`, `shortcut` és `delay`, plusz a `children` (a trigger elem).
 */
export interface TooltipProperties {
  /**
   * A trigger: EGY elem, aminek a `aria-describedby` propja a DOM elemre
   * jut (natív elem vagy a propokat továbbadó komponens, pl. `Button`).
   * Billentyűzettel elérhető elem kell (gomb, link, mező); nem fókuszálható
   * elemre a hívó adja a `tabIndex={0}` értéket, a `Tooltip` nem teszi.
   */
  readonly children: ReactElement<TooltipTriggerProperties>;
  /**
   * A tipp tartalma. `null`, `undefined` és az üres szöveg esetén nincs
   * tipp: nem rajzolódik ki panel, és a trigger sem kap hivatkozást.
   */
  readonly content: ReactNode;
  readonly placement?: TooltipPlacement;
  /**
   * `dark` (alapérték) és `light` egy soros szöveges tipp; `rich` a
   * `content` tartalmat közvetlenül, szöveg burkoló nélkül rajzolja, több
   * soros, tagolt tartalomhoz.
   */
  readonly variant?: TooltipVariant;
  /**
   * Billentyű jelölés a tipp jobb oldalán (`kbd` elem), pl. "Ctrl+Z".
   */
  readonly shortcut?: string;
  /**
   * Az egér alatti nyitás késleltetése ezredmásodpercben. A fókuszra nyitás
   * ettől függetlenül azonnali.
   */
  readonly delay?: number;
}

/**
 * A forrás `delay` alapértéke.
 */
const DEFAULT_HOVER_DELAY_MS = 200;

function hasTooltipContent(content: ReactNode): boolean {
  return content !== null && content !== undefined && content !== '';
}

/**
 * A design system `.tooltip` komponense (SPEC-008 5.10, 11.4, M-118): rövid,
 * nem interaktív leírás a trigger mellett. A forrás `Tooltip.jsx` logikája
 * változatlanul, típusos propokkal.
 *
 * Hozzáférhetőségi szerződés (W3C WAI-ARIA APG Tooltip Pattern): a panel
 * `role="tooltip"`, nyitva a trigger `aria-describedby` hivatkozása mutat
 * rá, zárva a panel `hidden`, tehát elhagyja a hozzáférhetőségi fát. Fókuszra
 * azonnal, egér alatt a `delay` után nyílik; az egér elhagyása és a fókusz
 * elvesztése zár, de az egyik nem zárja be azt, amit a másik már nyitva tart.
 * Az `Escape` zár, a fókusz a triggeren marad, és az esemény nem terjed
 * tovább (egy körülvevő modális nem záródik vele együtt). Zárás után a
 * nyitáshoz új egér belépés vagy új fókusz kell. A tipp nem kap fókuszt.
 *
 * Nem átvett a forrásból:
 * - a `Demo` komponens és a demó oldal CSS szabályai (nem a komponens
 *   részei, lásd `tooltip.css` fejléce),
 * - a nem elem gyerek változatlan kirajzolása: a `children` típusa elem, így
 *   az ág típusilag sosem futna le (100 százalékos lefedettség),
 * - a `React` globális: a hookok és a `cloneElement` névvel importáltak.
 *
 * A trigger kezelése a forrás `cloneElement` megoldása. A React
 * dokumentációja a `cloneElement` helyett alternatívákat ajánl (az adatfolyam
 * nehezebben követhető, react.dev/reference/react/cloneElement); a `Menu`
 * témával ellentétben itt a forrás API-ját tartjuk meg, mert a `Tooltip`
 * egyetlen propot ír a triggerre, és nincs szüksége a trigger DOM elemére.
 *
 * Forrás korlátja: a `.tooltip` CSS `pointer-events: none` értéke miatt a
 * panelre nem lehet átvinni az egeret, ezért a WCAG 1.4.13 "Hoverable"
 * feltétele és az APG 3. megjegyzése nem teljesül. A CSS bájtra azonos a
 * forrással, ezért az átemelés nem változtat rajta (lásd a research fájl
 * T-009-50 szekcióját).
 */
export function Tooltip(properties: Readonly<TooltipProperties>): ReactElement {
  const {
    children,
    content,
    placement = 'top',
    variant = 'dark',
    shortcut,
    delay = DEFAULT_HOVER_DELAY_MS,
  } = properties;

  // Az egér és a fókusz külön állapot, hogy az egyik elhagyása ne zárja be
  // azt, amit a másik már nyitva tart.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const openTimerReference = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tooltipId = `${useId()}-tooltip`;
  const hasContent = hasTooltipContent(content);
  const hasShortcut = shortcut !== undefined && shortcut !== '';
  const isOpen = (hovered || focused) && hasContent;

  function cancelHoverOpen(): void {
    clearTimeout(openTimerReference.current);
  }

  function handleMouseEnter(): void {
    cancelHoverOpen();
    openTimerReference.current = setTimeout(() => {
      setHovered(true);
    }, delay);
  }

  function handleMouseLeave(): void {
    cancelHoverOpen();
    setHovered(false);
  }

  // A fókuszra nyitás azonnali: a billentyűzettel érkező felhasználó nem
  // futhat el a leírás elől.
  function handleFocus(): void {
    cancelHoverOpen();
    setFocused(true);
  }

  function handleBlur(): void {
    cancelHoverOpen();
    setFocused(false);
  }

  // A burkolón figyel, mert a fókuszált gyerek keydown eseménye idáig
  // buborékol, globális figyelő nem kell.
  function handleKeyDown(event: ReactKeyboardEvent<HTMLSpanElement>): void {
    if (!isOpen || event.key !== 'Escape') {
      return;
    }
    cancelHoverOpen();
    setHovered(false);
    setFocused(false);
    event.stopPropagation();
  }

  // Lecsatolás után a függő nyitás időzítője nem futhat le. Az időzítő
  // példányonként a ref-ben él, nem modul szintű.
  useEffect(
    () => () => {
      clearTimeout(openTimerReference.current);
    },
    [],
  );

  // A leírást a tényleges fókuszálható gyerek kapja, nem a burkoló. A hívó
  // saját hivatkozása megmarad, a tipp azonosítója csak nyitva kerül mellé.
  const trigger = cloneElement(children, {
    'aria-describedby': joinAriaTokenList(children.props['aria-describedby'], isOpen ? tooltipId : undefined),
  });

  return (
    <span
      className="tooltip-anchor"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {trigger}
      {hasContent && (
        <span
          id={tooltipId}
          role="tooltip"
          hidden={!isOpen}
          className={joinClassNames('tooltip', `tooltip--${placement}`, `tooltip--${variant}`, isOpen && 'is-open')}
        >
          <span className="tooltip__body">
            {variant === 'rich' ? content : <span className="tooltip__text">{content}</span>}
            {hasShortcut && <kbd className="tooltip__shortcut">{shortcut}</kbd>}
          </span>
          <span className="tooltip__arrow" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
