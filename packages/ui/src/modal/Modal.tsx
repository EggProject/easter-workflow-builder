import { useEffect, useId, type ReactElement, type ReactNode } from 'react';
import { joinAriaTokenList } from '../aria-token-list/join-aria-token-list.ts';
import './modal.css';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type ModalIconVariant = 'info' | 'success' | 'warning' | 'danger';

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
 * DOKUMENTÁLT RÉSZHALMAZ. A forrás `Modal.jsx` egy `window` szintű,
 * megosztott dialógus kezelőt (nyitott modálisok verme, görgetés zár,
 * `inert` alapú háttér izoláció, z-index rétegzés), egy `Tab` fókusz
 * csapdát és a fókusz visszaállítását is tartalmazza. Ezek nincsenek
 * átemelve, mert `getComputedStyle`, `getClientRects`, `inert` és
 * `requestAnimationFrame` viselkedésre épülnek, amiket a pinelt happy-dom
 * nem hűen ad vissza: a rájuk írt unit teszt hamis zöldet adna, ugyanaz az
 * érv, mint a `ResizeObserver` tilalmánál (SPEC-007 13.2, M-24, O-8).
 * A jelen spec három modálisa (létrehozás, átnevezés, törlés) sosem nyílik
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

  if (!open) {
    return undefined;
  }

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
        tabIndex={-1}
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy ?? (title === undefined ? undefined : titleId)}
        aria-label={ariaLabel}
        aria-describedby={joinAriaTokenList(ariaDescribedBy, subtitle === undefined ? undefined : descriptionId)}
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
