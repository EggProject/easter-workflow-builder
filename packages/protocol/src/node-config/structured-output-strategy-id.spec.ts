import { describe, expect, it } from 'vitest';
import { StructuredOutputStrategyIdSchema } from './structured-output-strategy-id.ts';

describe('StructuredOutputStrategyIdSchema', () => {
  it('mindkét stratégiát elfogadja', () => {
    expect(StructuredOutputStrategyIdSchema.safeParse('emit_output_tool').success).toBe(true);
    expect(StructuredOutputStrategyIdSchema.safeParse('sdk_output_format').success).toBe(true);
  });

  it('ismeretlen stratégiát elutasít', () => {
    expect(StructuredOutputStrategyIdSchema.safeParse('unknown_strategy').success).toBe(false);
  });
});
