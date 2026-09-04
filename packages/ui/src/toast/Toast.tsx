import type { ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './toast.css';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger' | 'ink';

export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface ToastProperties {
  readonly variant?: ToastVariant;
  readonly title?: string;
  readonly message?: string;
  readonly meta?: string;
  readonly action?: ToastAction;
  /**
   * Hiányában a bezárás gomb nem rajzolódik ki.
   */
  readonly onClose?: () => void;
  readonly className?: string;
}

/**
 * A design-token `.toast` értesítés kártya (SPEC-007 6.2, T-008-12). A
 * forrás `ManagedToast` (hover/fókusz szüneteltetés, fókusz-visszaállítás)
 * és az élő régiós bejelentés komplexitása nincs átemelve: az AC csak a
 * viewport pozíciókat és a `push` API-t követeli meg, befecskendezett
 * időzítéssel (lásd `useToasts`).
 */
export function Toast(properties: Readonly<ToastProperties>): ReactElement {
  const { variant = 'info', title, message, meta, action, onClose, className } = properties;

  return (
    <div className={joinClassNames('toast', `toast--${variant}`, className)}>
      <span className="toast__dot" />
      <div className="toast__body">
        {title === undefined ? undefined : <span className="toast__title">{title}</span>}
        {message === undefined ? undefined : <span className="toast__message">{message}</span>}
        {meta === undefined ? undefined : <span className="toast__meta">{meta}</span>}
        {action === undefined ? undefined : (
          <div className="toast__actions">
            <button type="button" className="toast__action" onClick={action.onClick}>
              {action.label}
            </button>
          </div>
        )}
      </div>
      {onClose === undefined ? undefined : (
        <button type="button" className="toast__close" onClick={onClose} aria-label="Dismiss">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
