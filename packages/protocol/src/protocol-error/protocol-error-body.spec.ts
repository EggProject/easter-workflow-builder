import { describe, expect, it } from 'vitest';
import { ProtocolErrorBodySchema } from './protocol-error-body.ts';

describe('ProtocolErrorBodySchema', () => {
  it('elfogadja a code és message mezőt', () => {
    const outcome = ProtocolErrorBodySchema.safeParse({ code: 'not_found', message: 'nincs ilyen erőforrás' });
    expect(outcome.success).toBe(true);
  });

  it('elfogadja a szótárban álló errorClass mezőt (8.5)', () => {
    const outcome = ProtocolErrorBodySchema.safeParse({
      code: 'unprocessable',
      message: 'Nincs alapértelmezett provider (no_default_provider).',
      errorClass: 'no_default_provider',
    });
    expect(outcome.success && outcome.data.errorClass).toBe('no_default_provider');
  });

  it.each(['template_render_failed', 'expression_evaluation_failed'])(
    'elfogadja a SPEC-010 9.3 szerinti %s errorClass mezőt (user döntés 2026-10-25)',
    (errorClass) => {
      const outcome = ProtocolErrorBodySchema.safeParse({
        code: 'unprocessable',
        message: `A futás nem indítható (${errorClass}).`,
        errorClass,
      });
      expect(outcome.success && outcome.data.errorClass).toBe(errorClass);
    },
  );

  it('a mező nélküli törzsben az errorClass hiányzik (a mező előtti szerver válasz is érvényes)', () => {
    const outcome = ProtocolErrorBodySchema.safeParse({ code: 'unprocessable', message: 'hiba' });
    expect(outcome.success && Object.hasOwn(outcome.data, 'errorClass')).toBe(false);
  });

  it('a szótáron kívüli errorClass értéket elutasítja', () => {
    const outcome = ProtocolErrorBodySchema.safeParse({
      code: 'internal',
      message: 'hiba (database_closed).',
      errorClass: 'database_closed',
    });
    expect(outcome.success).toBe(false);
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
