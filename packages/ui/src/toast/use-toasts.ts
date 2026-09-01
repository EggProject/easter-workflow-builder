import { useCallback, useRef, useState } from 'react';
import type { ToastProperties } from './Toast.tsx';

export interface ToastRecord extends Omit<ToastProperties, 'onClose'> {
  readonly id: number;
}

export interface PushToastInput extends Omit<ToastProperties, 'onClose'> {
  /**
   * ms; hiányában nincs automatikus eltűnés, `Infinity` esetén sem.
   */
  readonly duration?: number;
}

export interface UseToastsResult {
  readonly toasts: readonly ToastRecord[];
  readonly push: (toast: Readonly<PushToastInput>) => number;
  readonly dismiss: (id: number) => void;
}

export interface UseToastsOptions {
  /**
   * Injektálható időzítő port (SPEC-007 T-008-12: a teszt nem várhat valós
   * időt). Alapértelmezésben `globalThis.setTimeout`.
   */
  readonly scheduleTimeout?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  readonly clearScheduledTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
}

function defaultScheduleTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
  return globalThis.setTimeout(callback, delayMs);
}

function defaultClearScheduledTimeout(handle: ReturnType<typeof setTimeout>): void {
  globalThis.clearTimeout(handle);
}

/**
 * A `push`/`dismiss` toast tár (SPEC-007 6.2, T-008-12). A forrás
 * `ManagedToast` hover/fókusz-szüneteltetés logikája nincs átemelve
 * (nem tagja az AC-nek); az automatikus eltűnés időzítése port mögé
 * van rejtve, hogy a teszt ne várjon valós időt.
 */
export function useToasts(options: Readonly<UseToastsOptions> = {}): UseToastsResult {
  const scheduleTimeout = options.scheduleTimeout ?? defaultScheduleTimeout;
  const clearScheduledTimeout = options.clearScheduledTimeout ?? defaultClearScheduledTimeout;

  const [toasts, setToasts] = useState<readonly ToastRecord[]>([]);
  const nextIdReference = useRef(0);
  const timeoutHandlesReference = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback(
    (id: number): void => {
      const handle = timeoutHandlesReference.current.get(id);
      if (handle !== undefined) {
        clearScheduledTimeout(handle);
        timeoutHandlesReference.current.delete(id);
      }
      setToasts((current) => current.filter((toast) => toast.id !== id));
    },
    [clearScheduledTimeout],
  );

  const push = useCallback(
    (toast: Readonly<PushToastInput>): number => {
      nextIdReference.current += 1;
      const id = nextIdReference.current;
      const { duration, ...rest } = toast;
      setToasts((current) => [...current, { id, ...rest }]);

      if (duration !== undefined && duration !== Infinity) {
        const handle = scheduleTimeout(() => {
          dismiss(id);
        }, duration);
        timeoutHandlesReference.current.set(id, handle);
      }

      return id;
    },
    [scheduleTimeout, dismiss],
  );

  return { toasts, push, dismiss };
}
