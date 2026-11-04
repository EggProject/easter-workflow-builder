// Q-6: mély rekurzió alapértelmezett és megadott setMaxStackSize mellett: a hiba a sandboxban
// keletkezik-e (InternalError/RangeError), vagy a gazdán (WebAssembly RuntimeError, Node RangeError),
// és a modul használható-e utána. Argumentum: a stack méret bájtban ('default': nem hívjuk).
import { loadModule, shouldInterruptAfterDeadline, log } from './common.mjs';
const arg = process.argv[2];
const only = process.argv[3];
const QuickJS = await loadModule();
const cases = {
  'farok rekurzió': 'function f() { return f(); } f()',
  'nem farok rekurzió': 'function g(n) { return 1 + g(n + 1); } g(0)',
  elkapva: 'let r; function h() { return 1 + h(); } try { h(); } catch (e) { r = e.name + ": " + e.message; } r',
  'sok argumentum': 'function k(...a) { return k(...a, 1); } k()',
  'JSON.parse mély': 'JSON.parse("[".repeat(1e6))',
};
for (const [name, code] of Object.entries(cases)) {
  if (only !== undefined && name !== only) continue;
  const runtime = QuickJS.newRuntime();
  // Biztonsági határidő, hogy egy CPU kötött eset ne akassza meg a próbát.
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 10000));
  if (arg !== 'default') runtime.setMaxStackSize(Number(arg));
  const context = runtime.newContext();
  const start = performance.now();
  let outcome;
  try {
    const result = context.evalCode(code);
    if (result.error) {
      const e = context.dump(result.error);
      outcome = { sandboxError: `${e?.name}: ${e?.message}` };
      result.error.dispose();
    } else {
      outcome = { value: context.dump(result.value) };
      result.value.dispose();
    }
  } catch (e) {
    outcome = { hostThrow: `${e?.constructor?.name}: ${String(e?.message).slice(0, 120)}` };
  }
  const elapsedMs = Math.round(performance.now() - start);
  let teardown = 'ok';
  try {
    context.dispose();
    runtime.dispose();
  } catch (e) {
    teardown = `${e?.constructor?.name}: ${String(e?.message).slice(0, 80)}`;
  }
  let afterwards;
  try {
    const rt = QuickJS.newRuntime();
    const ctx = rt.newContext();
    afterwards = ctx.dump(ctx.unwrapResult(ctx.evalCode('6 * 7')));
    ctx.dispose();
    rt.dispose();
  } catch (e) {
    afterwards = `${e?.constructor?.name}: ${String(e?.message).slice(0, 80)}`;
  }
  log('Q-6', { stackSize: arg, case: name, elapsedMs, outcome, teardown, moduleAfterwards: afterwards });
}
