import { describe, expect, it } from 'vitest';
import { emptyResponseSchema } from './empty-response-schema.ts';

describe('emptyResponseSchema', () => {
  it('az üres (undefined) törzset elfogadja', () => {
    expect(emptyResponseSchema.safeParse(undefined)).toEqual({ success: true, data: undefined });
  });

  it('bármilyen más törzsre hibaágat ad, gyökér mezőúttal', () => {
    expect(emptyResponseSchema.safeParse({ nem: 'üres' })).toEqual({
      success: false,
      error: { issues: [{ path: [] }] },
    });
  });
});
