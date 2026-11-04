import type { QuickJSDeferredPromise, QuickJSHandle } from 'quickjs-emscripten-core';
import type { HostCallOutcome } from './host-call-outcome.ts';
import type { HostCallScope } from './host-call-scope.ts';

/**
 * Egy gazda függvény aszinkron hívása a sandbox felé: új QuickJS ígéret
 * (`context.newPromise`), aminek a handle-jét a gazda függvény adja vissza (a
 * könyvtár a visszaadott handle-t maga szabadítja fel, `quickjs-emscripten-core`
 * 0.32.0 `QuickJSDeferredPromise` doksija). A `work` ígéret sosem utasít el: a
 * hibát a `rejected` ág hordozza.
 *
 * A rendezés: ha a lépés jele már lejárt (vége, határidő, külső megszakítás),
 * semmi nem történik, a függő ígéretet a lebontás szabadítja fel (research
 * `2026-11-04-szkript-csomopont.md` Q-2 B, C). Különben az érték vagy a hiba a
 * sandboxba kerül, és a függő feladatok lefutnak (`executePendingJobs`); a
 * szkript folytatása itt fut, az interrupt kezelő alatt. A gazdára kijutó hiba a
 * lépés hibája.
 */
export function startHostCall(scope: HostCallScope, work: Promise<HostCallOutcome>): QuickJSHandle {
  const deferred = scope.context.newPromise();
  scope.pendingCalls.add(deferred);
  void work.then((outcome) => {
    settleHostCall(scope, deferred, outcome);
  });
  return deferred.handle;
}

function settleHostCall(scope: HostCallScope, deferred: QuickJSDeferredPromise, outcome: HostCallOutcome): void {
  if (scope.signal.aborted) {
    return;
  }
  const { context, runtime } = scope;
  try {
    if (outcome.kind === 'resolved') {
      const value = sandboxValue(scope, outcome.json);
      deferred.resolve(value);
      value.dispose();
    } else {
      const error = context.newError({ name: outcome.name, message: outcome.message });
      deferred.reject(error);
      error.dispose();
    }
    scope.pendingCalls.delete(deferred);
    runtime.executePendingJobs().dispose();
  } catch (error) {
    scope.reportHostCrash(error);
  }
}

function sandboxValue(scope: HostCallScope, json: string | undefined): QuickJSHandle {
  const { context } = scope;
  if (json === undefined) {
    return context.undefined;
  }
  return context
    .newString(json)
    .consume((text) => context.unwrapResult(context.callFunction(scope.parse, context.undefined, text)));
}
