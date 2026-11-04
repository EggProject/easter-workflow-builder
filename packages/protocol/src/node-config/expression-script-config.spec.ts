import { describe, expect, it } from 'vitest';
import { ExpressionScriptConfigSchema } from './expression-script-config.ts';

describe('ExpressionScriptConfigSchema', () => {
  it('elfogadja a source és a runtime mezőt', () => {
    expect(ExpressionScriptConfigSchema.safeParse({ source: 'x + 1', runtime: 'expression' }).success).toBe(true);
  });

  it('más runtime értéket elutasít', () => {
    expect(ExpressionScriptConfigSchema.safeParse({ source: 'x + 1', runtime: 'javascript' }).success).toBe(false);
  });

  it('ismeretlen kulcsot elutasít (strictObject)', () => {
    expect(ExpressionScriptConfigSchema.safeParse({ source: 'x', runtime: 'expression', extra: 1 }).success).toBe(
      false,
    );
  });
});
