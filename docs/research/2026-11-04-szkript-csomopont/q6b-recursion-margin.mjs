// Q-6b: a stack korlát tartaléka: a gazda oldali hívási mélység (a szerverben a kiértékelés
// mélyebb gazda veremből indul) mellett is a sandboxban marad-e a hiba, és mekkora rekurziós
// mélység fér a korlátba. Argumentumok: stack méret bájtban, gazda oldali előfogyasztás (keret).
import { loadModule, log } from './common.mjs';
const stackSize = Number(process.argv[2]);
const hostDepth = Number(process.argv[3]);
const QuickJS = await loadModule();
const cases = {
  'mélység számlálás': 'let d = 0; function g() { d++; return 1 + g(); } try { g(); } catch (e) {} d',
  'nem farok rekurzió': 'function g(n) { return 1 + g(n + 1); } g(0)',
  'sok argumentum': 'function k(...a) { return k(...a, 1); } k()',
  'JSON.parse mély': 'JSON.parse("[".repeat(1e6))',
  'JSON.stringify mély':
    'let o = {}; let c = o; for (let i = 0; i < 1e5; i++) { c.x = {}; c = c.x; } JSON.stringify(o).length',
  'forrás elemzés mély': 'eval("(".repeat(1e5) + "1" + ")".repeat(1e5))',
  'getter lánc': 'const o = {}; Object.defineProperty(o, "x", { get() { return this.x; } }); o.x',
  'Proxy lánc': 'let p = {}; for (let i = 0; i < 1e5; i++) p = new Proxy(p, {}); p.x',
  'toString rekurzió': 'const o = { toString() { return String(this); } }; String(o)',
};
const runCase = (code) => {
  const runtime = QuickJS.newRuntime();
  runtime.setMaxStackSize(stackSize);
  const context = runtime.newContext();
  let outcome;
  try {
    const result = context.evalCode(code);
    if (result.error) {
      const e = context.dump(result.error);
      outcome = `sandbox ${e?.name}: ${e?.message}`;
      result.error.dispose();
    } else {
      outcome = `érték ${context.dump(result.value)}`;
      result.value.dispose();
    }
  } catch (e) {
    outcome = `GAZDA ${e?.constructor?.name}: ${String(e?.message).slice(0, 60)}`;
  }
  let teardown = 'ok';
  try {
    context.dispose();
    runtime.dispose();
  } catch (e) {
    teardown = 'assert';
  }
  return { outcome, teardown };
};
const atDepth = (depth, fn) => (depth <= 0 ? fn() : atDepth(depth - 1, fn));
const results = {};
for (const [name, code] of Object.entries(cases)) results[name] = atDepth(hostDepth, () => runCase(code));
log('Q-6b', { stackSize, hostDepth, results });
