import { describe, expect, it } from 'vitest';
import { ProtocolErrorCodeSchema } from './protocol-error-code.ts';

describe('ProtocolErrorCodeSchema', () => {
  it('a SPEC-005 8.2 táblázatának mind az öt kódját elfogadja (37. kritérium)', () => {
    const codes = ['invalid_request', 'not_found', 'conflict', 'unprocessable', 'internal'];
    for (const code of codes) {
      expect(ProtocolErrorCodeSchema.safeParse(code).success).toBe(true);
    }
    expect(codes).toHaveLength(5);
  });

  it('ismeretlen kódot elutasít', () => {
    expect(ProtocolErrorCodeSchema.safeParse('unknown_code').success).toBe(false);
  });
});
