import { describe, expect, it } from 'vitest';
import { EngineHookIdSchema } from './engine-hook-id.ts';

describe('EngineHookIdSchema', () => {
  it('az egyetlen ismert hook azonosítót elfogadja', () => {
    expect(EngineHookIdSchema.safeParse('emit_output_tool_stop').success).toBe(true);
  });

  it('ismeretlen azonosítót elutasít', () => {
    expect(EngineHookIdSchema.safeParse('unknown_hook').success).toBe(false);
  });
});
