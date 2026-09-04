import type { ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import { Toast } from './Toast.tsx';
import type { ToastRecord } from './use-toasts.ts';

export type ToastViewportPosition = 'br' | 'bl' | 'tr' | 'tl' | 'tc' | 'bc';

const POSITION_CLASS_NAME: Readonly<Record<ToastViewportPosition, string | undefined>> = {
  br: undefined,
  bl: 'toast-viewport--bl',
  tr: 'toast-viewport--tr',
  tl: 'toast-viewport--tl',
  tc: 'toast-viewport--tc',
  bc: 'toast-viewport--bc',
};

export interface ToastViewportProperties {
  readonly toasts: readonly ToastRecord[];
  readonly onDismiss: (id: number) => void;
  readonly position?: ToastViewportPosition;
}

/**
 * A design-token `.toast-viewport` konténer (SPEC-007 6.2, T-008-12), hat
 * pozícióval. A forrás élő régiós (aria-live) bejelentés sorbaállítása
 * nincs átemelve, mert nem tagja az AC-nek.
 */
export function ToastViewport(properties: Readonly<ToastViewportProperties>): ReactElement {
  const { toasts, onDismiss, position = 'br' } = properties;

  return (
    <div className={joinClassNames('toast-viewport', POSITION_CLASS_NAME[position])}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => {
            onDismiss(toast.id);
          }}
        />
      ))}
    </div>
  );
}
