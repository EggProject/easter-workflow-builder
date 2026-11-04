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
import { isForbiddenScriptRoot } from './is-forbidden-script-root.ts';
import { loadQuickJsModule } from './load-quickjs-module.ts';
import { resolveMemoryLimitMb } from './resolve-memory-limit-mb.ts';
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
 *
 * Előtte törli a pinelt QuickJS ismert hibáit hordozó hat nevet (SPEC-014 5.4
 * "Eltávolított nevek", user döntés 2026-11-04: "A hat név törlése"): az
 * `Array.prototype` `toReversed`, `with`, `toSpliced` és `toSorted`
 * metódusát, a `TypedArray` közös prototípusának `toReversed`, `with` és
 * `toSorted` metódusát (`toSpliced` ott nincs), valamint a globális
 * `FinalizationRegistry` és `WeakRef` konstruktort (research
 * `2026-11-04-szkript-csomopont.md` 4. szekció, 10.3). A törölt függvényre más
 * hivatkozás nem marad, tehát a szkript nem tudja visszaállítani.
 */
const PRELUDE_SOURCE =
  '((stringify, parse, keys, global, typedArrayPrototype) => {' +
  ' for (const name of ["toReversed", "with", "toSpliced", "toSorted"]) {' +
  ' delete Array.prototype[name]; delete typedArrayPrototype[name]; }' +
  ' delete global.FinalizationRegistry; delete global.WeakRef;' +
  ' return (text) => {' +
  ' const values = parse(text);' +
  ' for (const key of keys(values)) { global[key] = values[key]; }' +
  ' return (value) => stringify(value);' +
  ' }; })(JSON.stringify, JSON.parse, Object.keys, globalThis, Object.getPrototypeOf(Uint8Array.prototype))';

/**
 * A sandbox `JSON.parse`-a, a szkript előtt rögzítve: a gazda függvények
 * eredménye ezzel lesz sandbox érték (`start-host-call.ts`).
 */
const PARSE_SOURCE = 'JSON.parse';

/**
 * A lépés futás közbeni állapota: a lebontandó handle-ök, a még nem rendezett
 * gazda hívások, a fájl hozzáférés gyökere, a gazda olvasás felső határa (a
 * lépés memória korlátja bájtban), a gazda hívások jele (a kérés jele
 * és a lépés vége együtt) és az interrupt kezelő jelzése.
 */
interface SandboxStep {
  readonly context: QuickJSContext;
  readonly runtime: QuickJSRuntime;
  readonly handles: QuickJSHandle[];
  readonly pendingCalls: Set<QuickJSDeferredPromise>;
  readonly root: string;
  readonly maxReadBytes: number;
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
 * 1. A határidő a lépés indulásától számít (`timeoutMs` vagy 60 000 ms). A
 *    `/proc` vagy `/dev` alá mutató fájl gyökér (lexikálisan vagy
 *    `fs.realpath` után) a modul betöltése előtt `script_evaluation_failed`.
 * 2. Friss modul saját memória korláttal, új runtime `setMaxStackSize`-zal, új
 *    kontextus; az interrupt kezelő (a CPU kötött kód ága, research
 *    `2026-11-04-szkript-csomopont.md` Q-1, Q-3) közvetlenül a szkript előtt.
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
  const deadlineMs = Date.now() + timeoutMs;
  const root = path.resolve(request.cwd ?? process.cwd());
  // A `/proc` vagy `/dev` alá mutató gyökér a szkript indítása előtt a lépés
  // megnevezett hibája (user döntés 2026-11-04, SPEC-014 5.4 "Fájl").
  if (await isForbiddenScriptRoot(root)) {
    return {
      kind: 'failed',
      errorKind: 'script_evaluation_failed',
      message: 'a szkript fájl hozzáférésének gyökere (cwd) a tiltott /proc vagy /dev könyvtárba mutat',
    };
  }
  try {
    return await runInFreshModule(request, root, timeoutMs, deadlineMs);
  } catch (error) {
    return hostFailure(error);
  }
}

async function runInFreshModule(
  request: ScriptRunRequest,
  root: string,
  timeoutMs: number,
  deadlineMs: number,
): Promise<ScriptRunResult> {
  const quickJs = await loadQuickJsModule(request.memoryLimitMb);
  if (request.signal.aborted) {
    return { kind: 'aborted' };
  }
  const runtime = quickJs.newRuntime();
  runtime.setMaxStackSize(SCRIPT_SANDBOX_LIMITS.maxStackSizeBytes);
  const context = runtime.newContext();
  const stepEnd = new AbortController();
  const step: SandboxStep = {
    context,
    runtime,
    handles: [],
    pendingCalls: new Set(),
    root,
    maxReadBytes: resolveMemoryLimitMb(request.memoryLimitMb) * 2 ** 20,
    hostSignal: AbortSignal.any([request.signal, stepEnd.signal]),
    timeoutMs,
    deadlineMs,
    state: { interrupted: false },
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
    isInterrupted: () => step.state.interrupted,
  };
  for (const handle of installHostFunctions(scope, step.root, step.maxReadBytes)) {
    keep(handle);
  }

  // Az interrupt kezelő csak a szkript előtt áll be: az előkészítő kód (a
  // futás kontextus és a gazda nevek) a határidő után sem szakadhat félbe, mert
  // az ott elkapott megszakítás gazda hibaként, nem időkorlátként jelentkezne
  // (PLAN-015 T-015-12, 1 ms-os határidő).
  const isPastDeadline = shouldInterruptAfterDeadline(step.deadlineMs);
  runtime.setInterruptHandler((interruptedRuntime) => {
    step.state.interrupted = isPastDeadline(interruptedRuntime) === true;
    return step.state.interrupted;
  });

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
  // A leírás a dobott érték getterét is futtathatja; az abban érkező
  // megszakítás is időkorlát, ezért a jelzés a leírás után dönt (T-015-12).
  const description = describeSandboxError(step.context, thrown);
  if (step.state.interrupted) {
    return timedOut(step);
  }
  return { kind: 'failed', errorKind, message: `${prefix}: ${description}` };
}

function timedOut(step: SandboxStep): ScriptRunResult {
  return {
    kind: 'failed',
    errorKind: 'script_timed_out',
    message: `a szkript nem fejeződött be ${String(step.timeoutMs)} ms alatt`,
  };
}

/**
 * A `resolvePromise` gazda ígérete elutasíthat: a könyvtár a futás idejű
 * `Promise.resolve` és `then` értéket hívja, és a `then` hibáját a gazda
 * ígéret végrehajtójában dobja (`quickjs-emscripten-core` 0.32.0
 * `resolvePromise`), tehát a szkript a saját `Promise`-ának felülírásával
 * elutasítást válthat ki. Az elutasítás a lépés hibája; kezeletlenül a Node
 * alapból leállítaná a szerver folyamatot (PLAN-015 T-015-12).
 */
async function evaluatedCompletion(promise: Promise<VmCallResult<QuickJSHandle>>): Promise<SandboxCompletion> {
  try {
    return { kind: 'evaluated', result: await promise };
  } catch (error) {
    return { kind: 'host_crashed', error };
  }
}

function hostFailure(error: unknown): ScriptRunResult {
  return {
    kind: 'failed',
    errorKind: 'script_evaluation_failed',
    message: `a szkript futása a gazda oldalon megszakadt (${describeErrorType(error)})`,
  };
}
