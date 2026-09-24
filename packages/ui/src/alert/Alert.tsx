import type { ReactElement, ReactNode } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './alert.css';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'ink';

export interface AlertProperties {
  readonly variant?: AlertVariant;
  readonly title?: string;
  /**
   * Az üzenet törzse (`.alert__message`); hiányában a sor nem rajzolódik ki.
   */
  readonly children?: ReactNode;
  readonly className?: string;
}

/**
 * A forrás variánsonkénti alapértelmezett ikonjai, változatlan SVG
 * geometriával (`eggproject-design-components/components/alert/Alert.jsx`).
 */
const DEFAULT_ICONS: Readonly<Record<AlertVariant, ReactElement>> = {
  info: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v5M10 6.5v.01" />
    </svg>
  ),
  success: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="m7 10 2.2 2.2L13.5 8" />
    </svg>
  ),
  warning: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3 2.5 16h15z" />
      <path d="M10 8v4M10 14.5v.01" />
    </svg>
  ),
  danger: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M7 7l6 6M13 7l-6 6" />
    </svg>
  ),
  ink: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v5M10 6.5v.01" />
    </svg>
  ),
};

/**
 * A design-token `.alert` soron belüli, tartós állapotjelző blokkja (nem
 * toast): a forrás szerint olyan állapotra, ami addig áll fenn, amíg az ok
 * meg nem szűnik. A `danger` variáns `role="alert"`, a többi
 * `role="status"`, ahogy a forrás `Alert.jsx` adja, tehát a megjelenését a
 * képernyőolvasó is bejelenti.
 *
 * A forrás `tone` (`subtle`), `banner`, `icon` felülírás, `onClose` és
 * `actions` propja nincs átemelve, mert a felület egyiket sem használja; a
 * CSS a hozzájuk tartozó szabályokkal együtt bájtra átkerült.
 */
export function Alert(properties: Readonly<AlertProperties>): ReactElement {
  const { variant = 'info', title, children, className } = properties;

  return (
    <div
      className={joinClassNames('alert', `alert--${variant}`, className)}
      role={variant === 'danger' ? 'alert' : 'status'}
    >
      <span className="alert__icon" aria-hidden="true">
        {DEFAULT_ICONS[variant]}
      </span>
      <div className="alert__body">
        {title === undefined ? undefined : <span className="alert__title">{title}</span>}
        {children === undefined ? undefined : <span className="alert__message">{children}</span>}
      </div>
    </div>
  );
}
