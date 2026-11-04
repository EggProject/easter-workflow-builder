import { describe, expect, it } from 'vitest';
import { ProtocolErrorClassSchema } from './protocol-error-class.ts';

describe('ProtocolErrorClassSchema', () => {
  it.each(ProtocolErrorClassSchema.options)('elfogadja a(z) "%s" hibaosztályt', (errorClass) => {
    expect(ProtocolErrorClassSchema.safeParse(errorClass).success).toBe(true);
  });

  it('tartalmazza a futás bemenete típus ellenőrzésének hibaosztályát (SPEC-016 5.5)', () => {
    expect(ProtocolErrorClassSchema.safeParse('invalid_input_type').success).toBe(true);
  });

  it('tartalmazza a strukturált kimenet séma ellenőrzésének két hibaosztályát (SPEC-015 5.4, 5.5)', () => {
    expect(ProtocolErrorClassSchema.safeParse('invalid_structured_output_schema').success).toBe(true);
    expect(ProtocolErrorClassSchema.safeParse('structured_output_schema_mismatch').success).toBe(true);
  });

  it('a szótáron kívüli hibaosztályt elutasítja (a kliens ilyenkor a kód mondatát mutatja)', () => {
    expect(ProtocolErrorClassSchema.safeParse('database_closed').success).toBe(false);
  });

  it('nem szöveges értéket elutasít', () => {
    expect(ProtocolErrorClassSchema.safeParse(42).success).toBe(false);
  });
});
