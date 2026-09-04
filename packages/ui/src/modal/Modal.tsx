import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { joinAriaTokenList } from '../aria-token-list/join-aria-token-list.ts';
import './modal.css';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type ModalIconVariant = 'info' | 'success' | 'warning' | 'danger';

/**
 * A dialóguson belüli, billentyűvel elérhető elemek, DOM sorrendben (a
 * fókusz csapda és a kezdő fókusz erre épül). A `[tabindex]:not([tabindex="-1"])`
 * a dialógus saját, `tabIndex={-1}` gyökerét kizárja.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function queryFocusableElements(dialogElement: HTMLElement): readonly HTMLElement[] {
  return [...dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
}

/**
 * Csak akkor hív fókuszt, ha az elem ténylegesen `HTMLElement` (a
 * `document.activeElement` típusa `Element | null`, és egy SVG eredetű
 * fókusz `SVGElement` lenne, aminek nincs a `.focus()` metódusa a projekt
 * TypeScript szigorával kompatibilis módon elérhető). Ez az ág valódi,
 * mindkét oldala tesztelt (lásd a `.spec.tsx` fájlt).
 */
function focusIfHtmlElement(element: Element | null): void {
  if (element instanceof HTMLElement) {
    element.focus();
  }
}

export interface ModalProperties {
  readonly open: boolean;
  /**
   * A bezárás mindhárom útja ezt hívja: a fejléc gombja, az `Escape`
   * billentyű és (ha engedett) a háttérre kattintás. Hiányában a modális
   * nem zárható be, és a bezárás gomb sem rajzolódik ki.
   */
  readonly onClose?: () => void;
  readonly title?: ReactNode;
  readonly eyebrow?: string;
  readonly subtitle?: string;
  readonly size?: ModalSize;
  readonly icon?: ReactNode;
  readonly iconVariant?: ModalIconVariant;
  readonly footer?: ReactNode;
  readonly closeOnOverlay?: boolean;
  /**
   * A bezárás gomb hozzáférhető felirata; a szöveg a hívóé, a komponens
   * nem ismer nyelvet.
   */
  readonly closeButtonLabel?: string;
  readonly children?: ReactNode;
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  readonly 'aria-describedby'?: string;
}

/**
 * A design-token `.modal-overlay` / `.modal` modális (SPEC-007 6.2,
 * T-008-14). `role="dialog"`, `aria-modal="true"`, és a cím
 * `aria-labelledby` hivatkozással kötődik, tehát az e2e teszt
 * `getByRole('dialog')` locatorral éri el (SPEC-007 13.5 2. pont).
 *
 * FÓKUSZ CSAPDA ÉS FÓKUSZ VISSZAÁLLÍTÁS (PLAN-008 F3-F7 kiegészítés a
 * T-008-14 lezárása után, valós böngészőben mérhető viselkedés, Playwright
 * e2e teszttel is fedve): nyitáskor a dialóguson belüli első fókuszálható
 * elemre kerül a fókusz (üresen a dialógusra magára), a `Tab` a dialóguson
 * belül körbeér, és záráskor a fókusz visszatér a megnyitó elemre. A
 * csatolás egy stabil `ref` callbacken megy, nem `useRef` plusz effektben
 * olvasott `.current`-en: a callback MINDIG a tényleges csatolt elemmel
 * (nyitáskor) vagy `null`-lal (záráskor/unmountkor) hívódik, tehát a
 * `HTMLDivElement | null` szűkítés mindkét ága minden nyitás-zárás cikluson
 * ténylegesen lefut - nincs típusilag garantáltan sosem futó ág
 * (`.claude/CLAUDE.md` 5. szekció).
 *
 * DOKUMENTÁLT RÉSZHALMAZ, a fentieken túl. A forrás `Modal.jsx` egy `window`
 * szintű, megosztott dialógus kezelőt (nyitott modálisok verme, görgetés
 * zár, `inert` alapú háttér izoláció, z-index rétegzés) is tartalmaz. Ez
 * NINCS átemelve, mert `getComputedStyle`, `getClientRects`, `inert` és
 * `requestAnimationFrame` viselkedésre épül, amit a pinelt happy-dom nem
 * hűen ad vissza: a rá írt unit teszt hamis zöldet adna, ugyanaz az érv,
 * mint a `ResizeObserver` tilalmánál (SPEC-007 13.2, M-24, O-8). A jelen
 * spec három modálisa (létrehozás, átnevezés, törlés) sosem nyílik
 * egymásra, tehát a vermet ma semmi nem használná.
 */
export function Modal(properties: Readonly<ModalProperties>): ReactElement | undefined {
  const {
    open,
    onClose,
    title,
    eyebrow,
    subtitle,
    size = 'md',
    icon,
    iconVariant = 'info',
    footer,
    closeOnOverlay = true,
    closeButtonLabel,
    children,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
  } = properties;

  const automaticId = useId();
  const titleId = `${automaticId}-title`;
  const descriptionId = `${automaticId}-description`;

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      onClose?.();
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const previouslyFocusedElementReference = useRef<Element | null>(null);

  const attachDialogElement = useCallback((dialogElement: HTMLDivElement | null): void => {
    if (dialogElement === null) {
      focusIfHtmlElement(previouslyFocusedElementReference.current);
      return;
    }
    previouslyFocusedElementReference.current = document.activeElement;
    const first = queryFocusableElements(dialogElement)[0];
    (first ?? dialogElement).focus();
  }, []);

  if (!open) {
    return undefined;
  }

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') {
      return;
    }
    const dialogElement = event.currentTarget;
    const focusable = queryFocusableElements(dialogElement);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (first === undefined || last === undefined) {
      event.preventDefault();
      dialogElement.focus();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first) {
        event.preventDefault();
        last.focus();
      }
      return;
    }
    if (active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (!closeOnOverlay || event.target !== event.currentTarget) {
          return;
        }
        onClose?.();
      }}
    >
      <div
        ref={attachDialogElement}
        tabIndex={-1}
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy ?? (title === undefined ? undefined : titleId)}
        aria-label={ariaLabel}
        aria-describedby={joinAriaTokenList(ariaDescribedBy, subtitle === undefined ? undefined : descriptionId)}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="modal__header">
          {icon !== undefined && (
            <span className={`modal__icon modal__icon--${iconVariant}`} aria-hidden="true">
              {icon}
            </span>
          )}
          <div className="modal__header-text">
            {eyebrow !== undefined && <span className="modal__eyebrow">{eyebrow}</span>}
            {title !== undefined && (
              <h2 className="modal__title" id={titleId}>
                {title}
              </h2>
            )}
            {subtitle !== undefined && (
              <p className="modal__subtitle" id={descriptionId}>
                {subtitle}
              </p>
            )}
          </div>
          {onClose !== undefined && (
            <button className="modal__close" onClick={onClose} aria-label={closeButtonLabel}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
        {children !== undefined && <div className="modal__body">{children}</div>}
        {footer !== undefined && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
