import type { QuickJSHandle } from 'quickjs-emscripten-core';
import { fetchForSandbox } from './fetch-for-sandbox.ts';
import type { HostCallOutcome } from './host-call-outcome.ts';
import type { HostCallScope } from './host-call-scope.ts';
import { listInRoot } from './list-in-root.ts';
import { readJsonArgument } from './read-json-argument.ts';
import { readTextInRoot } from './read-text-in-root.ts';
import { startHostCall } from './start-host-call.ts';
import { writeTextInRoot } from './write-text-in-root.ts';

/**
 * A két gazda név a sandbox globális objektumán (SPEC-014 5.4 "Globális
 * nevek"): `fetch(url, init)` és a `files` objektum `readText`, `writeText` és
 * `list` függvénye, mindegyik ígéretet ad. A `root` a fájl hozzáférés gyökere
 * (abszolút, a JavaScript ág `cwd` mezője, üresen a szerver munkakönyvtára, O-5
 * user döntés). Az argumentumokat a gazda `unknown`-ként olvassa
 * (`readJsonArgument`), az ellenőrzés a hívott függvényé. A visszaadott
 * handle-ök a hívó lebontási listájába kerülnek.
 *
 * A határidő utáni hívás elutasított, az argumentum olvasása nélkül. Az
 * argumentum olvasása a sandbox `JSON.stringify`-ját futtatja, tehát a szkript
 * `toJSON`-ja, gettere vagy Proxy csapdája a gazda hívásán belül fut; ha ott
 * éri a megszakítás, a könyvtár a hibát a sandboxba elkapható hibaként dobja
 * vissza (`quickjs-emscripten-core` 0.32.0 `errorToHandle`: a gazda oldali
 * hibából új `Error` lesz). E szabály nélkül egy, a hívást ciklusban elkapó
 * szkript a megszakítás után is futott, és a gazda szálát korlát nélkül
 * foglalta; vele a megszakítás a szkript saját kódjában, elkaphatatlanul
 * érkezik (PLAN-015 T-015-12).
 */
export function installHostFunctions(scope: HostCallScope, root: string): QuickJSHandle[] {
  const { context } = scope;
  const argument = (handles: readonly QuickJSHandle[], index: number): unknown =>
    readJsonArgument(scope, handles[index]);
  const hostFunction = (
    name: string,
    call: (argumentHandles: readonly QuickJSHandle[]) => Promise<HostCallOutcome>,
  ): QuickJSHandle =>
    context.newFunction(name, (...argumentHandles) => {
      if (scope.isInterrupted()) {
        return { error: context.newError({ name: 'InternalError', message: 'a szkript határideje lejárt' }) };
      }
      return startHostCall(scope, call(argumentHandles));
    });
  const fetchFunction = hostFunction('fetch', (handles) =>
    fetchForSandbox(argument(handles, 0), argument(handles, 1), scope.signal),
  );
  const readText = hostFunction('readText', (handles) => readTextInRoot(root, argument(handles, 0)));
  const writeText = hostFunction('writeText', (handles) =>
    writeTextInRoot(root, argument(handles, 0), argument(handles, 1)),
  );
  const list = hostFunction('list', (handles) => listInRoot(root, argument(handles, 0)));
  const files = context.newObject();
  context.setProp(files, 'readText', readText);
  context.setProp(files, 'writeText', writeText);
  context.setProp(files, 'list', list);
  context.setProp(context.global, 'fetch', fetchFunction);
  context.setProp(context.global, 'files', files);
  return [fetchFunction, readText, writeText, list, files];
}
