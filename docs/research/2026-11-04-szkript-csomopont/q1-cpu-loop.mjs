// Q-1: CPU kötött végtelen ciklus megáll-e az interrupt kezelővel, mennyi idő alatt.
import { loadModule, shouldInterruptAfterDeadline, log } from './common.mjs';
const QuickJS = await loadModule();
for (const deadlineMs of [100, 500, 2000]) {
  const runtime = QuickJS.newRuntime();
  const context = runtime.newContext();
  let calls = 0;
  const inner = shouldInterruptAfterDeadline(Date.now() + deadlineMs);
  runtime.setInterruptHandler(() => {
    calls += 1;
    return inner();
  });
  const start = performance.now();
  const result = context.evalCode('let i = 0; while (true) { i++ }');
  const elapsed = performance.now() - start;
  let error;
  if (result.error) {
    error = context.dump(result.error);
    result.error.dispose();
  } else {
    result.value.dispose();
  }
  // Elkapható-e a szkriptben? try/catch a ciklus körül.
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 100));
  const caught = context.evalCode('let c = "nem kapta el"; try { while (true) {} } catch (e) { c = "elkapta"; } c');
  let caughtOut;
  if (caught.error) {
    caughtOut = { error: context.dump(caught.error) };
    caught.error.dispose();
  } else {
    caughtOut = { value: context.dump(caught.value) };
    caught.value.dispose();
  }
  context.dispose();
  runtime.dispose();
  log('Q-1', {
    deadlineMs,
    elapsedMs: Math.round(elapsed),
    overshootMs: Math.round(elapsed - deadlineMs),
    handlerCalls: calls,
    error,
    tryCatch: caughtOut,
  });
}
