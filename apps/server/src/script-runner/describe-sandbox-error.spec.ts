import type { QuickJSContext } from 'quickjs-emscripten-core';
import { describe, expect, it } from 'vitest';
import { describeSandboxError } from './describe-sandbox-error.ts';
import { loadQuickJsModule } from './load-quickjs-module.ts';

async function describeThrown(source: string): Promise<string> {
  const quickJs = await loadQuickJsModule(16);
  const runtime = quickJs.newRuntime();
  const context: QuickJSContext = runtime.newContext();
  const result = context.evalCode(source);
  if (result.error === undefined) {
    throw new Error('a próba kódnak dobnia kell');
  }
  const text = describeSandboxError(context, result.error);
  result.error.dispose();
  context.dispose();
  runtime.dispose();
  return text;
}

describe('describeSandboxError', () => {
  it('Error értékre a nevet és az üzenetet adja, a vermet nem', async () => {
    await expect(describeThrown('throw new RangeError("túl nagy")')).resolves.toBe('RangeError: túl nagy');
  });

  it('nem Error értékre rögzített mondatot ad', async () => {
    await expect(describeThrown('throw "szöveg"')).resolves.toBe('a dobott érték nem Error objektum');
    await expect(describeThrown('throw { name: 1, message: "x" }')).resolves.toBe('a dobott érték nem Error objektum');
  });
});
