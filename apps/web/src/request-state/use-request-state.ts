import type { Outcome } from '@easter-workflow-builder/core';
import { isOkOutcome } from '@easter-workflow-builder/core';
import { useCallback, useState } from 'react';
import type { RequestState } from './request-state.ts';

export interface UseRequestStateResult<TValue> {
  readonly state: RequestState<TValue>;
  /**
   * Lefuttat egy `Outcome`-ot adó feladatot, és beállítja a négy állapot egyikét.
   */
  readonly run: (task: () => Promise<Outcome<TValue>>) => Promise<void>;
  /**
   * Visszaállítja `idle` állapotra (pl. egy modális bezárásakor).
   */
  readonly reset: () => void;
}

/**
 * Egy async pont állapotát vezető React hook (SPEC-007 11. szekció): minden
 * futtatás előtt `pending`, utána `success` vagy `failure`. A hívó ebből
 * dönti el, milyen jelzést rajzoljon (`Skeleton`, `ProgressBar`, letiltott
 * gomb spinnerrel, `Toast`).
 */
export function useRequestState<TValue>(): UseRequestStateResult<TValue> {
  const [state, setState] = useState<RequestState<TValue>>({ status: 'idle' });

  const run = useCallback(async (task: () => Promise<Outcome<TValue>>): Promise<void> => {
    setState({ status: 'pending' });
    const outcome = await task();
    setState(
      isOkOutcome(outcome)
        ? { status: 'success', value: outcome.value }
        : { status: 'failure', message: outcome.message },
    );
  }, []);

  const reset = useCallback((): void => {
    setState({ status: 'idle' });
  }, []);

  return { state, run, reset };
}
