// Q-4c: a runtime memória könyvelése (computeMemoryUsage) egy ismert méretű foglalás után:
// a malloc_size mező mit számol az emscripten buildben.
import { loadModule, log } from './common.mjs';
const QuickJS = await loadModule();
const runtime = QuickJS.newRuntime();
const context = runtime.newContext();
const read = () => {
  const h = runtime.computeMemoryUsage();
  const v = context.dump(h);
  h.dispose();
  return v;
};
const memMb = () => Math.round(QuickJS.getWasmMemory().buffer.byteLength / 1024 / 1024);
const u0 = read();
const w0 = memMb();
context.unwrapResult(context.evalCode('globalThis.big = "z".repeat(100 * 1024 * 1024); 0')).dispose();
const u1 = read();
const w1 = memMb();
log('Q-4c', {
  keys: Object.keys(u0).slice(0, 6),
  before: {
    malloc_size: u0.malloc_size,
    malloc_count: u0.malloc_count,
    memory_used_size: u0.memory_used_size,
    str_size: u0.str_size,
  },
  after100MbString: {
    malloc_size: u1.malloc_size,
    malloc_count: u1.malloc_count,
    memory_used_size: u1.memory_used_size,
    str_size: u1.str_size,
  },
  wasmMemoryMb: [w0, w1],
});
context.unwrapResult(context.evalCode('globalThis.big = undefined; 0')).dispose();
context.dispose();
runtime.dispose();
