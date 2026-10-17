import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodErrorToProtocolErrorBody } from './zod-error-to-protocol-error-body.ts';

describe('zodErrorToProtocolErrorBody', () => {
  it('a hibás mező útvonalát nevezi meg', () => {
    const schema = z.strictObject({ name: z.string() });
    const outcome = schema.safeParse({ name: 123 });
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      const body = zodErrorToProtocolErrorBody(outcome.error);
      expect(body.code).toBe('invalid_request');
      expect(body.message).toContain('name');
    }
  });

  it('soha nem tartalmazza a kapott, titkot hordozó értéket (16. kritérium)', () => {
    const schema = z.strictObject({ apiKey: z.number() });
    const outcome = schema.safeParse({ apiKey: 'sk-super-secret-value' });
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      const body = zodErrorToProtocolErrorBody(outcome.error);
      expect(body.message).not.toContain('sk-super-secret-value');
    }
  });

  it('gyökér szintű hibára "(gyökér)" jelölést ad, ha a path üres', () => {
    const schema = z.strictObject({ name: z.string() });
    const outcome = schema.safeParse('not an object');
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      const body = zodErrorToProtocolErrorBody(outcome.error);
      expect(body.message).toContain('(gyökér)');
    }
  });

  it('több hibás mezőt is felsorol, vesszővel elválasztva', () => {
    const schema = z.strictObject({ name: z.string(), age: z.number() });
    const outcome = schema.safeParse({ name: 1, age: 'x' });
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      const body = zodErrorToProtocolErrorBody(outcome.error);
      expect(body.message).toContain('name');
      expect(body.message).toContain('age');
    }
  });

  it('üres issue listára is ad használható üzenetet (defenzív ág, közvetlen ZodError konstrukcióval)', () => {
    const emptyError = new z.ZodError([]);
    const body = zodErrorToProtocolErrorBody(emptyError);
    expect(body.code).toBe('invalid_request');
    expect(body.message.length).toBeGreaterThan(0);
  });
});

describe('zodErrorToProtocolErrorBody: szerkezeti bemenet (SPEC-008 5.4, O-38)', () => {
  it('a zod hibán kívüli, ugyanilyen alakú hibalistából is a mezőútvonalakat nevezi meg', () => {
    const body = zodErrorToProtocolErrorBody({
      issues: [{ path: ['nodes', 0, 'config', 'agents', 'reviewer', 'description'] }],
    });
    expect(body).toStrictEqual({
      code: 'invalid_request',
      message:
        'A kérés törzse érvénytelen, hibás mező(k): nodes.0.config.agents.reviewer.description (invalid_request).',
    });
  });
});
