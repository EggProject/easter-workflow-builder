// Q-2: gazda ígéretre váró szkript: hívódik-e az interrupt kezelő a várakozás alatt,
// megállítja-e a gazda oldali AbortSignal.timeout, és milyen lebontás tiszta.
// Argumentum: a lebontás változata (A: a függő deferred felszabadítása nélkül,
// B: deferred.dispose() előbb, C: B plusz késői resolve a lebontás után).
import { loadModule, shouldInterruptAfterDeadline, log } from './common.mjs';
const mode = process.argv[2] ?? 'B';
const QuickJS = await loadModule();
const runtime = QuickJS.newRuntime();
const context = runtime.newContext();
const deadlineMs = 300;
let calls = 0;
const inner = shouldInterruptAfterDeadline(Date.now() + deadlineMs);
runtime.setInterruptHandler(() => {
  calls += 1;
  return inner();
});
const deferreds = [];
const hostWait = context.newFunction('hostWait', () => {
  const deferred = context.newPromise();
  deferreds.push(deferred);
  return deferred.handle;
});
context.setProp(context.global, 'hostWait', hostWait);
hostWait.dispose();
const start = performance.now();
const evalResult = context.evalCode('(async () => { await hostWait(); return 1; })()');
const promiseHandle = context.unwrapResult(evalResult);
const callsAfterEval = calls;
const jobs = runtime.executePendingJobs();
const callsAfterJobs = calls;
const nativePromise = context.resolvePromise(promiseHandle);
// Az AbortSignal.timeout időzítője nem tartja életben a folyamatot (unref), a próbában
// ezért egy életben tartó időzítő fut, ahogy a szerverben a nyitott socketek.
const keepAlive = setInterval(() => {}, 1000);
const signal = AbortSignal.timeout(deadlineMs);
const aborted = new Promise((resolve) => signal.addEventListener('abort', () => resolve('aborted'), { once: true }));
const outcome = await Promise.race([nativePromise.then(() => 'settled'), aborted]);
const elapsed = performance.now() - start;
const callsDuringWait = calls - callsAfterJobs;
let teardown = 'ok';
let lateResolve = 'n/a';
try {
  if (mode !== 'A') {
    for (const d of deferreds) d.dispose();
  }
  promiseHandle.dispose();
  context.dispose();
  runtime.dispose();
} catch (error) {
  teardown = `${error?.name}: ${error?.message}`;
}
if (mode === 'C') {
  try {
    deferreds[0].resolve();
    lateResolve = 'nem dobott';
  } catch (error) {
    lateResolve = `${error?.name}: ${error?.message}`;
  }
}
// A natív ígéret a lebontás után: rendeződik-e valaha (500 ms várakozás).
const afterTeardown = await Promise.race([
  nativePromise.then(
    (r) => `settled ${r.error ? 'error' : 'value'}`,
    (e) => `rejected ${e?.message}`,
  ),
  new Promise((r) => setTimeout(() => r('függő maradt 500 ms után'), 500)),
]);
clearInterval(keepAlive);
log('Q-2', {
  mode,
  deadlineMs,
  outcome,
  elapsedMs: Math.round(elapsed),
  callsAfterEval,
  jobsExecuted: jobs.error ? 'error' : jobs.value,
  callsDuringJobs: callsAfterJobs - callsAfterEval,
  callsDuringWait,
  deferredAliveAtTeardown: deferreds.map((d) => d.alive),
  teardown,
  lateResolve,
  afterTeardown,
});
