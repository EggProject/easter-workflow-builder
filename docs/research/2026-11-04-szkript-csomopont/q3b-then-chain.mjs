// Q-3b: a `then` lánc változat lebontási assertjének oka: megszakítás nélkül, véges lánccal
// is jelentkezik-e, és a futás kontextus GC-je (runtime.computeMemoryUsage nélkül) segít-e.
import { loadModule, shouldInterruptAfterDeadline, log } from './common.mjs';
const QuickJS = await loadModule();
const cases = {
  'véges then lánc, megszakítás nélkül': {
    code: 'let n = 0; const spin = () => { if (++n < 1000) return Promise.resolve().then(spin); }; spin(); 1',
    interrupt: false,
  },
  'végtelen then lánc, megszakítva': {
    code: 'const spin = () => Promise.resolve().then(spin); spin(); 1',
    interrupt: true,
  },
  'végtelen async ciklus, megszakítva': {
    code: '(async () => { while (true) { await Promise.resolve(); } })(); 1',
    interrupt: true,
  },
  'végtelen then lánc, megszakítva, külső executor nélkül, a lánc nem eredménye a szkriptnek': {
    code: '(() => { const spin = () => { Promise.resolve().then(spin); }; spin(); })(); 1',
    interrupt: true,
  },
};
for (const [name, { code, interrupt }] of Object.entries(cases)) {
  const runtime = QuickJS.newRuntime();
  const context = runtime.newContext();
  if (interrupt) runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 200));
  context.unwrapResult(context.evalCode(code)).dispose();
  const jobs = runtime.executePendingJobs();
  const jobsOutcome = jobs.error ? 'error' : jobs.value;
  if (jobs.error) jobs.error.dispose();
  let teardown = 'ok';
  try {
    context.dispose();
    runtime.dispose();
  } catch (e) {
    teardown = String(e?.message).slice(0, 100);
  }
  log('Q-3b', { case: name, jobsOutcome, teardown });
}
