import path from 'node:path';
import { describeErrorType } from '@easter-workflow-builder/core';
import type { ScriptRunRequest, ScriptRunResult } from '@easter-workflow-builder/engine';
import {
  shouldInterruptAfterDeadline,
  type QuickJSContext,
  type QuickJSDeferredPromise,
  type QuickJSHandle,
  type QuickJSRuntime,
  type VmCallResult,
} from 'quickjs-emscripten-core';
import { describeSandboxError } from './describe-sandbox-error.ts';
import { disposeQuietly } from './dispose-quietly.ts';
import type { HostCallScope } from './host-call-scope.ts';
import { installHostFunctions } from './install-host-functions.ts';
import { loadQuickJsModule } from './load-quickjs-module.ts';
import { SCRIPT_FILE_NAME } from './script-file-name.ts';
import { SCRIPT_SANDBOX_LIMITS } from './script-sandbox-limits.ts';
import { waitForSettlement } from './wait-for-settlement.ts';
import { wrapScriptSource } from './wrap-script-source.ts';

/**
 * A sandbox előkészítő kódja, a szkript előtt fut. A futás kontextust JSON
 * szövegként kapja, a sandboxban értelmezi, és a neveket a globális objektumra
 * teszi (SPEC-014 5.5: objektum hivatkozás nem megy át); a visszaadott függvény
 * a szkript eredményét alakítja JSON szöveggé (SPEC-014 5.6). A `JSON` és az
 * `Object.keys` a szkript előtt rögzül, tehát a szkript felülírása nem hat rájuk.
 * Globális nevet maga nem hagy hátra.
 */
const PRELUDE_SOURCE =
  '((stringify, parse, keys, global) => (text) => {' +
  ' const values = parse(text);' +
  ' for (const key of keys(values)) { global[key] = values[key]; }' +
  ' return (value) => stringify(value);' +
  ' })(JSON.stringify, JSON.parse, Object.keys, globalThis)';

/**
 * A sandbox `JSON.parse`-a, a szkript előtt rögzítve: a gazda függvények
 * eredménye ezzel lesz sandbox érték (`start-host-call.ts`).
 */
const PARSE_SOURCE = 'JSON.parse';

/**
 * A lépés futás közbeni állapota: a lebontandó handle-ök, a még nem rendezett
 * gazda hívások, a fájl hozzáférés gyökere, a gazda hívások jele (a kérés jele
 * és a lépés vége együtt) és az interrupt kezelő jelzése.
 */
interface SandboxStep {
  readonly context: QuickJSContext;
  readonly runtime: QuickJSRuntime;
  readonly handles: QuickJSHandle[];
  readonly pendingCalls: Set<QuickJSDeferredPromise>;
  readonly root: string;
  readonly hostSignal: AbortSignal;
  readonly timeoutMs: number;
  readonly deadlineMs: number;
  readonly state: { interrupted: boolean };
}

/**
 * A kiértékelés vége: a szkript ígéretének rendeződése, vagy egy gazda hívás
 * rendezésekor a gazdára kijutó hiba.
 */
type SandboxCompletion =
  | { readonly kind: 'evaluated'; readonly result: VmCallResult<QuickJSHandle> }
  | { readonly kind: 'host_crashed'; readonly error: unknown };

/**
 * Egy JavaScript szkript lépés lefuttatása friss QuickJS modulon (SPEC-014 5.4
 * ... 5.8). A menet:
 *
 * 1. A határidő a lépés indulásától számít (`timeoutMs` vagy 60 000 ms).
 * 2. Friss modul saját memória korláttal, új runtime `setMaxStackSize`-zal és az
 *    interrupt kezelővel (a CPU kötött kód ága, research
 *    `2026-11-04-szkript-csomopont.md` Q-1, Q-3), új kontextus.
 * 3. A futás kontextus jelen lévő nevei JSON-ként a globális objektumra; a
 *    `undefined` értékű nevet a `JSON.stringify` kihagyja, tehát a hiányzó név a
 *    sandboxban sem létezik (SPEC-010 7.3 táblázata, a port leírása szerint).
 *    Mellettük a `fetch` és a `files` gazda függvény (5.4 "Hálózat", "Fájl"), a
 *    fájl gyökér a `cwd`, üresen a szerver munkakönyvtára (O-5).
 * 4. A csomagolt törzs kiértékelése, az ígéret a `resolvePromise` úton, a függő
 *    feladatok az `executePendingJobs` hívással; a várakozás a gazda oldali
 *    határidővel és a kérés jelével versenyez (`waitForSettlement`).
 * 5. A visszatérési érték a sandboxban `JSON.stringify`, a gazdán `JSON.parse`.
 *
 * A hibák: az interrupt kezelő vagy a gazda határidő `script_timed_out`; a
 * dobott kivétel, az el nem kapott `InternalError: out of memory` (Q-5) és a
 * gazdára kijutó hiba (a mély `JSON.stringify` `RangeError`-ja, Q-6)
 * `script_evaluation_failed`; a nem JSON eredmény `script_output_not_json`; a
 * kérés jele `aborted`. A lebontás minden ágon fut: előbb a lépés jele lejár (a
 * folyamatban lévő hálózati kérés megszakad, a késői gazda eredmény eldobva),
 * utána a függő gazda ígéretek, a handle-ök, a kontextus és a runtime
 * szabadul fel (Q-2 B); a hibája elkapott (Q-2, Q-3).
 */
export async function runScript(request: ScriptRunRequest): Promise<ScriptRunResult> {
  const timeoutMs = request.timeoutMs ?? SCRIPT_SANDBOX_LIMITS.defaultTimeoutMs;
  try {
    return await runInFreshModule(request, timeoutMs, Date.now() + timeoutMs);
  } catch (error) {
    return hostFailure(error);
  }
}

