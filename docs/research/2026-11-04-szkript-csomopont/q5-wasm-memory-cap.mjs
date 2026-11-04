// Q-5: a modul szintű plafon felülírása: newVariant({ wasmMemory }) saját WebAssembly.Memory
// maximummal (lépésenkénti friss modul). Mérve: hol áll meg a foglalás, mi a hiba a sandboxban,
// a gazda fut-e tovább, és a modul használható-e utána.
import variant from '@jitl/quickjs-wasmfile-release-sync';
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core';
import { log } from './common.mjs';
const capMb = Number(process.argv[2]);
const shape = process.argv[3];
const codes = {
  array:
    'const a = []; let n = 0; try { while (true) { a.push(new Array(1e5).fill(1)); n++; } } catch (e) { globalThis.r = [e.name, e.message, n]; } globalThis.a = undefined; JSON.stringify(r)',
  string:
    'const a = []; let n = 0; try { while (true) { a.push("y".repeat(1e6) + n); n++; } } catch (e) { globalThis.r = [e.name, e.message, n]; } JSON.stringify(r)',
  uncaught: 'const a = []; while (true) { a.push(new Array(1e5).fill(1)); }',
};
const memory = new WebAssembly.Memory({ initial: 256, maximum: (capMb * 1024 * 1024) / 65536 });
const QuickJS = await newQuickJSWASMModuleFromVariant(newVariant(variant, { wasmMemory: memory }));
const usesOwnMemory = QuickJS.getWasmMemory() === memory;
const runtime = QuickJS.newRuntime();
runtime.setMemoryLimit(128 * 1024 * 1024);
const context = runtime.newContext();
const start = performance.now();
let outcome;
try {
  const result = context.evalCode(codes[shape]);
  if (result.error) {
    outcome = { error: context.dump(result.error) };
    result.error.dispose();
  } else {
    outcome = context.dump(result.value);
    result.value.dispose();
  }
} catch (e) {
  outcome = { hostThrow: `${e?.name}: ${String(e?.message).slice(0, 120)}` };
}
const elapsedMs = Math.round(performance.now() - start);
let teardown = 'ok';
try {
  context.dispose();
  runtime.dispose();
} catch (e) {
  teardown = String(e?.message).slice(0, 100);
}
let afterwards;
try {
  const rt = QuickJS.newRuntime();
  const ctx = rt.newContext();
  afterwards = ctx.dump(ctx.unwrapResult(ctx.evalCode('6 * 7')));
  ctx.dispose();
  rt.dispose();
} catch (e) {
  afterwards = `${e?.name}: ${String(e?.message).slice(0, 80)}`;
}
log('Q-5', {
  capMb,
  shape,
  usesOwnMemory,
  elapsedMs,
  outcome,
  wasmMemoryMbAfter: Math.round(memory.buffer.byteLength / 1024 / 1024),
  teardown,
  moduleAfterwards: afterwards,
  hostRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
});
