// Q-4: setMemoryLimit(128 MB) mellett nagy tömb és sztring építése: InternalError a sandboxban,
// elkapható-e, a gazda fut-e tovább, a runtime és egy új runtime használható-e.
import { loadModule, log } from './common.mjs';
const QuickJS = await loadModule();
const LIMIT = 128 * 1024 * 1024;
const cases = {
  'tömb, el nem kapva': 'const a = []; while (true) { a.push(new Array(1e5).fill(1)); }',
  'sztring duplázás, el nem kapva': 'let s = "x"; while (true) { s = s + s; }',
  'tömb, elkapva':
    'let r; try { const a = []; while (true) { a.push(new Array(1e5).fill(1)); } } catch (e) { r = e.name + ": " + e.message; } r',
  'ArrayBuffer 200 MB, elkapva':
    'let r; try { new ArrayBuffer(200 * 1024 * 1024); r = "sikerült"; } catch (e) { r = e.name + ": " + e.message; } r',
};
for (const [name, code] of Object.entries(cases)) {
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(LIMIT);
  const context = runtime.newContext();
  const start = performance.now();
  const result = context.evalCode(code);
  const elapsed = Math.round(performance.now() - start);
  let outcome;
  if (result.error) {
    outcome = { error: context.dump(result.error) };
    result.error.dispose();
  } else {
    outcome = { value: context.dump(result.value) };
    result.value.dispose();
  }
  // Ugyanaz a kontextus használható-e utána.
  let sameContextAfter;
  const again = context.evalCode('globalThis.a = undefined; 40 + 2');
  if (again.error) {
    sameContextAfter = context.dump(again.error);
    again.error.dispose();
  } else {
    sameContextAfter = context.dump(again.value);
    again.value.dispose();
  }
  const wasmMb = Math.round(QuickJS.getWasmMemory().buffer.byteLength / 1024 / 1024);
  let teardown = 'ok';
  try {
    context.dispose();
    runtime.dispose();
  } catch (e) {
    teardown = String(e?.message).slice(0, 100);
  }
  const rt2 = QuickJS.newRuntime();
  const ctx2 = rt2.newContext();
  const newRuntime = ctx2.dump(ctx2.unwrapResult(ctx2.evalCode('"új runtime: " + (1 + 1)')));
  ctx2.dispose();
  rt2.dispose();
  log('Q-4', {
    case: name,
    elapsedMs: elapsed,
    outcome: JSON.stringify(outcome).slice(0, 200),
    sameContextAfter,
    wasmMemoryMb: wasmMb,
    teardown,
    newRuntime,
    hostRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
}
