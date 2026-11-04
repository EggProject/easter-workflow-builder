// Q-3c: a megszakított `then` lánc lebontási assertje ismételve: determinisztikus-e, nő-e a
// WebAssembly memória, használható marad-e a modul, és mennyibe kerül egy friss modul betöltése.
import { loadModule, shouldInterruptAfterDeadline, log } from './common.mjs';
const t0 = performance.now();
const QuickJS = await loadModule();
const firstLoadMs = performance.now() - t0;
const memMb = () => Math.round(QuickJS.getWasmMemory().buffer.byteLength / 1024 / 1024);
const before = memMb();
let aborts = 0;
const N = 20;
for (let i = 0; i < N; i += 1) {
  const runtime = QuickJS.newRuntime();
  const context = runtime.newContext();
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 100));
  context.unwrapResult(context.evalCode('const spin = () => Promise.resolve().then(spin); spin(); 1')).dispose();
  const jobs = runtime.executePendingJobs();
  if (jobs.error) jobs.error.dispose();
  try {
    context.dispose();
    runtime.dispose();
  } catch {
    aborts += 1;
  }
}
const after = memMb();
// Használható-e még: 200 rövid runtime egymás után.
let okRuns = 0;
for (let i = 0; i < 200; i += 1) {
  const rt = QuickJS.newRuntime();
  const ctx = rt.newContext();
  if (ctx.dump(ctx.unwrapResult(ctx.evalCode('[1,2,3].map((x) => x * 2).join()'))) === '2,4,6') okRuns += 1;
  ctx.dispose();
  rt.dispose();
}
const loads = [];
for (let i = 0; i < 5; i += 1) {
  const s = performance.now();
  await loadModule();
  loads.push(Math.round(performance.now() - s));
}
log('Q-3c', {
  repetitions: N,
  aborts,
  wasmMemoryMbBefore: before,
  wasmMemoryMbAfter: after,
  okRunsAfter: `${okRuns}/200`,
  firstModuleLoadMs: Math.round(firstLoadMs),
  freshModuleLoadMs: loads,
});
