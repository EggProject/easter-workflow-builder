import { describe, expect, it } from 'vitest';
import { ScriptConfigSchema } from './script-config.ts';

describe('ScriptConfigSchema', () => {
  it('elfogadja a source és a runtime mezőt', () => {
    expect(ScriptConfigSchema.safeParse({ source: 'x + 1', runtime: 'expression' }).success).toBe(true);
  });

  it('ismeretlen runtime értéket elutasít', () => {
    expect(ScriptConfigSchema.safeParse({ source: 'x + 1', runtime: 'javascript' }).success).toBe(false);
  });

  it('ismeretlen kulcsot elutasít (strictObject)', () => {
    expect(ScriptConfigSchema.safeParse({ source: 'x', runtime: 'expression', extra: 1 }).success).toBe(false);
  });
});
