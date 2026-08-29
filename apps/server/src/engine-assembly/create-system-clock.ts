import type { ClockPort } from '@easter-workflow-builder/engine';

/**
 * A `signal.reason` típusa a DOM lib szerint tetszőleges lehet (a `.abort()`
 * hívó dönti el, mit ad át); a Promise elutasítás viszont mindig `Error`
 * példányt kap, hogy a hívó oldal biztonságosan kezelhesse.
 */
function toRejectionError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

/**
 * A `sleep` a `signal` megszakítására elutasítja a Promise-t, a lejárt
 * időzítőre feloldja - a motor ezen a porton át várja az `error_handler`
 * `backoffMs` listáját és a `human_approval` időkorlátját (SPEC-004 3.2
 * táblázat, `clock` sor doksija).
 */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(toRejectionError(signal.reason));
      return;
    }

    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort(): void {
      clearTimeout(timeoutId);
      reject(toRejectionError(signal.reason));
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Az óra port valódi implementációja: a rendszeróra és a beépített
 * `setTimeout` felett (SPEC-004 3.2 táblázat, `clock` sor).
 */
export function createSystemClock(): ClockPort {
  return { nowMs: () => Date.now(), sleep };
}
