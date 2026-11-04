/* eslint-disable unicorn/no-null -- a `memoryLimitMb` üres értéke a tárolt `null` (SPEC-014 5.3) */
import { describe, expect, it } from 'vitest';
import { loadQuickJsModule } from './load-quickjs-module.ts';

describe('loadQuickJsModule', () => {
  it('a megadott MB korlátot a modul saját memóriájának maximumaként adja', async () => {
    const quickJs = await loadQuickJsModule(16);
    const memory = quickJs.getWasmMemory();
    expect(memory.buffer.byteLength).toBe(16 * 2 ** 20);
    expect(() => memory.grow(1)).toThrow(RangeError);
  });

  it('minden hívás külön memóriát kap', async () => {
    const first = await loadQuickJsModule(32);
    const second = await loadQuickJsModule(32);
    expect(first.getWasmMemory()).not.toBe(second.getWasmMemory());
  });

  it('null korláttal is betöltődik és kiértékel', async () => {
    const quickJs = await loadQuickJsModule(null);
    expect(quickJs.evalCode('6 * 7')).toBe(42);
  });
});
