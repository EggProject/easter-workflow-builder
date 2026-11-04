// Q-3d: a newQuickJSWASMModuleFromVariant minden hívása külön WebAssembly példányt ad-e
// (külön lineáris memória), és a megszakított `then` lánc assertjének gyakorisága 100 próbán.
import { loadModule, shouldInterruptAfterDeadline, log } from './common.mjs';
const a = await loadModule();
const b = await loadModule();
const distinctMemory = a.getWasmMemory() !== b.getWasmMemory();
const results = {};
for (const deadlineMs of [5, 20, 100]) {
  let aborts = 0;
  for (let i = 0; i < 100; i += 1) {
    const QuickJS = await loadModule();
    const runtime = QuickJS.newRuntime();
    const context = runtime.newContext();
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + deadlineMs));
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
  results[`deadline${deadlineMs}ms`] = `${aborts}/100`;
}
log('Q-3d', { distinctMemory, abortsPerDeadline: results });
