// Q-2b: a Q-2 A változat (függő deferred a lebontáskor) után használható-e még ugyanaz a
// WebAssembly modul, és egy újonnan betöltött modul.
import { loadModule, log } from './common.mjs';
const QuickJS = await loadModule();
const runtime = QuickJS.newRuntime();
const context = runtime.newContext();
const deferred = context.newPromise();
context.setProp(context.global, 'p', deferred.handle);
let teardown = 'ok';
try {
  context.dispose();
  runtime.dispose();
} catch (e) {
  teardown = String(e?.message).slice(0, 80);
}
const probe = (mod) => {
  try {
    const rt = mod.newRuntime();
    const ctx = rt.newContext();
    const v = ctx.dump(ctx.unwrapResult(ctx.evalCode('1 + 1')));
    ctx.dispose();
    rt.dispose();
    return `működik (${v})`;
  } catch (e) {
    return `${e?.name}: ${String(e?.message).slice(0, 100)}`;
  }
};
const sameModule = probe(QuickJS);
const freshModule = probe(await loadModule());
log('Q-2b', { teardown, sameModuleAfterAbort: sameModule, freshlyLoadedModule: freshModule });
