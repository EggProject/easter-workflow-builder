/* eslint-disable unicorn/no-null -- a `timeoutMs` és a `cwd` nullázható mezők, a dróton ténylegesen `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import { ScriptConfigSchema } from './script-config.ts';

describe('ScriptConfigSchema', () => {
  it('a runtime szerint az expression ágat választja', () => {
    const parsed = ScriptConfigSchema.safeParse({ source: 'x + 1', runtime: 'expression' });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.runtime).toBe('expression');
  });

  it('a runtime szerint a javascript ágat választja', () => {
    const parsed = ScriptConfigSchema.safeParse({
      source: 'return 1;',
      runtime: 'javascript',
      timeoutMs: null,
      cwd: null,
      memoryLimitMb: null,
      fetchResponseLimitMb: null,
      fileReadLimitMb: null,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.runtime).toBe('javascript');
  });

  it('ismeretlen runtime értéket elutasít', () => {
    expect(ScriptConfigSchema.safeParse({ source: 'x', runtime: 'python' }).success).toBe(false);
  });

  it('a javascript ág timeoutMs és cwd nélkül elbukik', () => {
    expect(ScriptConfigSchema.safeParse({ source: 'x', runtime: 'javascript' }).success).toBe(false);
  });

  it('a másik ág kulcsát elutasítja (strictObject)', () => {
    expect(ScriptConfigSchema.safeParse({ source: 'x', runtime: 'expression', timeoutMs: null }).success).toBe(false);
    expect(
      ScriptConfigSchema.safeParse({ source: 'x', runtime: 'javascript', timeoutMs: null, cwd: null, extra: 1 })
        .success,
    ).toBe(false);
  });
});
