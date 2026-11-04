import type { QuickJSHandle } from 'quickjs-emscripten-core';
import { afterEach, describe, expect, it } from 'vitest';
import { disposeQuietly } from './dispose-quietly.ts';
import type { HostCallScope } from './host-call-scope.ts';
import { loadQuickJsModule } from './load-quickjs-module.ts';
import { readJsonArgument } from './read-json-argument.ts';

const teardowns: (() => void)[] = [];

function ignoreCrash(): void {
  // Ebben a tesztben a rendezés nem fut, gazda hiba nem jöhet.
}

afterEach(() => {
  const pending = [...teardowns];
  teardowns.length = 0;
  for (const teardown of pending) {
    teardown();
  }
});

// Valódi QuickJS kontextus; a `value` forrás kiértékelésének handle-jét adja a vizsgált függvénynek.
async function readFromSource(source: string): Promise<unknown> {
  const quickJs = await loadQuickJsModule(64);
  const runtime = quickJs.newRuntime();
  const context = runtime.newContext();
  const stringify = context.unwrapResult(context.evalCode('JSON.stringify'));
  const parse = context.unwrapResult(context.evalCode('JSON.parse'));
  const handles: QuickJSHandle[] = [stringify, parse];
  teardowns.push(() => {
    disposeQuietly(handles, context, runtime);
  });
  const scope: HostCallScope = {
    context,
    runtime,
    stringify,
    parse,
    signal: new AbortController().signal,
    pendingCalls: new Set(),
    reportHostCrash: ignoreCrash,
    isInterrupted: () => false,
  };
  const value = context.unwrapResult(context.evalCode(source));
  handles.push(value);
  return readJsonArgument(scope, value);
}

describe('readJsonArgument', () => {
  it('a szöveget, a számot és az objektumot JSON értékként olvassa', async () => {
    await expect(readFromSource('"szia"')).resolves.toBe('szia');
    await expect(readFromSource('42')).resolves.toBe(42);
    await expect(readFromSource('({ a: [1, "x"], f() {} })')).resolves.toStrictEqual({ a: [1, 'x'] });
  });

  it('a JSON alakkal nem bíró értékre undefined', async () => {
    await expect(readFromSource('undefined')).resolves.toBeUndefined();
    await expect(readFromSource('(() => 1)')).resolves.toBeUndefined();
  });

  it('a hiányzó argumentumra undefined', async () => {
    const quickJs = await loadQuickJsModule(64);
    const runtime = quickJs.newRuntime();
    const context = runtime.newContext();
    teardowns.push(() => {
      disposeQuietly([], context, runtime);
    });
    const scope: HostCallScope = {
      context,
      runtime,
      stringify: context.undefined,
      parse: context.undefined,
      signal: new AbortController().signal,
      pendingCalls: new Set(),
      reportHostCrash: ignoreCrash,
      isInterrupted: () => false,
    };
    expect(readJsonArgument(scope, undefined)).toBeUndefined();
  });

  it('a szerializálás sandbox hibáját kivételként adja tovább, a nevével és az üzenetével', async () => {
    await expect(readFromSource('({ get a() { throw new TypeError("rossz getter"); } })')).rejects.toMatchObject({
      name: 'TypeError',
      message: 'rossz getter',
    });
  });
});
