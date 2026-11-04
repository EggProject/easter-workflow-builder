import { describe, expect, it } from 'vitest';
import { SCRIPT_SANDBOX_LIMITS } from './script-sandbox-limits.ts';

describe('SCRIPT_SANDBOX_LIMITS', () => {
  it('a modul plafonja pontosan a deklarált 32768 lap', () => {
    expect((SCRIPT_SANDBOX_LIMITS.moduleMemoryCeilingMb * 2 ** 20) / SCRIPT_SANDBOX_LIMITS.wasmPageBytes).toBe(32_768);
  });

  it('a user döntése szerinti stack méret és a spec szerinti alapértelmezett határidő', () => {
    expect(SCRIPT_SANDBOX_LIMITS.maxStackSizeBytes).toBe(131_072);
    expect(SCRIPT_SANDBOX_LIMITS.defaultTimeoutMs).toBe(60_000);
    expect(SCRIPT_SANDBOX_LIMITS.initialPages).toBe(256);
  });

  it('az olvasási plafon alapértéke mindkét gazda olvasásra 50 MB (iparági alapérték, SPEC-014 5.4 "Olvasási plafon")', () => {
    expect(SCRIPT_SANDBOX_LIMITS.defaultFetchResponseLimitMb).toBe(50);
    expect(SCRIPT_SANDBOX_LIMITS.defaultFileReadLimitMb).toBe(50);
  });
});
