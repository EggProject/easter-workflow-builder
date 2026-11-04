import type { QuickJSHandle } from 'quickjs-emscripten-core';
import type { HostCallScope } from './host-call-scope.ts';

/**
 * Egy gazda függvény argumentumának olvasása `unknown`-ként, a sandbox
 * rögzített `JSON.stringify`-ján át (SPEC-014 5.5: objektum hivatkozás nem megy
 * át). A hiányzó argumentum és a JSON alakkal nem bíró érték (függvény,
 * `undefined`) `undefined`; a JSON-ban nem ábrázolható mező kimarad, ahogy a
 * `JSON.stringify`-nál. A szerializálás sandbox hibája (például egy dobó getter)
 * a gazda függvényből kivételként jut vissza a sandboxba (`unwrapResult`). Az
 * eredményt a hívó typeguarddal ellenőrzi.
 */
export function readJsonArgument(scope: HostCallScope, handle: QuickJSHandle | undefined): unknown {
  if (handle === undefined) {
    return undefined;
  }
  const { context } = scope;
  return context
    .unwrapResult(context.callFunction(scope.stringify, context.undefined, handle))
    .consume((text): unknown => (context.typeof(text) === 'string' ? JSON.parse(context.getString(text)) : undefined));
}
