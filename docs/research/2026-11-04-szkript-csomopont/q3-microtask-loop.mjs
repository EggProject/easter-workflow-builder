// Q-3: mikrofeladatokkal pörgő szkript (`while (true) { await Promise.resolve() }`):
// megállítja-e az interrupt kezelő az executePendingJobs hívásban.
import { loadModule, shouldInterruptAfterDeadline, log } from './common.mjs';
const QuickJS = await loadModule();
const variants = {
  'await Promise.resolve()': '(async () => { while (true) { await Promise.resolve(); } })()',
  'await null try/catch': '(async () => { for (;;) { try { await null; } catch (e) {} } })()',
  'then lánc': 'new Promise(() => { const spin = () => Promise.resolve().then(spin); spin(); })',
};
for (const [name, code] of Object.entries(variants)) {
  const runtime = QuickJS.newRuntime();
  const context = runtime.newContext();
  let calls = 0;
  const deadlineMs = 300;
  const inner = shouldInterruptAfterDeadline(Date.now() + deadlineMs);
  runtime.setInterruptHandler(() => {
    calls += 1;
    return inner();
  });
  const start = performance.now();
  const promiseHandle = context.unwrapResult(context.evalCode(code));
  const jobs = runtime.executePendingJobs();
  const elapsed = performance.now() - start;
  let jobsOutcome;
  if (jobs.error) {
    jobsOutcome = { error: context.dump(jobs.error) };
    jobs.error.dispose();
  } else {
    jobsOutcome = { executed: jobs.value };
  }
  const state = context.getPromiseState(promiseHandle);
  const promiseState = state.type;
  if (state.type === 'rejected') state.error.dispose();
  if (state.type === 'fulfilled' && state.value) state.value.dispose();
  // A megszakítás után a futó feladatsor maradéka: van-e még függő feladat.
  const pendingAfter = runtime.hasPendingJob();
  let teardown = 'ok';
  try {
    promiseHandle.dispose();
    context.dispose();
    runtime.dispose();
  } catch (e) {
    teardown = String(e?.message).slice(0, 120);
  }
  log('Q-3', {
    variant: name,
    deadlineMs,
    elapsedMs: Math.round(elapsed),
    handlerCalls: calls,
    jobsOutcome,
    promiseState,
    pendingAfter,
    teardown,
  });
}
