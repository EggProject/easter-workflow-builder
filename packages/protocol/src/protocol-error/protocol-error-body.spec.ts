import { describe, expect, it } from 'vitest';
import { ProtocolErrorBodySchema } from './protocol-error-body.ts';

describe('ProtocolErrorBodySchema', () => {
  it('elfogadja a code és message mezőt', () => {
    const outcome = ProtocolErrorBodySchema.safeParse({ code: 'not_found', message: 'nincs ilyen erőforrás' });
    expect(outcome.success).toBe(true);
  });

  it('elutasítja az ismeretlen kulcsot (40. kritérium: nincs szabad details mező)', () => {
    const outcome = ProtocolErrorBodySchema.safeParse({
      code: 'not_found',
      message: 'nincs ilyen erőforrás',
      details: { extra: true },
    });
    expect(outcome.success).toBe(false);
  });

  it('elutasítja a stack, sql és path mezőt is (40. kritérium)', () => {
    const outcome = ProtocolErrorBodySchema.safeParse({
      code: 'internal',
      message: 'hiba',
      stack: 'Error: at ...',
    });
    expect(outcome.success).toBe(false);
  });
});
