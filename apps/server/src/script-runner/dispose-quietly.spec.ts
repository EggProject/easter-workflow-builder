import { describe, expect, it } from 'vitest';
import { disposeQuietly } from './dispose-quietly.ts';
import { loadQuickJsModule } from './load-quickjs-module.ts';

describe('disposeQuietly', () => {
  it('a handle-öket, a kontextust és a runtime-ot felszabadítja', async () => {
    const quickJs = await loadQuickJsModule(16);
    const runtime = quickJs.newRuntime();
    const context = runtime.newContext();
    const handle = context.newString('x');
    disposeQuietly([handle], context, runtime);
    expect(handle.alive).toBe(false);
    expect(context.alive).toBe(false);
    expect(runtime.alive).toBe(false);
  });

  it('a lebontás hibáját elnyeli', async () => {
    const quickJs = await loadQuickJsModule(16);
    const runtime = quickJs.newRuntime();
    const context = runtime.newContext();
    const handle = context.newString('x');
    handle.dispose();
    expect(() => {
      disposeQuietly([handle], context, runtime);
    }).not.toThrow();
  });
});
