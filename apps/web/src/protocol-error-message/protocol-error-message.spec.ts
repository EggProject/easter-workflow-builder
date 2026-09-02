import type { ProtocolErrorCode } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { protocolErrorMessage } from './protocol-error-message.ts';

describe('protocolErrorMessage', () => {
  const cases: readonly (readonly [ProtocolErrorCode, string])[] = [
    ['invalid_request', 'A kérés nem volt érvényes.'],
    ['not_found', 'A keresett elem nem létezik, esetleg időközben törölték.'],
    ['conflict', 'Az elem állapota most nem engedi a műveletet.'],
    ['unprocessable', 'A kérés rendben volt, de a rendszer nem tudja végrehajtani.'],
    ['internal', 'Váratlan szerver hiba történt.'],
  ];

  it.each(cases)('a(z) "%s" kódhoz a megfelelő magyar mondatot rendeli', (code, expected) => {
    expect(protocolErrorMessage(code)).toBe(expected);
  });
});
