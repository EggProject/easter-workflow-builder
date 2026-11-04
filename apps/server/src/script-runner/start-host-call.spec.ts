import type { QuickJSDeferredPromise } from 'quickjs-emscripten-core';
import { afterEach, describe, expect, it } from 'vitest';
import { disposeQuietly } from './dispose-quietly.ts';
import type { HostCallOutcome } from './host-call-outcome.ts';
import type { HostCallScope } from './host-call-scope.ts';
import { loadQuickJsModule } from './load-quickjs-module.ts';
import { startHostCall } from './start-host-call.ts';

interface Harness {
  readonly scope: HostCallScope;
  readonly controller: AbortController;
  readonly crashes: unknown[];
  readonly dispose: () => void;
}

const teardowns: (() => void)[] = [];

afterEach(() => {
  const pending = [...teardowns];
  teardowns.length = 0;
  for (const teardown of pending) {
    teardown();
  }
});

// Valódi QuickJS kontextus a rögzített `JSON.stringify`-jal és `JSON.parse`-szal, mint a futtatóban.
async function createHarness(): Promise<Harness> {
  const quickJs = await loadQuickJsModule(64);
  const runtime = quickJs.newRuntime();
  const context = runtime.newContext();
  const stringify = context.unwrapResult(context.evalCode('JSON.stringify'));
  const parse = context.unwrapResult(context.evalCode('JSON.parse'));
  const controller = new AbortController();
  const crashes: unknown[] = [];
  const pendingCalls = new Set<QuickJSDeferredPromise>();
  const scope: HostCallScope = {
    context,
    runtime,
    stringify,
    parse,
    signal: controller.signal,
    pendingCalls,
    reportHostCrash: (error) => {
      crashes.push(error);
    },
  };
  const dispose = (): void => {
    disposeQuietly([...pendingCalls, stringify, parse], context, runtime);
  };
  teardowns.push(dispose);
  return { scope, controller, crashes, dispose };
}

// A gazda hívást egy sandbox függvényen át indítja, és a sandbox oldali eredményt a `globalThis.out` névre írja.
function callFromSandbox(harness: Harness, work: Promise<HostCallOutcome>): void {
  const { context } = harness.scope;
  const hostFunction = context.newFunction('host', () => startHostCall(harness.scope, work));
  context.setProp(context.global, 'host', hostFunction);
  hostFunction.dispose();
  context
    .unwrapResult(
      context.evalCode(
        'globalThis.out = "függ"; host().then((v) => { globalThis.out = { ok: v }; }, (e) => { globalThis.out = { hiba: e.name + ": " + e.message }; });',
      ),
    )
    .dispose();
}

function sandboxOut(harness: Harness): unknown {
  const { context } = harness.scope;
  return context.getProp(context.global, 'out').consume((handle): unknown => context.dump(handle));
}

describe('startHostCall', () => {
  it('a teljesült eredmény JSON értéke a sandbox ígéretének értéke, a függő feladatok lefutnak', async () => {
    const harness = await createHarness();
    const work = Promise.resolve<HostCallOutcome>({ kind: 'resolved', json: '{"a":[1,"x"]}' });
    callFromSandbox(harness, work);
    expect(harness.scope.pendingCalls.size).toBe(1);
    await work;
    expect(sandboxOut(harness)).toStrictEqual({ ok: { a: [1, 'x'] } });
    expect(harness.scope.pendingCalls.size).toBe(0);
  });

  it('az érték nélküli eredmény undefined-dal teljesül', async () => {
    const harness = await createHarness();
    const work = Promise.resolve<HostCallOutcome>({ kind: 'resolved', json: undefined });
    callFromSandbox(harness, work);
    await work;
    expect(sandboxOut(harness)).toStrictEqual({});
  });

  it('az elutasítás a megadott nevű és üzenetű hibával utasítja el a sandbox ígéretét', async () => {
    const harness = await createHarness();
    const work = Promise.resolve<HostCallOutcome>({ kind: 'rejected', name: 'TypeError', message: 'rossz' });
    callFromSandbox(harness, work);
    await work;
    expect(sandboxOut(harness)).toStrictEqual({ hiba: 'TypeError: rossz' });
    expect(harness.scope.pendingCalls.size).toBe(0);
  });

  it('a jel lejárta után érkező eredmény a sandboxot nem érinti, és a lebontás után sem dob', async () => {
    const harness = await createHarness();
    const late = Promise.withResolvers<HostCallOutcome>();
    callFromSandbox(harness, late.promise);
    harness.controller.abort();
    harness.dispose();
    late.resolve({ kind: 'resolved', json: '1' });
    await late.promise;
    expect(harness.crashes).toStrictEqual([]);
  });

  it('a jel lejárta után a függő ígéret a lebontásig a listában marad', async () => {
    const harness = await createHarness();
    const work = Promise.resolve<HostCallOutcome>({ kind: 'resolved', json: '1' });
    callFromSandbox(harness, work);
    harness.controller.abort();
    await work;
    expect(sandboxOut(harness)).toBe('függ');
    expect(harness.scope.pendingCalls.size).toBe(1);
  });

  it('a rendezés gazdára kijutó hibáját a lépés hibájaként jelenti', async () => {
    const harness = await createHarness();
    const work = Promise.resolve<HostCallOutcome>({ kind: 'resolved', json: '{' });
    callFromSandbox(harness, work);
    await work;
    expect(harness.crashes).toHaveLength(1);
    expect(sandboxOut(harness)).toBe('függ');
  });
});
