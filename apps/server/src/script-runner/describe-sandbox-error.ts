import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import type { QuickJSContext, QuickJSHandle } from 'quickjs-emscripten-core';

/**
 * A sandboxban dobott érték szövege a lépés hibaüzenetébe: `Error` alakú
 * értékre a QuickJS által adott `name` és `message`, minden másra egy rögzített
 * mondat. A `stack` szándékosan kimarad: a hibaüzenet a szkript saját hibáját
 * mondja el, a gazda környezetéből (útvonal, verem) semmit (SPEC-014 5.7). A
 * `dump` a QuickJS saját szerializálója (`quickjs-emscripten-core` 0.32.0
 * `QuickJSContext.dump`); az eredménye `any` típusú, ezért `unknown`-ként
 * olvassuk, guarddal. A handle-t nem szabadítja fel, az a hívó listájában van.
 */
export function describeSandboxError(context: QuickJSContext, handle: QuickJSHandle): string {
  const dumped: unknown = context.dump(handle);
  if (isRecord(dumped) && isString(dumped['name']) && isString(dumped['message'])) {
    return `${dumped['name']}: ${dumped['message']}`;
  }
  return 'a dobott érték nem Error objektum';
}
