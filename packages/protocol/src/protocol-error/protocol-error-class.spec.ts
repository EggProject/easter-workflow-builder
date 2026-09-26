import { describe, expect, it } from 'vitest';
import { ProtocolErrorClassSchema } from './protocol-error-class.ts';

describe('ProtocolErrorClassSchema', () => {
  it.each(ProtocolErrorClassSchema.options)('elfogadja a(z) "%s" hibaosztályt', (errorClass) => {
    expect(ProtocolErrorClassSchema.safeParse(errorClass).success).toBe(true);
  });

  it('a szótáron kívüli hibaosztályt elutasítja (a kliens ilyenkor a kód mondatát mutatja)', () => {
    expect(ProtocolErrorClassSchema.safeParse('database_closed').success).toBe(false);
  });

  it('nem szöveges értéket elutasít', () => {
    expect(ProtocolErrorClassSchema.safeParse(42).success).toBe(false);
  });
});
