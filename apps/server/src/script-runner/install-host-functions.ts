import type { QuickJSHandle } from 'quickjs-emscripten-core';
import { fetchForSandbox } from './fetch-for-sandbox.ts';
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
 */
export function installHostFunctions(scope: HostCallScope, root: string): QuickJSHandle[] {
  const { context } = scope;
  const argument = (handles: readonly QuickJSHandle[], index: number): unknown =>
    readJsonArgument(scope, handles[index]);
  const fetchFunction = context.newFunction('fetch', (...argumentHandles) =>
    startHostCall(scope, fetchForSandbox(argument(argumentHandles, 0), argument(argumentHandles, 1), scope.signal)),
  );
  const readText = context.newFunction('readText', (...argumentHandles) =>
    startHostCall(scope, readTextInRoot(root, argument(argumentHandles, 0))),
  );
  const writeText = context.newFunction('writeText', (...argumentHandles) =>
    startHostCall(scope, writeTextInRoot(root, argument(argumentHandles, 0), argument(argumentHandles, 1))),
  );
  const list = context.newFunction('list', (...argumentHandles) =>
    startHostCall(scope, listInRoot(root, argument(argumentHandles, 0))),
  );
  const files = context.newObject();
  context.setProp(files, 'readText', readText);
  context.setProp(files, 'writeText', writeText);
  context.setProp(files, 'list', list);
  context.setProp(context.global, 'fetch', fetchFunction);
  context.setProp(context.global, 'files', files);
  return [fetchFunction, readText, writeText, list, files];
}