async function runInFreshModule(
  request: ScriptRunRequest,
  timeoutMs: number,
  deadlineMs: number,
): Promise<ScriptRunResult> {
  const quickJs = await loadQuickJsModule(request.memoryLimitMb);
  if (request.signal.aborted) {
    return { kind: 'aborted' };
  }
  const runtime = quickJs.newRuntime();
  runtime.setMaxStackSize(SCRIPT_SANDBOX_LIMITS.maxStackSizeBytes);
  const state = { interrupted: false };
  const isPastDeadline = shouldInterruptAfterDeadline(deadlineMs);
  runtime.setInterruptHandler((interruptedRuntime) => {
    state.interrupted = isPastDeadline(interruptedRuntime) === true;
    return state.interrupted;
  });
  const context = runtime.newContext();
  const stepEnd = new AbortController();
  const step: SandboxStep = {
    context,
    runtime,
    handles: [],
    pendingCalls: new Set(),
    root: path.resolve(request.cwd ?? process.cwd()),
    hostSignal: AbortSignal.any([request.signal, stepEnd.signal]),
    timeoutMs,
    deadlineMs,
    state,
  };
  try {
    return await evaluateInSandbox(step, request);
  } finally {
    stepEnd.abort();
    disposeQuietly([...step.pendingCalls, ...step.handles], context, runtime);
  }
}

async function evaluateInSandbox(step: SandboxStep, request: ScriptRunRequest): Promise<ScriptRunResult> {
  const { context, runtime, handles } = step;
  const keep = (handle: QuickJSHandle): QuickJSHandle => {
    handles.push(handle);
    return handle;
  };
  const { input, steps, item, itemIndex, iteration, joinInputs, error } = request.runContext;
  const installer = keep(context.unwrapResult(context.evalCode(PRELUDE_SOURCE, 'prelude.js')));
  const contextText = keep(
    context.newString(JSON.stringify({ input, steps, item, itemIndex, iteration, joinInputs, error })),
  );
  const stringify = keep(context.unwrapResult(context.callFunction(installer, context.undefined, contextText)));
  const parse = keep(context.unwrapResult(context.evalCode(PARSE_SOURCE, 'host.js')));
  const hostCrash = Promise.withResolvers<SandboxCompletion>();
  const scope: HostCallScope = {
    context,
    runtime,
    stringify,
    parse,
    signal: step.hostSignal,
    pendingCalls: step.pendingCalls,
    reportHostCrash: (crash) => {
      hostCrash.resolve({ kind: 'host_crashed', error: crash });
    },
  };
  for (const handle of installHostFunctions(scope, step.root)) {
    keep(handle);
  }

  const evaluated = context.evalCode(wrapScriptSource(request.source), SCRIPT_FILE_NAME);
  if (evaluated.error !== undefined) {
    return thrownFailure(step, keep(evaluated.error), 'script_evaluation_failed', 'a szkript hibát dobott');
  }
  const evaluation = evaluatedCompletion(context.resolvePromise(keep(evaluated.value)));
  runtime.executePendingJobs().dispose();
  const settlement = await waitForSettlement(
    Promise.race([evaluation, hostCrash.promise]),
    step.deadlineMs,
    request.signal,
  );
  switch (settlement.kind) {
    case 'aborted': {
      return { kind: 'aborted' };
    }
    case 'timed_out': {
      return timedOut(step);
    }
    case 'settled': {
      if (settlement.value.kind === 'host_crashed') {
        return hostFailure(settlement.value.error);
      }
      const { result } = settlement.value;
      if (result.error !== undefined) {
        return thrownFailure(step, keep(result.error), 'script_evaluation_failed', 'a szkript hibát dobott');
      }
      return serializeOutput(step, stringify, keep(result.value));
    }
  }
}

function serializeOutput(step: SandboxStep, stringify: QuickJSHandle, value: QuickJSHandle): ScriptRunResult {
  const { context, handles } = step;
  const serialized = context.callFunction(stringify, context.undefined, value);
  if (serialized.error !== undefined) {
    handles.push(serialized.error);
    return thrownFailure(
      step,
      serialized.error,
      'script_output_not_json',
      'a szkript visszatérési értéke nem alakítható JSON szöveggé',
    );
  }
  handles.push(serialized.value);
  if (context.typeof(serialized.value) !== 'string') {
    return {
      kind: 'failed',
      errorKind: 'script_output_not_json',
      message: 'a szkript visszatérési értéke nem JSON érték (például undefined vagy függvény)',
    };
  }
  const output: unknown = JSON.parse(context.getString(serialized.value));
  return { kind: 'succeeded', output };
}

function thrownFailure(
  step: SandboxStep,
  thrown: QuickJSHandle,
  errorKind: 'script_evaluation_failed' | 'script_output_not_json',
  prefix: string,
): ScriptRunResult {
  if (step.state.interrupted) {
    return timedOut(step);
  }
  return { kind: 'failed', errorKind, message: `${prefix}: ${describeSandboxError(step.context, thrown)}` };
}

function timedOut(step: SandboxStep): ScriptRunResult {
  return {
    kind: 'failed',
    errorKind: 'script_timed_out',
    message: `a szkript nem fejeződött be ${String(step.timeoutMs)} ms alatt`,
  };
}

async function evaluatedCompletion(promise: Promise<VmCallResult<QuickJSHandle>>): Promise<SandboxCompletion> {
  return { kind: 'evaluated', result: await promise };
}

function hostFailure(error: unknown): ScriptRunResult {
  return {
    kind: 'failed',
    errorKind: 'script_evaluation_failed',
    message: `a szkript futása a gazda oldalon megszakadt (${describeErrorType(error)})`,
  };
}
