import { describe, expect, it } from 'vitest';
import { ProtocolErrorCodeSchema } from './protocol-error-code.ts';

describe('ProtocolErrorCodeSchema', () => {
  it.each(['invalid_request', 'not_found', 'conflict', 'unprocessable', 'internal'] as const)(
    'elfogadja a(z) "%s" kódot, a SPEC-005 8.2 táblázata szerint (37. kritérium, külön teszteset)',
    (code) => {
      expect(ProtocolErrorCodeSchema.safeParse(code).success).toBe(true);
    },
  );

  it('ismeretlen kódot elutasít', () => {
    expect(ProtocolErrorCodeSchema.safeParse('unknown_code').success).toBe(false);
  });
});
