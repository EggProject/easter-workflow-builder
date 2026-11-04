// Q-4b: hat-e a setMemoryLimit a WebAssembly lineáris memória növekedésére. Esetenként friss
// modul; mérve a modul memóriája előtte és utána, a runtime malloc_size értéke és a hibaszöveg.
// Argumentum: a korlát MB-ban (-1: nincs korlát), és a foglalás alakja.
import { loadModule, log } from './common.mjs';
const limitMb = Number(process.argv[2]);
const shape = process.argv[3];
const codes = {
  array:
    'const a = []; let n = 0; try { while (true) { a.push(new Array(1e5).fill(1)); n++; } } catch (e) { globalThis.r = [e.name, e.message, n]; } JSON.stringify(r)',
  smallobjects:
    'const a = []; let n = 0; try { while (true) { a.push({ i: n, s: "x" + n }); n++; } } catch (e) { globalThis.r = [e.name, e.message, n]; } JSON.stringify(r)',
  string:
    'const a = []; let n = 0; try { while (true) { a.push("y".repeat(1e6) + n); n++; } } catch (e) { globalThis.r = [e.name, e.message, n]; } JSON.stringify(r)',
};
const QuickJS = await loadModule();
const memMb = () => Math.round(QuickJS.getWasmMemory().buffer.byteLength / 1024 / 1024);
const runtime = QuickJS.newRuntime();
if (limitMb > 0) runtime.setMemoryLimit(limitMb * 1024 * 1024);
const context = runtime.newContext();
const before = memMb();
const start = performance.now();
const result = context.evalCode(codes[shape]);
const elapsedMs = Math.round(performance.now() - start);
let outcome;
if (result.error) {
  outcome = { error: context.dump(result.error) };
  result.error.dispose();
} else {
  outcome = context.dump(result.value);
  result.value.dispose();
}
const usageHandle = runtime.computeMemoryUsage();
const usage = context.dump(usageHandle);
usageHandle.dispose();
let teardown = 'ok';
try {
  context.dispose();
  runtime.dispose();
} catch (e) {
  teardown = String(e?.message).slice(0, 100);
}
log('Q-4b', {
  limitMb,
  shape,
  elapsedMs,
  outcome,
  wasmMemoryMbBefore: before,
  wasmMemoryMbAfter: memMb(),
  memoryUsedSizeMb: Math.round(usage.memory_used_size / 1024 / 1024),
  mallocCount: usage.malloc_count,
  mallocLimit: usage.malloc_limit,
  teardown,
  hostRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
});
