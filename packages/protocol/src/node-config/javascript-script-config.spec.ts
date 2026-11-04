/* eslint-disable unicorn/no-null -- a `timeoutMs`, a `cwd` és a `memoryLimitMb` nullázható mezők, a dróton ténylegesen `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import { JavaScriptScriptConfigSchema } from './javascript-script-config.ts';

const VALID = { source: 'return 1;', runtime: 'javascript', timeoutMs: null, cwd: null, memoryLimitMb: null };

describe('JavaScriptScriptConfigSchema', () => {
  it('elfogadja a null és a megadott timeoutMs és cwd értéket', () => {
    expect(JavaScriptScriptConfigSchema.safeParse(VALID).success).toBe(true);
    expect(JavaScriptScriptConfigSchema.safeParse({ ...VALID, timeoutMs: 120_000, cwd: 'munka/almappa' }).success).toBe(
      true,
    );
  });

  it('az olvasó séma a nem pozitív egész és a felső határ fölötti timeoutMs értéket is elfogadja', () => {
    for (const timeoutMs of [0, -1, 1.5, 2_147_483_648]) {
      expect(JavaScriptScriptConfigSchema.safeParse({ ...VALID, timeoutMs }).success).toBe(true);
    }
  });

  it('az olvasó séma a megadott és a tartományon kívüli memoryLimitMb értéket is elfogadja', () => {
    for (const memoryLimitMb of [256, 0, 15, 2049, 16.5]) {
      expect(JavaScriptScriptConfigSchema.safeParse({ ...VALID, memoryLimitMb }).success).toBe(true);
    }
  });

  it('a hiányzó memoryLimitMb mezőt és a nem szám értéket elutasítja', () => {
    expect(
      JavaScriptScriptConfigSchema.safeParse({ source: 'x', runtime: 'javascript', timeoutMs: null, cwd: null })
        .success,
    ).toBe(false);
    expect(JavaScriptScriptConfigSchema.safeParse({ ...VALID, memoryLimitMb: '256' }).success).toBe(false);
  });

  it('a hiányzó timeoutMs vagy cwd mezőt elutasítja', () => {
    expect(
      JavaScriptScriptConfigSchema.safeParse({ source: 'x', runtime: 'javascript', cwd: null, memoryLimitMb: null })
        .success,
    ).toBe(false);
    expect(
      JavaScriptScriptConfigSchema.safeParse({
        source: 'x',
        runtime: 'javascript',
        timeoutMs: null,
        memoryLimitMb: null,
      }).success,
    ).toBe(false);
  });

  it('a nem szám timeoutMs és a nem szöveg cwd elbukik', () => {
    expect(JavaScriptScriptConfigSchema.safeParse({ ...VALID, timeoutMs: '60' }).success).toBe(false);
    expect(JavaScriptScriptConfigSchema.safeParse({ ...VALID, cwd: 7 }).success).toBe(false);
  });

  it('más runtime értéket és ismeretlen kulcsot elutasít', () => {
    expect(JavaScriptScriptConfigSchema.safeParse({ ...VALID, runtime: 'expression' }).success).toBe(false);
    expect(JavaScriptScriptConfigSchema.safeParse({ ...VALID, extra: 1 }).success).toBe(false);
  });
});
